import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { api, HistoryItem, type RuntimeConfig } from './api/client';
import { auth, onAuthRequired } from './api/auth';
import { AnimatedBackground } from './components/AnimatedBackground';
import { Confetti } from './components/Confetti';
import { AppHeader } from './components/AppHeader';
import { HistorySidebar } from './components/HistorySidebar';
import { HistoryDialog } from './components/HistoryDialog';
import { RecordingControls } from './components/RecordingControls';
import { SelectedPreview } from './components/SelectedPreview';
import { ProcessingDialog } from './components/ProcessingDialog';
import { ConfigDialog } from './components/ConfigDialog';
import { PromptDetailsDialog } from './components/PromptDetailsDialog';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { ReferencesDialog } from './components/ReferencesDialog';
import { LoginOverlay } from './components/LoginOverlay';
import { MissingEnvNotice } from './components/MissingEnvNotice';
import { useAppSettings } from './hooks/useAppSettings';
import { useSfx } from './hooks/useSfx';
import { useRecorder } from './hooks/useRecorder';
import { useGenerationPipeline } from './hooks/useGenerationPipeline';

export const App: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const settings = useAppSettings();
  const sfx = useSfx(settings.sfxEnabled);
  const recorder = useRecorder();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [previewBustToken, setPreviewBustToken] = useState(0);
  // Id of a freshly created picture: the preview "draws" it with the pencil animation
  const [revealId, setRevealId] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  // What the microphone is recording for: a new idea or a correction of the open picture
  const [recordPurpose, setRecordPurpose] = useState<'new' | 'edit'>('new');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [promptInfoItem, setPromptInfoItem] = useState<HistoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);

  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const refreshHistory = useCallback(async (): Promise<HistoryItem[]> => {
    try {
      const items = await api.history();
      setHistory(items);
      return items;
    } catch {
      return [];
    }
  }, []);

  const celebrate = useCallback(() => {
    setConfettiKey(Date.now());
    sfx.fanfare();
  }, [sfx]);

  const pipeline = useGenerationPipeline({
    settings,
    sfx,
    onCreated: async (id) => {
      const items = await refreshHistory();
      const item = items.find((h) => h.id === id);
      if (item) {
        setHistoryOpen(false);
        setSelected(item);
        setPreviewBustToken(Date.now());
        setRevealId(id); // the fanfare plays when the drawing animation ends
      } else {
        sfx.fanfare();
      }
    },
    onPrinted: celebrate,
    onHistoryChanged: async () => { await refreshHistory(); },
  });

  const { status } = pipeline;
  const canGenerate = runtimeConfig?.canGenerate !== false;
  const canRecord = canGenerate && pipeline.canStart;

  const loadConfig = useCallback(async () => {
    try {
      setRuntimeConfig(await api.getConfig());
    } catch (e) {
      console.error('Load config failed', e);
    }
  }, []);

  useEffect(() => onAuthRequired(() => setNeedLogin(true)), []);

  useEffect(() => {
    api.loadConfig().finally(async () => {
      await loadConfig();
      refreshHistory();
    });
  }, [loadConfig, refreshHistory]);

  /* ---------- microphone ---------- */

  const startRecording = async (purpose: 'new' | 'edit' = 'new') => {
    sfx.click();
    setRecordPurpose(purpose);
    const source = purpose === 'edit' ? selected : null;
    try {
      await recorder.start((audio) => {
        if (source) pipeline.correctWithAudio(source, audio);
        else pipeline.fromAudio(audio);
      });
      pipeline.setRecording(true);
    } catch (e) {
      console.error('Recording failed', e);
      pipeline.fail('Brak uprawnień do mikrofonu lub problem z nagrywaniem.');
    }
  };

  const stopRecording = () => recorder.stop();

  const cancelRecording = () => {
    recorder.cancel();
    pipeline.setRecording(false);
  };

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected && status !== 'recording') {
        setSelected(null);
        return;
      }
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      if (el && (el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select')) return;
      e.preventDefault();
      if (status === 'recording') stopRecording();
      // With a picture open, Space records a correction of that picture
      else if (canRecord) startRecording(selected ? 'edit' : 'new');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ---------- history actions ---------- */

  const deleteItem = async (item: HistoryItem) => {
    try {
      await api.remove(item.id);
      if (selected?.id === item.id) setSelected(null);
      await refreshHistory();
    } catch (e) {
      console.error('Delete failed:', e);
      pipeline.fail('Nie udało się usunąć kolorowanki.');
    }
  };

  const openItem = (item: HistoryItem) => {
    if (!item.imageUrl) return;
    setRevealId(null);
    setSelected(item);
  };

  const handleLoginSubmit = async () => {
    setLoginErr(null);
    setLoginBusy(true);
    try {
      await auth.login(loginPw);
      setNeedLogin(false);
      setLoginPw('');
      api.loadConfig().finally(async () => {
        await loadConfig();
        refreshHistory();
      });
    } catch (err: any) {
      const msg = String(err?.message || 'Błąd logowania');
      setLoginErr(msg.includes('Nieprawidłowe hasło') ? 'Nieprawidłowe hasło.' : 'Błąd logowania.');
    } finally {
      setLoginBusy(false);
    }
  };

  const printableHistory = history.filter((item) => !!item.imageUrl);

  if (runtimeConfig?.missingEnv && runtimeConfig.missingEnv.length > 0) {
    return <MissingEnvNotice runtimeConfig={runtimeConfig} canGenerate={canGenerate} />;
  }

  if (needLogin) {
    return (
      <LoginOverlay
        password={loginPw}
        error={loginErr}
        busy={loginBusy}
        onPasswordChange={setLoginPw}
        onSubmit={handleLoginSubmit}
      />
    );
  }

  const recordingNew = status === 'recording' && recordPurpose === 'new';

  return (
    <Box sx={{ display: 'flex', height: '100dvh', position: 'relative', width: '100%', overflowX: 'hidden' }}>
      <AnimatedBackground />
      <Confetti triggerKey={confettiKey} />
      <AppHeader
        isMobile={isMobile}
        sfxEnabled={settings.sfxEnabled}
        onToggleSfx={settings.setSfxEnabled}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenConfig={async () => { await loadConfig(); setConfigOpen(true); }}
        onOpenReferences={() => setReferencesOpen(true)}
        onGoHome={() => { window.location.href = '/'; }}
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pt: { xs: 7, sm: 8 }, position: 'relative', zIndex: 1 }}>
        {!isMobile && (
          <HistorySidebar
            items={printableHistory}
            selectedId={selected?.id}
            onSelect={openItem}
            onShowPrompt={setPromptInfoItem}
            onDelete={setPendingDelete}
          />
        )}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            containerType: 'size',
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: { xs: '100%', sm: 'auto' },
            maxWidth: { xs: '100%', sm: 'none' },
            mx: { xs: 'auto', sm: 0 },
            px: { xs: 1, sm: 2 },
          }}
        >
          {selected && !recordingNew ? (
            <SelectedPreview
              item={selected}
              isMobile={isMobile}
              previewBustToken={previewBustToken}
              status={status}
              animateReveal={revealId === selected.id}
              onRevealStart={(durationMs, strokes) => sfx.scribble(durationMs, strokes)}
              onRevealDone={() => {
                setRevealId(null);
                sfx.fanfare(); // the pencil animation is the celebration – no confetti on top
              }}
              onClose={() => setSelected(null)}
              onRegenerate={() => pipeline.redraw(selected)}
              onPrint={() => pipeline.print(selected)}
              onDelete={() => setPendingDelete(selected)}
              onShowDetails={() => setPromptInfoItem(selected)}
              canEdit={canRecord}
              editRecording={status === 'recording' && recordPurpose === 'edit'}
              onEditVoice={() => startRecording('edit')}
              onEditText={(text) => pipeline.correctWithText(selected, text)}
              onStopEdit={stopRecording}
              onCancelEdit={cancelRecording}
            />
          ) : (
            <RecordingControls
              status={status}
              isMobile={isMobile}
              canRecord={canRecord}
              autoPrint={settings.autoPrint}
              improveEnabled={settings.improveEnabled}
              landscapeMode={settings.landscapeMode}
              ideasVisible
              onAutoPrintChange={settings.setAutoPrint}
              onImproveChange={settings.setImproveEnabled}
              onLandscapeChange={settings.setLandscapeMode}
              onStartRecording={() => startRecording('new')}
              onStopRecording={stopRecording}
              onCancelRecording={cancelRecording}
              onIdeaSelect={pipeline.fromIdea}
            />
          )}
        </Box>
      </Box>
      <ProcessingDialog
        open={pipeline.dialogOpen}
        status={status}
        processMode={pipeline.processMode}
        prompt={pipeline.prompt}
        improveEnabled={settings.improveEnabled}
        improvedPrompt={pipeline.improvedPrompt}
        foundReferences={pipeline.foundReferences}
        imageUrl={pipeline.imageUrl}
        errorText={pipeline.errorText}
        autoPrint={settings.autoPrint}
        includeTranscribeStep={pipeline.includeTranscribeStep}
        generatingElapsedSeconds={pipeline.generatingElapsedSeconds}
        isMobile={isMobile}
        onClose={pipeline.closeDialog}
        onRetry={pipeline.retry}
      />
      <ConfigDialog
        open={configOpen}
        runtimeConfig={runtimeConfig}
        onClose={() => { setConfigOpen(false); loadConfig(); }}
        onOpenReferences={() => { setConfigOpen(false); setReferencesOpen(true); }}
      />
      <ReferencesDialog open={referencesOpen} isMobile={isMobile} onClose={() => setReferencesOpen(false)} />
      {isMobile && (
        <HistoryDialog
          open={historyOpen}
          items={printableHistory}
          onClose={() => setHistoryOpen(false)}
          onSelect={openItem}
          onShowPrompt={setPromptInfoItem}
          onDelete={setPendingDelete}
        />
      )}
      <ConfirmDeleteDialog
        item={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(item) => { setPendingDelete(null); deleteItem(item); }}
      />
      <PromptDetailsDialog
        item={promptInfoItem}
        open={!!promptInfoItem}
        canRedraw={canRecord}
        onClose={() => setPromptInfoItem(null)}
        onRedraw={(item) => {
          setPromptInfoItem(null);
          setHistoryOpen(false);
          setSelected(item);
          pipeline.redraw(item);
        }}
      />
    </Box>
  );
};
