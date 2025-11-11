import React, { useEffect, useRef, useState } from 'react';
import { api, HistoryItem, type RuntimeConfig } from './api/client';
import { auth, onAuthRequired } from './api/auth';
  import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    Link,
    List,
    ListItem,
    ListItemText,
    Divider,
    Stack,
    Button,
    Fab,
    Switch,
    FormControlLabel,
    Tooltip,
    IconButton,
    TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
      Alert,
  } from '@mui/material';
  import MicIcon from '@mui/icons-material/Mic';
  import PrintIcon from '@mui/icons-material/Print';
  import CloseIcon from '@mui/icons-material/Close';
  import AutorenewIcon from '@mui/icons-material/Autorenew';
  import DeleteIcon from '@mui/icons-material/Delete';
  import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
  import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
  import HighQualityIcon from '@mui/icons-material/HighQuality';
  import { keyframes } from '@mui/system';
  import HistoryIcon from '@mui/icons-material/History';
  import { useTheme } from '@mui/material/styles';
  import useMediaQuery from '@mui/material/useMediaQuery';
  import BrushIcon from '@mui/icons-material/Brush';
  import CelebrationIcon from '@mui/icons-material/Celebration';
  import { AnimatedBackground } from './components/AnimatedBackground';
  import { Confetti } from './components/Confetti';
  import { Mascot } from './components/Mascot';
  import MusicNoteIcon from '@mui/icons-material/MusicNote';
  import VolumeOffIcon from '@mui/icons-material/VolumeOff';

