import React, { useEffect, useRef, useState } from 'react';
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
import { Status } from './types/status';

const extractErrorMessage = (error: unknown, fallback = 'Nieznany błąd') => {
  const fromPayload = (payload: any): string | undefined => {
    if (!payload) return undefined;
    if (typeof payload === 'string') return payload;
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.message === 'string') return payload.message;
    return undefined;
  };

  const tryParseJsonMessage = (value: string): string | undefined => {
    try {
      const parsed = JSON.parse(value);
      return fromPayload(parsed);
    } catch {
      return undefined;
    }
  };

  if (typeof error === 'string') {
    return tryParseJsonMessage(error) || error;
  }
  if (error && typeof error === 'object') {
    const err = error as any;
    if (typeof err.message === 'string') {
      return tryParseJsonMessage(err.message) || err.message;
    }
  }
  return fallback;
};

export const App: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [status, setStatus] = useState<Status>('idle');
  const [processMode, setProcessMode] = useState<'full' | 'printOnly' | null>(null);
  const [prompt, setPrompt] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [previewBustToken, setPreviewBustToken] = useState<number>(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [promptInfoItem, setPromptInfoItem] = useState<HistoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [needLogin, setNeedLogin] = useState<boolean>(false);
  const [loginPw, setLoginPw] = useState<string>('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState<boolean>(false);
  const [improveEnabled, setImproveEnabled] = useState<boolean>(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('improve');
    if (v != null) return v === 'true';
    try {
      const saved = localStorage.getItem('improveEnabled');
      if (saved != null) return saved === 'true';
    } catch {}
    return false;
  });
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);
  const [foundReferences, setFoundReferences] = useState<string[] | null>(null);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('auto-print');
    if (v != null) return v === 'true';
    try {
      const saved = localStorage.getItem('autoPrint');
      if (saved != null) return saved === 'true';
    } catch {}
    return true;
  });
  const [landscapeMode, setLandscapeMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('landscapeMode');
      if (saved != null) return saved === 'true';
    } catch {}
    return false;
  });
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('sfxEnabled');
      if (v != null) return v === 'true';
    } catch {}
    return true;
  });
  const [ideasVisible, setIdeasVisible] = useState<boolean>(true);
  const [includeTranscribeStep, setIncludeTranscribeStep] = useState<boolean>(false);
  const [generatingElapsedSeconds, setGeneratingElapsedSeconds] = useState<number>(0);
  const canGenerate = runtimeConfig?.canGenerate !== false;
  const goHome = () => { window.location.href = '/'; };
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    const off = onAuthRequired(() => setNeedLogin(true));
    return off;
  }, []);

  useEffect(() => {
    api.loadConfig().finally(async () => {
      try {
        const cfg = await api.getConfig();
        setRuntimeConfig(cfg);
      } catch {}
      refreshHistory();
    });
  }, []);

  const ensureConfigLoaded = async () => {
    try {
      const cfg = await api.getConfig();
      setRuntimeConfig(cfg);
    } catch (e) {
      console.error('Load config failed', e);
    }
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('auto-print', String(autoPrint));
    sp.set('improve', String(improveEnabled));
    sp.set('landscape', String(landscapeMode));
    const url = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState({}, '', url);
    try { localStorage.setItem('autoPrint', String(autoPrint)); } catch {}
    try { localStorage.setItem('improveEnabled', String(improveEnabled)); } catch {}
    try { localStorage.setItem('landscapeMode', String(landscapeMode)); } catch {}
  }, [autoPrint, improveEnabled, landscapeMode]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const refreshHistory = async () => {
    try {
      setHistory(await api.history());
    } catch {
      /* ignore */
    }
  };

  const playTone = (freq: number, duration = 0.12) => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      o.start();
      o.stop(t0 + duration + 0.02);
    } catch {}
  };
  const sfxClick = () => { if (sfxEnabled) playTone(420, 0.08); };
  const sfxSuccess = () => { if (sfxEnabled) { playTone(660, 0.09); setTimeout(() => playTone(880, 0.12), 90); } };
  const sfxError = () => { if (sfxEnabled) { playTone(260, 0.1); setTimeout(() => playTone(200, 0.16), 110); } };

  const startRecording = async () => {
    try {
      sfxClick();
      setIdeasVisible(false);
      setIncludeTranscribeStep(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setProcessMode('full');
        setPrompt('');
        setImprovedPrompt(null);
        setStatus('transcribing');
        try {
          const { id: newId, prompt: newPrompt } = await api.transcribe(blob);
          setId(newId);
          setPrompt(newPrompt);
          let finalPrompt = newPrompt;
          if (improveEnabled) {
            setStatus('improving');
            try {
              const { improved } = await api.improve(newId, newPrompt);
              setImprovedPrompt(improved);
              finalPrompt = improved;
            } catch (e) {
              console.error('Improve failed, fallback to original prompt:', e);
              setImprovedPrompt(null);
            }
          }
          setStatus('referencing');
          let detectedReferences: string[] | undefined;
          try {
            const { references } = await api.detectReferences(newId, finalPrompt);
            detectedReferences = Array.isArray(references) && references.length > 0 ? references : undefined;
            setFoundReferences(detectedReferences || []);
          } catch (e) {
            throw e;
          }
          setStatus('generating');
          const gen = await api.generate(newId, finalPrompt, {
            landscape: landscapeMode,
            references: detectedReferences,
          });
          setImageUrl(gen.imageUrl);
          if (autoPrint) {
            setStatus('printing');
            try {
              await api.print(newId);
            } catch (e) {
              console.error('Print failed:', e);
            }
          }
          setStatus('done');
          await refreshHistory();
        } catch (e: any) {
          console.error(e);
          setErrorText(extractErrorMessage(e, 'Wystąpił błąd podczas przetwarzania.'));
          setStatus('error');
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setStatus('recording');
    } catch (e: any) {
      console.error(e);
      setErrorText('Brak uprawnień do mikrofonu lub problem z nagrywaniem.');
      setStatus('error');
      sfxError();
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null as any;
      mediaRecorderRef.current.onstop = null as any;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
  };

  useEffect(() => {
    if (status === 'idle') setIdeasVisible(true);
  }, [status]);

  const canRecord = canGenerate && (status === 'idle' || status === 'error' || status === 'done');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      const isEditable = !!(el && (el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
      if (isEditable) return;
      e.preventDefault();
      if (status === 'recording') {
        stopRecording();
      } else if (canRecord) {
        startRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, canRecord]);

  useEffect(() => { try { localStorage.setItem('sfxEnabled', String(sfxEnabled)); } catch {} }, [sfxEnabled]);

  // Timer for generating elapsed time
  useEffect(() => {
    if (status === 'generating') {
      setGeneratingElapsedSeconds(0);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setGeneratingElapsedSeconds(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setGeneratingElapsedSeconds(0);
    }
  }, [status]);

  const handleCloseDialog = async () => {
    if (status === 'done' && id) {
      const item = history.find((h) => h.id === id);
      if (item) setSelected(item);
    }
    setStatus('idle');
    setProcessMode(null);
  };

  useEffect(() => {
    if (status !== 'done') return;
    setConfettiKey(Date.now());
    sfxSuccess();
    let cancelled = false;
    (async () => {
      try {
        if (processMode !== 'printOnly') {
          if (!selected && id) {
            const existing = history.find((h) => h.id === id);
            if (existing) {
              setSelected(existing);
            } else {
              try {
                const items = await api.history();
                const item = items.find((h) => h.id === id);
                if (item && !cancelled) setSelected(item);
              } catch {}
            }
          }
        }
      } finally {
        if (!cancelled) {
          setStatus('idle');
          setProcessMode(null);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const generateFromIdea = async (text: string) => {
    try {
      const newId = String(Date.now());
      setProcessMode('full');
      setIncludeTranscribeStep(false);
      setId(newId);
      setPrompt(text);
      setImprovedPrompt(null);
      setFoundReferences(null);
      let finalPrompt = text;
      if (improveEnabled) {
        setStatus('improving');
        try {
          const { improved } = await api.improve(newId, text);
          setImprovedPrompt(improved);
          finalPrompt = improved;
        } catch {}
      }
      setStatus('referencing');
      let detectedReferences: string[] | undefined;
      try {
        const { references } = await api.detectReferences(newId, finalPrompt);
        detectedReferences = Array.isArray(references) && references.length > 0 ? references : undefined;
        setFoundReferences(detectedReferences || []);
      } catch (e) {
        throw e;
      }
      setStatus('generating');
      const gen = await api.generate(newId, finalPrompt, {
        landscape: landscapeMode,
        references: detectedReferences,
      });
      setImageUrl(gen.imageUrl);
      if (autoPrint) {
        setStatus('printing');
        try { await api.print(newId); } catch {}
      }
      setStatus('done');
      await refreshHistory();
    } catch (e: any) {
      console.error('Idea generation failed', e);
      setErrorText(extractErrorMessage(e, 'Wystąpił błąd podczas generowania.'));
      setStatus('error');
    }
  };

  const handleDeleteHistoryItem = async (item: HistoryItem) => {
    try {
      await api.remove(item.id);
      if (selected?.id === item.id) setSelected(null);
      await refreshHistory();
      setStatus((prev) => (prev === 'recording' ? prev : 'idle'));
    } catch (err) {
      console.error('Delete failed:', err);
      setStatus('error');
    }
  };

  const handleRegenerateSelected = async (item: HistoryItem) => {
    try {
      setIncludeTranscribeStep(false);
      setProcessMode('full');
      setStatus('generating');
      setPrompt(item.prompt);
      const newId = String(Date.now());
      const gen = await api.generate(newId, item.prompt, {
        landscape: landscapeMode,
        references: Array.isArray(item.references) && item.references.length > 0 ? item.references : undefined,
      });
      setImageUrl(gen.imageUrl);
      await refreshHistory();
      const updated = (await api.history()).find((i) => i.id === newId);
      if (updated) setSelected(updated);
      setPreviewBustToken(Date.now());
      setStatus('done');
    } catch (e) {
      console.error('Regenerate failed:', e);
      setStatus('error');
    }
  };

  const handlePrintHistoryItem = async (item: HistoryItem) => {
    try {
      setProcessMode('printOnly');
      setId(item.id);
      setStatus('printing');
      await api.print(item.id);
      setStatus('done');
      await refreshHistory();
    } catch (e) {
      console.error('Print failed:', e);
      setStatus('error');
    }
  };

  const handleRetry = async () => {
    if (!prompt || !id) return;
    try {
      setErrorText(null);
      setImprovedPrompt(null);
      setFoundReferences(null);
      let finalPrompt = prompt;
      if (improveEnabled) {
        setStatus('improving');
        try {
          const { improved } = await api.improve(id, prompt);
          setImprovedPrompt(improved);
          finalPrompt = improved;
        } catch (e) {
          console.error('Improve failed, fallback to original prompt:', e);
          setImprovedPrompt(null);
        }
      }
      setStatus('referencing');
      let detectedReferences: string[] | undefined;
      try {
        const { references } = await api.detectReferences(id, finalPrompt);
        detectedReferences = Array.isArray(references) && references.length > 0 ? references : undefined;
        setFoundReferences(detectedReferences || []);
      } catch (e) {
        throw e;
      }
      setStatus('generating');
      const gen = await api.generate(id, finalPrompt, {
        landscape: landscapeMode,
        references: detectedReferences,
      });
      setImageUrl(gen.imageUrl);
      if (autoPrint) {
        setStatus('printing');
        try {
          await api.print(id);
        } catch (e) {
          console.error('Print failed:', e);
        }
      }
      setStatus('done');
      await refreshHistory();
    } catch (e: any) {
      console.error('Retry failed', e);
      setErrorText(extractErrorMessage(e, 'Wystąpił błąd podczas przetwarzania.'));
      setStatus('error');
      sfxError();
    }
  };

  const handleLoginSubmit = async () => {
    setLoginErr(null);
    setLoginBusy(true);
    try {
      await auth.login(loginPw);
      setNeedLogin(false);
      setLoginPw('');
      api.loadConfig().finally(async () => {
        try { const cfg = await api.getConfig(); setRuntimeConfig(cfg); } catch {}
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
  const processingOpen = status !== 'idle' && status !== 'recording';

  if (runtimeConfig && runtimeConfig.missingEnv && runtimeConfig.missingEnv.length > 0) {
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

  return (
    <Box sx={{ display: 'flex', height: '100dvh', position: 'relative', width: '100%', overflowX: 'hidden' }}>
      <AnimatedBackground />
      <Confetti triggerKey={confettiKey} />
      <AppHeader
        isMobile={isMobile}
        sfxEnabled={sfxEnabled}
        onToggleSfx={setSfxEnabled}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenConfig={async () => { await ensureConfigLoaded(); setConfigOpen(true); }}
        onOpenReferences={() => setReferencesOpen(true)}
        onGoHome={goHome}
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pt: { xs: 7, sm: 8 }, position: 'relative', zIndex: 1 }}>
        {!isMobile && (
          <HistorySidebar
            items={printableHistory}
            selectedId={selected?.id}
            onSelect={(item) => item.imageUrl && setSelected(item)}
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
          {selected && status !== 'recording' ? (
            <SelectedPreview
              item={selected}
              isMobile={isMobile}
              previewBustToken={previewBustToken}
              status={status}
              onClose={() => setSelected(null)}
              onRegenerate={() => handleRegenerateSelected(selected)}
              onPrint={() => handlePrintHistoryItem(selected)}
              onDelete={() => setPendingDelete(selected)}
            />
          ) : (
            <RecordingControls
              status={status}
              isMobile={isMobile}
              canRecord={canRecord}
              autoPrint={autoPrint}
              improveEnabled={improveEnabled}
              landscapeMode={landscapeMode}
              ideasVisible={ideasVisible}
              onAutoPrintChange={setAutoPrint}
              onImproveChange={setImproveEnabled}
              onLandscapeChange={setLandscapeMode}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onCancelRecording={cancelRecording}
              onIdeaSelect={generateFromIdea}
            />
          )}
        </Box>
      </Box>
      <ProcessingDialog
        open={processingOpen}
        status={status}
        processMode={processMode}
        prompt={prompt}
        improveEnabled={improveEnabled}
        improvedPrompt={improvedPrompt}
        foundReferences={foundReferences}
        imageUrl={imageUrl}
        errorText={errorText}
        autoPrint={autoPrint}
        includeTranscribeStep={includeTranscribeStep}
        generatingElapsedSeconds={generatingElapsedSeconds}
        isMobile={isMobile}
        onClose={handleCloseDialog}
        onRetry={handleRetry}
      />
      <ConfigDialog
        open={configOpen}
        runtimeConfig={runtimeConfig}
        onClose={() => { setConfigOpen(false); ensureConfigLoaded(); }}
        onOpenReferences={() => { setConfigOpen(false); setReferencesOpen(true); }}
      />
      <ReferencesDialog open={referencesOpen} isMobile={isMobile} onClose={() => setReferencesOpen(false)} />
      {isMobile && (
        <HistoryDialog
          open={historyOpen}
          items={printableHistory}
          onClose={() => setHistoryOpen(false)}
          onSelect={(item) => item.imageUrl && setSelected(item)}
          onShowPrompt={setPromptInfoItem}
          onDelete={setPendingDelete}
        />
      )}
      <ConfirmDeleteDialog
        item={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(item) => { setPendingDelete(null); handleDeleteHistoryItem(item); }}
      />
      <PromptDetailsDialog item={promptInfoItem} open={!!promptInfoItem} onClose={() => setPromptInfoItem(null)} />
    </Box>
  );
};