type Status = 'idle' | 'recording' | 'transcribing' | 'improving' | 'generating' | 'printing' | 'done' | 'error';

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
  const [promptInfoItem, setPromptInfoItem] = useState<HistoryItem | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [needLogin, setNeedLogin] = useState<boolean>(false);
  const [loginPw, setLoginPw] = useState<string>('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState<boolean>(false);
  const canGenerate = runtimeConfig?.canGenerate !== false;
  // AI improve switch synced with URL param `improve` and persisted
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
  // Auto print state synced with URL param `auto-print` and persisted to localStorage
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
  // Force high quality override switch (only visible if default is not 'high')
  const [forceHighQuality, setForceHighQuality] = useState<boolean>(() => {
    try { const saved = localStorage.getItem('forceHighQuality'); if (saved != null) return saved === 'true'; } catch {}
    return false;
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    const off = onAuthRequired(() => setNeedLogin(true));
    return off;
  }, []);

  useEffect(() => {
    // Load runtime config (timeouts) then fetch history
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

  // Keep URL and localStorage in sync with autoPrint state
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('auto-print', String(autoPrint));
    sp.set('improve', String(improveEnabled));
    sp.set('hq', String(forceHighQuality));
    const url = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState({}, '', url);
    try { localStorage.setItem('autoPrint', String(autoPrint)); } catch {}
    try { localStorage.setItem('improveEnabled', String(improveEnabled)); } catch {}
    try { localStorage.setItem('forceHighQuality', String(forceHighQuality)); } catch {}
  }, [autoPrint, improveEnabled, forceHighQuality]);

  // Close preview with ESC key
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const refreshHistory = async () => {
    try { setHistory(await api.history()); } catch { /* ignore */ }
  };

  // Lightweight SFX (no external assets)
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
        // If recording was cancelled, do not process anything.
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setProcessMode('full');
        // Clear previous prompt so the dialog doesn't show stale text
        setPrompt('');
        setImprovedPrompt(null);
        setStatus('transcribing');
        try {
          const { id, prompt } = await api.transcribe(blob);
          setId(id);
          setPrompt(prompt);
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
          setStatus('generating');
          const gen = await api.generate(id, finalPrompt, { forceHighQuality });
          setImageUrl(gen.imageUrl);
          if (autoPrint) {
            setStatus('printing');
            try {
              await api.print(id);
            } catch (e) {
              console.error('Print failed:', e);
              // Continue to done even if printing fails, image is ready
            }
          }
          setStatus('done');
          await refreshHistory();
        } catch (e: any) {
          console.error(e);
          setErrorText(e?.message || 'Wystąpił błąd podczas przetwarzania.');
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
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
  };

  const cancelRecording = () => {
    // Mark as cancelled so onstop handler is ignored
    cancelledRef.current = true;
    if (mediaRecorderRef.current) {
      // Detach handlers and stop gracefully
      mediaRecorderRef.current.ondataavailable = null as any;
      mediaRecorderRef.current.onstop = null as any;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
  };

  // When returning to idle, show ideas again
  useEffect(() => {
    if (status === 'idle') setIdeasVisible(true);
  }, [status]);

  // Can start recording?
  const canRecord = canGenerate && (status === 'idle' || status === 'error' || status === 'done');

  // Spacebar control: toggle recording (start/stop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      // Avoid when typing in inputs or editable elements
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      const isEditable = !!(el && (el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
      if (isEditable) return;
      // Prevent page scroll
      e.preventDefault();
      if (status === 'recording') {
        stopRecording();
      } else if (canRecord) {
        // Only start if not already busy
        startRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, canRecord]);

  const pulse = keyframes`
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,71,111, 0.4); }
    70% { transform: scale(1.04); box-shadow: 0 0 0 18px rgba(239,71,111, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,71,111, 0); }
  `;
  const recordPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(239,71,111, 0.55); transform: scale(1); }
    60% { box-shadow: 0 0 0 12px rgba(239,71,111, 0); transform: scale(1.03); }
    100% { box-shadow: 0 0 0 0 rgba(239,71,111, 0); transform: scale(1); }
  `;
  const wave = keyframes`
    0% { transform: scaleY(0.4); }
    50% { transform: scaleY(1); }
    100% { transform: scaleY(0.4); }
  `;

  const wiggle = keyframes`
    0% { transform: rotate(0deg) translateY(0); }
    30% { transform: rotate(-8deg) translateY(1px); }
    60% { transform: rotate(6deg) translateY(-1px); }
    100% { transform: rotate(0deg) translateY(0); }
  `;

  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    try { const v = localStorage.getItem('sfxEnabled'); if (v != null) return v === 'true'; } catch {}
    return true;
  });
  const [tipsEnabled, setTipsEnabled] = useState<boolean>(() => {
    try { const v = localStorage.getItem('kidTips'); if (v != null) return v === 'true'; } catch {}
    return true;
  });
  const [ideasVisible, setIdeasVisible] = useState<boolean>(true);
  // Geometry for suggestion ring on different screen sizes
  const [ring, setRing] = useState<{ radius: number; item: number; emoji: number }>(() => ({
    radius: isMobile ? 150 : 200,
    item: isMobile ? 72 : 88,
    emoji: isMobile ? 30 : 34,
  }));
  useEffect(() => {
    const recalc = () => {
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      const baseR = isMobile ? 150 : 200;
      const item = minDim < 360 ? (isMobile ? 56 : 72) : (isMobile ? 72 : 88);
      const padding = 16; // keep inside viewport
      const maxR = Math.floor(minDim / 2) - Math.floor(item / 2) - padding;
      const radius = Math.max(80, Math.min(baseR, maxR));
      const emoji = item <= 56 ? (isMobile ? 22 : 26) : (isMobile ? 30 : 34);
      setRing({ radius, item, emoji });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [isMobile]);
  // Whether to show the Transkrypcja step in the modal for this run
  const [includeTranscribeStep, setIncludeTranscribeStep] = useState<boolean>(false);
  // Persist child-friendly toggles (place after state declarations)
  useEffect(() => { try { localStorage.setItem('sfxEnabled', String(sfxEnabled)); } catch {} }, [sfxEnabled]);
  useEffect(() => { try { localStorage.setItem('kidTips', String(tipsEnabled)); } catch {} }, [tipsEnabled]);

  const steps = processMode === 'printOnly'
    ? ['Drukowanie']
    : (() => {
      const arr: string[] = [];
      if (includeTranscribeStep) arr.push('Transkrypcja');
      if (improveEnabled) arr.push('Ulepszanie promptu');
      arr.push('Generowanie obrazu');
      if (autoPrint) arr.push('Drukowanie');
      return arr;
    })();
  const activeStep = processMode === 'printOnly'
    ? (status === 'printing' ? 0 : steps.length)
    : (() => {
      let i = 0;
      const idx = {
        transcribing: includeTranscribeStep ? i++ : -1,
        improving: improveEnabled ? (includeTranscribeStep ? i++ : i++) : -1,
        generating: (includeTranscribeStep ? (improveEnabled ? i : i) : (improveEnabled ? i : i)),
        printing: -1 as number,
      };
      // adjust generating index
      idx.generating = i++;
      if (autoPrint) idx.printing = i++;

      if (status === 'transcribing' && idx.transcribing >= 0) return idx.transcribing;
      if (status === 'improving' && idx.improving >= 0) return idx.improving;
      if (status === 'generating') return idx.generating;
      if (status === 'printing' && idx.printing >= 0) return idx.printing;
      return steps.length;
    })();

  const handleCloseDialog = async () => {
    if (status === 'done' && id) {
      const item = history.find((h) => h.id === id);
      if (item) setSelected(item);
    }
    setStatus('idle');
    setProcessMode(null);
  };

  // Auto-close modal and open image after all steps finish
  useEffect(() => {
    if (status !== 'done') return;
    setConfettiKey(Date.now());
    sfxSuccess();
    let cancelled = false;
    (async () => {
      try {
        if (processMode !== 'printOnly') {
          if (!selected && id) {
            // Prefer existing state, else fetch freshly
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

  // Quick ideas generator function
  const generateFromIdea = async (text: string) => {
    try {
      const newId = String(Date.now());
      setProcessMode('full');
      setIncludeTranscribeStep(false);
      setId(newId);
      setPrompt(text);
      setImprovedPrompt(null);
      let finalPrompt = text;
      if (improveEnabled) {
        setStatus('improving');
        try {
          const { improved } = await api.improve(newId, text);
          setImprovedPrompt(improved);
          finalPrompt = improved;
        } catch {}
      }
      setStatus('generating');
      const gen = await api.generate(newId, finalPrompt, { forceHighQuality });
      setImageUrl(gen.imageUrl);
      if (autoPrint) {
        setStatus('printing');
        try { await api.print(newId); } catch {}
      }
      setStatus('done');
      await refreshHistory();
    } catch (e: any) {
      console.error('Idea generation failed', e);
      setErrorText(e?.message || 'Wystąpił błąd podczas generowania.');
      setStatus('error');
    }
  };

  // Show ONLY the config error screen if env is missing
  if (runtimeConfig && runtimeConfig.missingEnv && runtimeConfig.missingEnv.length > 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', p: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 900 }}>
          <Alert severity={canGenerate ? 'warning' : 'error'} sx={{ p: 3, '& .MuiAlert-message': { width: '100%' } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Brakuje konfiguracji środowiska
            </Typography>
            <Typography variant="body1" sx={{ mb: 1.5 }}>
              Brakujące zmienne:
            </Typography>
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {runtimeConfig.missingEnv.join(', ')}
            </Box>
            {!canGenerate && (
              <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 600 }}>
                Generowanie kolorowanek jest zablokowane do czasu uzupełnienia konfiguracji.
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Uzupełnij zmienne środowiskowe i zrestartuj backend.
            </Typography>
          </Alert>
        </Box>
      </Box>
    );
  }

  // Login overlay when backend requires auth
  if (needLogin) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100dvh', p: 2, bgcolor: 'background.default' }}>
        <Box sx={{ width: '100%', maxWidth: 420, bgcolor: 'background.paper', p: 3, borderRadius: 2, boxShadow: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Wymagane logowanie</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Podaj hasło aby uzyskać dostęp.</Typography>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoginErr(null);
            setLoginBusy(true);
            try {
              await auth.login(loginPw);
              setNeedLogin(false);
              setLoginPw('');
              // After login, load config and history
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
          }}>
            <TextField
              type="password"
              label="Hasło"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              autoFocus
              fullWidth
              disabled={loginBusy}
            />
            {loginErr && (
              <Alert severity="error" sx={{ mt: 1.5 }}>{loginErr}</Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" disabled={loginBusy} fullWidth>
                {loginBusy ? 'Logowanie…' : 'Zaloguj'}
              </Button>
            </Stack>
          </form>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100dvh', position: 'relative' }}>
      <AnimatedBackground />
      <Confetti triggerKey={confettiKey} />
      <AppBar position="fixed" color="primary" elevation={1}>
        <Toolbar>
          {isMobile && (
            <Tooltip title="Historia" arrow>
              <IconButton edge="start" color="inherit" onClick={() => setHistoryOpen(true)} aria-label="Historia" sx={{ mr: 1 }}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          )}
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, lineHeight: { xs: 1.15, sm: 1.2 }, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Box component="span" sx={{ color: 'common.white', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>Kolorowanki</Box>
            <BrushIcon sx={{ fontSize: 22, animation: `${wiggle} 2.4s ease-in-out infinite`, transformOrigin: 'bottom center' }} />
          </Typography>
          {/* Unified icon-over-switch controls */}
          {(() => {
            // Both switches now share the same default style as the AI improve switch
            return (
              <>
                {runtimeConfig?.openaiImageQuality?.toLowerCase?.() !== 'high' && (
                  <Tooltip title={forceHighQuality ? 'Wysoka jakość wymuszona' : 'Domyślna jakość z konfiguracji'} arrow>
                    <Box sx={{ ml: 2, pt: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <HighQualityIcon fontSize="small" sx={{ color: 'common.white', mt: 1, mb: 0 }} />
                      <Switch
                        checked={forceHighQuality}
                        onChange={(e) => setForceHighQuality(e.target.checked)}
                        color={forceHighQuality ? 'success' : 'default'}
                        inputProps={{ 'aria-label': 'Wysoka jakość' }}
                      />
                    </Box>
                  </Tooltip>
                )}
                <Tooltip title={autoPrint ? 'Automatyczne drukowanie włączone' : 'Kolorowanki nie będą drukowane automatycznie'} arrow>
                  <Box sx={{ ml: 1.5, pt: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <PrintIcon fontSize="small" sx={{ color: 'common.white', mt: 1, mb: 0 }} />
                    <Switch
                      checked={autoPrint}
                      onChange={(e) => setAutoPrint(e.target.checked)}
                      color={autoPrint ? 'success' : 'default'}
                      inputProps={{ 'aria-label': 'Automatyczne drukowanie' }}
                    />
                  </Box>
                </Tooltip>
                <Tooltip title={improveEnabled ? 'Ulepszanie promptu włączone' : 'Wysyłaj oryginalny prompt'} arrow>
                  <Box sx={{ ml: 1.5, pt: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <AutoAwesomeIcon fontSize="small" sx={{ color: 'common.white', mt: 1, mb: 0 }} />
                    <Switch
                      checked={improveEnabled}
                      onChange={(e) => setImproveEnabled(e.target.checked)}
                      color={improveEnabled ? 'success' : 'default'}
                      inputProps={{ 'aria-label': 'Ulepszanie promptu' }}
                    />
                  </Box>
                </Tooltip>
                <Tooltip title={sfxEnabled ? 'Dźwięki włączone' : 'Dźwięki wyłączone'} arrow>
                  <IconButton
                    size="small"
                    sx={{ ml: 1.5, color: 'common.white' }}
                    onClick={() => setSfxEnabled(v => !v)}
                    aria-label="Dźwięki"
                  >
                    {sfxEnabled ? <MusicNoteIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Konfiguracja" arrow>
                  <IconButton
                    size="small"
                    sx={{ ml: 1.5, color: 'common.white' }}
                    onClick={async () => { await ensureConfigLoaded(); setConfigOpen(true); }}
                    aria-label="Konfiguracja"
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            );
          })()}
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pt: { xs: 7, sm: 8 }, position: 'relative', zIndex: 1 }}>
        {/* Główny interfejs renderowany tylko gdy konfiguracja jest kompletna */}
        {!isMobile && (
        <Box component="aside" sx={{ width: 480, borderRight: 1, borderColor: 'divider', p: 2, overflow: 'auto' }}>
          <List dense>
            {history.filter(item => !!item.imageUrl).map(item => (
              <React.Fragment key={item.id}>
                <ListItem
                  disableGutters
                  alignItems="flex-start"
                  onClick={() => item.imageUrl && setSelected(item)}
                  sx={{ cursor: item.imageUrl ? 'pointer' : 'default', bgcolor: selected?.id === item.id ? 'action.selected' : undefined, px: 1 }}
                >
                  <ListItemText
                    primaryTypographyProps={{ variant: 'subtitle1' }}
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, gap: 1 }}>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {(item.prompt || item.improvedPrompt) && (
                            <Tooltip title="Prompt" arrow>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPromptInfoItem(item);
                                }}
                                sx={{ p: 0.25, bgcolor: 'common.white', color: 'info.main', '&:hover': { bgcolor: 'grey.100' } }}
                                aria-label="Prompt"
                              >
                                <InfoOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Usuń kolorowankę">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await api.remove(item.id);
                                  if (selected?.id === item.id) setSelected(null);
                                  await refreshHistory();
                                } catch (err) {
                                  console.error('Delete failed:', err);
                                  setStatus('error');
                                }
                              }}
                              sx={{ p: 0.25, bgcolor: 'common.white', color: 'error.main', '&:hover': { bgcolor: 'grey.100' } }}
                              aria-label="Usuń"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <>
                        {item.imageUrl && (
                          <Box sx={{ mt: 1, borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'scale(1.02) rotate(-0.2deg)', boxShadow: '0 10px 24px rgba(0,0,0,0.10)' } }}>
                            <Box component="img" src={item.imageUrl} alt="podgląd" loading="lazy" decoding="async" sx={{ width: '100%', height: 'auto', display: 'block' }} />
                          </Box>
                        )}
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        </Box>
        )}

        <Box component="main" sx={{ flex: 1, position: 'relative', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(selected && status !== 'recording') ? (
            <Box sx={{ display: 'flex', width: '100%', height: '100%', gap: 2 }}>
              {/* Image area on the left (bigger) */}
              {selected.imageUrl && (
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pb: { xs: 8, sm: 0 } }}>
                  <Box
                    component="img"
                    src={`${selected.imageUrl}?t=${previewBustToken}`}
                    alt={selected.prompt}
                    loading="eager"
                    decoding="async"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
                      position: 'relative',
                      outline: '3px dashed rgba(251,133,0,0.25)',
                      outlineOffset: 6,
                    }}
                  />
                </Box>
              )}

              {/* Actions: vertical on desktop, bottom bar on mobile */}
              {!isMobile ? (
                <Box sx={{ width: 64, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Tooltip title="Zamknij podgląd">
                    <IconButton
                      onClick={() => setSelected(null)}
                      sx={{ bgcolor: 'common.black', color: 'common.white', boxShadow: 1, '&:hover': { bgcolor: 'grey.800' } }}
                      aria-label="Zamknij"
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                  {selected.imageUrl && (
                    <Tooltip title="Wygeneruj ponownie">
                      <IconButton
                        onClick={async () => {
                          try {
                            setIncludeTranscribeStep(false);
                            setProcessMode('full');
                            setStatus('generating');
                            setPrompt(selected.prompt);
                            const newId = String(Date.now());
                            const gen = await api.generate(newId, selected.prompt, { forceHighQuality });
                            setImageUrl(gen.imageUrl);
                            await refreshHistory();
                            const updated = (await api.history()).find(i => i.id === newId);
                            if (updated) setSelected(updated);
                            setPreviewBustToken(Date.now());
                            setStatus('done');
                          } catch (e) {
                            console.error('Regenerate failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'info.main', color: 'common.white', boxShadow: 1, '&:hover': { bgcolor: 'info.dark' } }}
                        aria-label="Wygeneruj ponownie"
                        disabled={!(status === 'idle' || status === 'done' || status === 'error')}
                      >
                        <AutorenewIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {selected.imageUrl && (
                    <Tooltip title="Drukuj kolorowankę">
                      <IconButton
                        onClick={async () => {
                          try {
                            setProcessMode('printOnly');
                            setId(selected.id);
                            setStatus('printing');
                            await api.print(selected.id);
                            setStatus('done');
                            await refreshHistory();
                          } catch (e) {
                            console.error('Print failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'success.main', color: 'common.white', boxShadow: 1, '&:hover': { bgcolor: 'success.dark' } }}
                        aria-label="Drukuj"
                        disabled={!(status === 'idle' || status === 'done' || status === 'error')}
                      >
                        <PrintIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {selected && (
                    <Tooltip title="Usuń kolorowankę">
                      <IconButton
                        onClick={async () => {
                          try {
                            await api.remove(selected.id);
                            setSelected(null);
                            await refreshHistory();
                            setStatus('idle');
                          } catch (e) {
                            console.error('Delete failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'error.main', color: 'common.white', boxShadow: 1, '&:hover': { bgcolor: 'error.dark' } }}
                        aria-label="Usuń"
                        disabled={!(status === 'idle' || status === 'done' || status === 'error')}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ) : (
                <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 12, display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Tooltip title="Zamknij podgląd">
                    <IconButton onClick={() => setSelected(null)} sx={{ bgcolor: 'common.black', color: 'common.white', boxShadow: 2 }} aria-label="Zamknij">
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                  {selected.imageUrl && (
                    <Tooltip title="Wygeneruj ponownie">
                      <IconButton
                        onClick={async () => {
                          try {
                            setIncludeTranscribeStep(false);
                            setProcessMode('full');
                            setStatus('generating');
                            setPrompt(selected.prompt);
                            const newId = String(Date.now());
                            const gen = await api.generate(newId, selected.prompt, { forceHighQuality });
                            setImageUrl(gen.imageUrl);
                            await refreshHistory();
                            const updated = (await api.history()).find(i => i.id === newId);
                            if (updated) setSelected(updated);
                            setPreviewBustToken(Date.now());
                            setStatus('done');
                          } catch (e) {
                            console.error('Regenerate failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'info.main', color: 'common.white', boxShadow: 2 }}
                        aria-label="Wygeneruj ponownie"
                      >
                        <AutorenewIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {selected.id && (
                    <Tooltip title="Drukuj">
                      <IconButton
                        onClick={async () => {
                          try {
                            setProcessMode('printOnly');
                            setId(selected.id);
                            setStatus('printing');
                            await api.print(selected.id);
                            setStatus('done');
                            await refreshHistory();
                          } catch (e) {
                            console.error('Print failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'success.main', color: 'common.white', boxShadow: 2 }}
                        aria-label="Drukuj"
                        disabled={!(status === 'idle' || status === 'done' || status === 'error')}
                      >
                        <PrintIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {selected && (
                    <Tooltip title="Usuń kolorowankę">
                      <IconButton
                        onClick={async () => {
                          try {
                            await api.remove(selected.id);
                            setSelected(null);
                            await refreshHistory();
                            setStatus('idle');
                          } catch (e) {
                            console.error('Delete failed:', e);
                            setStatus('error');
                          }
                        }}
                        sx={{ bgcolor: 'error.main', color: 'common.white', boxShadow: 2 }}
                        aria-label="Usuń"
                        disabled={!(status === 'idle' || status === 'done' || status === 'error')}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Stack spacing={2} alignItems="center">
              <Box sx={{ position: 'relative', display: 'inline-grid' }}>
                {/* Mic button */}
                <Fab
                aria-label="Nagraj prompt głosowy"
                color="error"
                size="large"
                sx={{
                  width: { xs: 96, sm: 168 },
                  height: { xs: 96, sm: 168 },
                  animation: status === 'recording' ? `${recordPulse} 1.4s ease-in-out infinite` : (canRecord ? `${pulse} 1.8s ease-in-out infinite` : 'none'),
                  '&.Mui-disabled': {
                    bgcolor: 'error.main',
                    color: 'common.white',
                    opacity: 1,
                  },
                }}
                disabled={!canRecord}
                onClick={canRecord ? startRecording : undefined}
              >
                <MicIcon sx={{ fontSize: { xs: 36, sm: 56 } }} />
                </Fab>

                {/* Idea icons around mic (emoji-only) */}
                {ideasVisible && status === 'idle' && (() => {
                  const catalog = [
                    { icon: '🌈', label: 'Tęcze', prompt: 'Tęcze z 7 paskami na kazdy kolor' },
                    { icon: '🦄', label: 'Jednorożce', prompt: 'Jednorożce w magicznym lesie' },
                    { icon: '🦁', label: 'Zwierzęta w zoo', prompt: 'Lew, żyrafa i słoń w zoo' },
                    { icon: '🐶', label: 'Pieski', prompt: 'Pieski bawiące się piłką' },
                    { icon: '🐱', label: 'Kotki', prompt: 'Kotki śpiące na poduszkach' },
                    { icon: '👗', label: 'Lalki', prompt: 'Lalki w stylu Barbie w modnych strojach i z długimi włosami' },
                    { icon: '🚗', label: 'Samochody', prompt: 'Samochody wyścigowe na torze' },
                    { icon: '🚀', label: 'Rakiety', prompt: 'Rakiety lecące w kosmos, planety i gwiazdy' },
                    { icon: '🦸‍♀️', label: 'Superbohaterowie', prompt: 'Superbohaterowie w akcji w dynamicznych pozach' },
                    { icon: '🧚‍♀️', label: 'Wróżki', prompt: 'Bajkowe wróżki z różdżkami' },
                    { icon: '🐯', label: 'Tygryski', prompt: 'Przyjazne tygryski w dżungli' },
                    { icon: '🦓', label: 'Zebry', prompt: 'Zebra na sawannie' },
                    { icon: '🦒', label: 'Żyrafy', prompt: 'Żyrafa pod drzewem akacji' },
                    { icon: '🐘', label: 'Słonie', prompt: 'Słoń z trąbą unoszącą wodę' },
                    { icon: '🐵', label: 'Małpki', prompt: 'Wesołe małpki na lianach' },
                    { icon: '🐸', label: 'Żabki', prompt: 'Żabka na liściu nenufaru' },
                    { icon: '🐢', label: 'Żółwie', prompt: 'Żółw na plaży' },
                    { icon: '🐳', label: 'Ocean', prompt: 'Podwodny świat z wielorybem i rybkami' },
                    { icon: '🦕', label: 'Dinozaury', prompt: 'Przyjazne dinozaury w parku' },
                    { icon: '🏰', label: 'Zamki', prompt: 'Bajkowy zamek na wzgórzu' },
                    { icon: '👸', label: 'Księżniczki', prompt: 'Księżniczka w sukni balowej' },
                    { icon: '🤴', label: 'Książęta', prompt: 'Książę z mieczem, uśmiechnięty' },
                    { icon: '🪖', label: 'Żołnierzyki', prompt: 'Zabawkowe żołnierzyki na paradzie z flagami' },
                    { icon: '🐉', label: 'Smoki', prompt: 'Przyjazny smok nad wioską' },
                    { icon: '🧜‍♀️', label: 'Syrenki', prompt: 'Syrenka w morzu, muszelki i rybki' },
                    { icon: '🦋', label: 'Motyle', prompt: 'Motyle nad łąką' },
                    { icon: '🌸', label: 'Kwiaty', prompt: 'Różne kwiaty w ogrodzie' },
                    { icon: '🌵', label: 'Pustynia', prompt: 'Kaktusy i zachód słońca' },
                    { icon: '🌲', label: 'Las', prompt: 'Leśne zwierzątka i drzewa' },
                    { icon: '🏖️', label: 'Plaża', prompt: 'Plaża z zamkiem z piasku, wiaderkiem i łopatką' },
                    { icon: '🏜️', label: 'Kaniony', prompt: 'Skaliste kaniony i słońce' },
                    { icon: '🏞️', label: 'Góry', prompt: 'Góry, rzeka i sosny' },
                    { icon: '🚌', label: 'Autobus', prompt: 'Wesoły szkolny autobus' },
                    { icon: '🚒', label: 'Straż', prompt: 'Wóz strażacki w akcji (bez ognia)' },
                    { icon: '🚑', label: 'Karetka', prompt: 'Karetka z uśmiechniętym kierowcą' },
                    { icon: '✈️', label: 'Samoloty', prompt: 'Samolot nad chmurami' },
                    { icon: '🚂', label: 'Pociągi', prompt: 'Lokomotywa na torach' },
                    { icon: '🚲', label: 'Rowerki', prompt: 'Dziecięcy rowerek w parku' },
                    { icon: '🛵', label: 'Skutery', prompt: 'Skuter w mieście' },
                    { icon: '🧩', label: 'Kształty', prompt: 'Duże proste kształty geometryczne' },
                    { icon: '🎈', label: 'Balony', prompt: 'Mnóstwo balonów nad miasteczkiem' },
                    { icon: '🎠', label: 'Karuzela', prompt: 'Karuzela z konikami' },
                    { icon: '🎪', label: 'Cyrk', prompt: 'Cyrkowy namiot i przyjazny klaun' },
                    { icon: '🎃', label: 'Dynia', prompt: 'Uśmiechnięte dynie i jesienne liście' },
                    { icon: '❄️', label: 'Zima', prompt: 'Bałwan i śnieżynki' },
                    { icon: '🌞', label: 'Lato', prompt: 'Słońce, plaża i lody' },
                    { icon: '🌧️', label: 'Deszcz', prompt: 'Parasolka i kałuże' },
                    { icon: '🪐', label: 'Planety', prompt: 'Układ słoneczny: planety i gwiazdy' },
                    { icon: '🧁', label: 'Słodkości', prompt: 'Babeczki i cukierki' },
                    { icon: '🍕', label: 'Pizza', prompt: 'Wesoła pizza z uśmiechem' },
                    { icon: '🍦', label: 'Lody', prompt: 'Pucharek lodów z posypką' },
                    { icon: '🏀', label: 'Sport', prompt: 'Piłki sportowe: koszykówka i piłka nożna' },
                    { icon: '🎸', label: 'Muzyka', prompt: 'Instrumenty muzyczne' },
                    { icon: '🧱', label: 'Klocki', prompt: 'Wieża z klocków' },
                    // zawsze dostępne „Losowa”
                    { icon: '🎲', label: 'Losowa kolorowanka — zaskocz mnie', random: true },
                  ] as const;
                  // losowy wybór 9 z katalogu (bez pozycji losowej) + zawsze „Losowa”
                  const pool = catalog.filter((it: any) => !it.random);
                  const randomItem = catalog.find((it: any) => it.random)!;
                  const shuffled = [...pool].sort(() => Math.random() - 0.5);
                  const items = [...shuffled.slice(0, 9), randomItem];
                  const radius = ring.radius;
                  return (
                    <>
                      {/* Spinning ring wrapper (very slow); pauses on hover */}
                      <Box sx={{ position: 'absolute', inset: 0, transformOrigin: '50% 50%', animation: 'slowSpin 80s linear infinite', '&:hover': { animationPlayState: 'paused' }, '&:hover *': { animationPlayState: 'paused' } }}>
                      {items.map((it, idx) => {
                        const angle = (idx / items.length) * Math.PI * 2 - Math.PI / 2; // start at top
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        return (
                          <Tooltip key={`${it.label}-${idx}`} title={it.label} arrow>
                          <Box
                            onClick={() => {
                              const prompt = (it as any).random
                                ? 'Wymyśl dla dziecka kreatywną scenę — losowy temat'
                                : (it as any).prompt;
                              generateFromIdea(prompt);
                            }}
                            role="button"
                            aria-label={`Pomysł: ${it.label}`}
                            sx={{
                              position: 'absolute',
                              left: `calc(50% + ${x}px)`,
                              top: `calc(50% + ${y}px)`,
                              transform: 'translate(-50%, -50%)',
                              width: ring.item,
                              height: ring.item,
                              borderRadius: '50%',
                              bgcolor: '#FFB703',
                              color: 'primary.contrastText',
                              opacity: 0.7,
                              boxShadow: 2,
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'transform .12s ease, box-shadow .2s ease, opacity .12s ease',
                              '&:hover': { transform: 'translate(-50%, -50%) scale(1.06)', boxShadow: 4, opacity: 1 },
                              '&:active': { transform: 'translate(-50%, -50%) scale(0.96)' },
                            }}
                           >
                             <Box sx={{ fontSize: ring.emoji, lineHeight: 1, animation: 'slowSpinReverse 80s linear infinite' }} component="span">{it.icon}</Box>
                           </Box>
                           </Tooltip>
                         );
                       })}
                      </Box>
                      <style>{`@keyframes slowSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                        @keyframes slowSpinReverse { from { transform: rotate(0deg) } to { transform: rotate(-360deg) } }
                        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
                    </>
                  );
                })()}
              </Box>

              {/* Visual hint only (no text) below the record button */}
              {status !== 'recording' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', height: 18 }}>
                  <BrushIcon fontSize="small" sx={{ animation: `${wiggle} 2.4s ease-in-out infinite`, transformOrigin: 'bottom center', opacity: 0.85 }} />
                </Box>
              )}

              {status === 'recording' && (
                <Box aria-label="Nagrywanie – wizualizacja dźwięku" sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.6, height: 40 }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Box
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      sx={{
                        width: { xs: 4, sm: 6 },
                        height: '100%',
                        transformOrigin: 'center bottom',
                        backgroundColor: 'error.main',
                        borderRadius: 1,
                        animation: `${wave} ${1.1 + (i % 5) * 0.12}s ease-in-out ${i * 0.08}s infinite`,
                        boxShadow: '0 2px 8px rgba(239,71,111,0.35)',
                      }}
                    />
                  ))}
                </Box>
              )}

              {status === 'recording' && (
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" color="success" onClick={stopRecording} startIcon={<AutoAwesomeIcon />}>Generuj</Button>
                  <Button variant="contained" color="error" onClick={cancelRecording} startIcon={<CloseIcon />}>Anuluj</Button>
                </Stack>
              )}

              {/* Removed text chips; icons encircle mic button */}
            </Stack>
          )}
        </Box>
      </Box>

      <Dialog onClose={handleCloseDialog} open={status !== 'idle' && status !== 'recording'} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Przetwarzanie…</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ my: 2 }}>
            {steps.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {prompt && processMode !== 'printOnly' && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>Podstawowy prompt</Typography>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {prompt}
              </Box>
              {improveEnabled && improvedPrompt != null && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2" gutterBottom>Ulepszony prompt</Typography>
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {improvedPrompt}
                  </Box>
                </Box>
              )}
            </Box>
          )}
          {/* Subtle progress bar while steps are running */}
          {(status === 'transcribing' || status === 'improving' || status === 'generating' || status === 'printing') && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ height: 4, bgcolor: 'action.selected', borderRadius: 999, overflow: 'hidden' }}>
                <Box sx={{ width: '40%', height: '100%', bgcolor: 'primary.main', borderRadius: 999, animation: 'indeterminateSlide 1.6s ease-in-out infinite' }} />
              </Box>
              <style>{`
                @keyframes indeterminateSlide {
                  0% { transform: translateX(-100%); }
                  50% { transform: translateX(120%); }
                  100% { transform: translateX(250%); }
                }
              `}</style>
            </Box>
          )}

          {status === 'done' && (
            <>
              <Alert severity="success" icon={<CelebrationIcon />} sx={{ mt: 2 }}>Gotowe!</Alert>
              {imageUrl && (
                <Box sx={{ mt: 2 }}>
                  <Box
                    component="img"
                    src={imageUrl}
                    alt="wynik"
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      maxHeight: { xs: '60vh', sm: '70vh' },
                      objectFit: 'contain',
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
                      outline: '3px dashed rgba(251,133,0,0.25)',
                      outlineOffset: 6,
                    }}
                  />
                </Box>
              )}
            </>
          )}
          {status === 'error' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText || 'Wystąpił błąd. Spróbuj ponownie.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} autoFocus startIcon={<CloseIcon />}>Zamknij</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Konfiguracja</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Więcej szczegółów i kod źródłowy</Typography>
            <Typography variant="body2" color="text.secondary">
              Zobacz projekt na
              {' '}
              <Link href="https://github.com/Patresss/coloring-book-generator" target="_blank" rel="noopener noreferrer">GitHub</Link>
              {' '}— instrukcje, zmiany i źródła.
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2">OPENAI_IMAGE_MODEL</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.imageModel || '—'}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">OPENAI_IMAGE_QUALITY</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.openaiImageQuality || '—'}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">OPENAI_TEXT_MODEL</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.textModel || '—'}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">OPENAI_STT_MODEL</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.sttModel || '—'}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">OPENAI_TIMEOUT_MS</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.openaiTimeoutMs ?? '—'}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">PRINTER_URI</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {runtimeConfig?.printerUri || '—'}
              </Box>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Aby zmienić wartości, edytuj zmienne środowiskowe i zrestartuj aplikacje.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)} startIcon={<CloseIcon />}>Zamknij</Button>
        </DialogActions>
      </Dialog>
      {isMobile && (
        <Dialog
          open={historyOpen}
          fullScreen
          onClose={() => setHistoryOpen(false)}
          PaperProps={{ sx: { bgcolor: 'background.default' } }}
        >
          <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
            <List dense>
              {history.filter(item => !!item.imageUrl).map(item => (
                <React.Fragment key={item.id}>
                  <ListItem
                    disableGutters
                    alignItems="flex-start"
                    onClick={() => {
                      if (item.imageUrl) {
                        setSelected(item);
                        setHistoryOpen(false);
                      }
                    }}
                    sx={{ cursor: item.imageUrl ? 'pointer' : 'default', px: 1 }}
                  >
                    <ListItemText
                      primaryTypographyProps={{ variant: 'subtitle1' }}
                      secondaryTypographyProps={{ component: 'div' }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, gap: 1 }}>
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {(item.prompt || item.improvedPrompt) && (
                              <Tooltip title="Prompt" arrow>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptInfoItem(item);
                                  }}
                                  sx={{ p: 0.25, bgcolor: 'common.white', color: 'info.main', '&:hover': { bgcolor: 'grey.100' } }}
                                  aria-label="Prompt"
                                >
                                  <InfoOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Usuń kolorowankę">
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await api.remove(item.id);
                                    if (selected?.id === item.id) setSelected(null);
                                    await refreshHistory();
                                  } catch (err) {
                                    console.error('Delete failed:', err);
                                    setStatus('error');
                                  }
                                }}
                                sx={{ p: 0.25, bgcolor: 'common.white', color: 'error.main', '&:hover': { bgcolor: 'grey.100' } }}
                                aria-label="Usuń"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <>
                          {item.imageUrl && (
                            <Box sx={{ mt: 1, borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'scale(1.02) rotate(-0.2deg)', boxShadow: '0 10px 24px rgba(0,0,0,0.10)' } }}>
                              <Box component="img" src={item.imageUrl} alt="podgląd" loading="lazy" decoding="async" sx={{ width: '100%', height: 'auto', display: 'block' }} />
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHistoryOpen(false)} startIcon={<CloseIcon />}>Zamknij</Button>
          </DialogActions>
        </Dialog>
      )}
      {/* Prompt details modal */}
      <Dialog open={!!promptInfoItem} onClose={() => setPromptInfoItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>Prompt</DialogTitle>
        <DialogContent dividers>
          {promptInfoItem && (
            <Stack spacing={2}>
              {promptInfoItem.prompt && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Podstawowy prompt</Typography>
                  <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {promptInfoItem.prompt}
                  </Box>
                </Box>
              )}
              {promptInfoItem.improvedPrompt && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Ulepszony prompt</Typography>
                  <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {promptInfoItem.improvedPrompt}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptInfoItem(null)} startIcon={<CloseIcon />}>Zamknij</Button>
        </DialogActions>
      </Dialog>
      {/* Kid-friendly assistant */}
      <Mascot status={status} enabled={tipsEnabled} onToggle={setTipsEnabled} />
    </Box>
  );
};
