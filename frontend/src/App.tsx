import React, { useEffect, useRef, useState } from 'react';
import { api, HistoryItem, type RuntimeConfig } from './api/client';
import { auth, onAuthRequired } from './api/auth';
  import {
    AppBar,
    Toolbar,
    Typography,
    Box,
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
  import { keyframes } from '@mui/system';
  import HistoryIcon from '@mui/icons-material/History';
  import { useTheme } from '@mui/material/styles';
  import useMediaQuery from '@mui/material/useMediaQuery';

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
    const url = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState({}, '', url);
    try { localStorage.setItem('autoPrint', String(autoPrint)); } catch {}
    try { localStorage.setItem('improveEnabled', String(improveEnabled)); } catch {}
  }, [autoPrint, improveEnabled]);

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

  const startRecording = async () => {
    try {
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
        setStatus('transcribing');
        try {
          const { id, prompt } = await api.transcribe(blob);
          setId(id);
          setPrompt(prompt);
          let finalPrompt = prompt;
          setImprovedPrompt(null);
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
          const gen = await api.generate(id, finalPrompt);
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

  const canRecord = canGenerate && (status === 'idle' || status === 'error' || status === 'done');
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

  const steps = processMode === 'printOnly'
    ? ['Drukowanie']
    : (() => {
      const arr: string[] = ['Transkrypcja'];
      if (improveEnabled) arr.push('Ulepszanie promptu');
      arr.push('Generowanie obrazu');
      if (autoPrint) arr.push('Drukowanie');
      return arr;
    })();
  const activeStep = processMode === 'printOnly'
    ? (status === 'printing' ? 0 : steps.length)
    : (() => {
      if (status === 'transcribing') return 0;
      if (improveEnabled) {
        if (status === 'improving') return 1;
        if (status === 'generating') return 2;
        if (autoPrint && status === 'printing') return 3;
        return steps.length;
      } else {
        if (status === 'generating') return 1;
        if (autoPrint && status === 'printing') return 2;
        return steps.length;
      }
    })();

  const handleCloseDialog = async () => {
    if (status === 'done' && id) {
      const item = history.find((h) => h.id === id);
      if (item) setSelected(item);
    }
    setStatus('idle');
    setProcessMode(null);
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
    <Box sx={{ display: 'flex', height: '100dvh' }}>
      <AppBar position="fixed" color="primary" elevation={1}>
        <Toolbar>
          {isMobile && (
            <Tooltip title="Historia" arrow>
              <IconButton edge="start" color="inherit" onClick={() => setHistoryOpen(true)} aria-label="Historia" sx={{ mr: 1 }}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Generator kolorowanek
          </Typography>
          {/* Unified icon-over-switch controls */}
          {(() => {
            // Both switches now share the same default style as the AI improve switch
            return (
              <>
                <Tooltip title={autoPrint ? 'Automatyczne drukowanie włączone' : 'Kolorowanki nie będą drukowane automatycznie'} arrow>
                  <Box sx={{ ml: 2, pt: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pt: { xs: 7, sm: 8 } }}>
        {/* Główny interfejs renderowany tylko gdy konfiguracja jest kompletna */}
        {!isMobile && (
        <Box component="aside" sx={{ width: 480, borderRight: 1, borderColor: 'divider', p: 2, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>Historia</Typography>
          <List dense>
            {history.filter(item => !!item.imageUrl).map(item => (
              <React.Fragment key={item.id}>
                <ListItem
                  alignItems="flex-start"
                  onClick={() => item.imageUrl && setSelected(item)}
                  sx={{ cursor: item.imageUrl ? 'pointer' : 'default', bgcolor: selected?.id === item.id ? 'action.selected' : undefined }}
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
                          <Box sx={{ mt: 1, borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
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
                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2, border: 1, borderColor: 'divider' }}
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
                            setProcessMode('full');
                            setStatus('generating');
                            setPrompt(selected.prompt);
                            const newId = String(Date.now());
                            const gen = await api.generate(newId, selected.prompt);
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
                            setProcessMode('full');
                            setStatus('generating');
                            setPrompt(selected.prompt);
                            const newId = String(Date.now());
                            const gen = await api.generate(newId, selected.prompt);
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
              <Alert severity="success" sx={{ mt: 2 }}>Gotowe!</Alert>
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
          <Button onClick={handleCloseDialog} autoFocus>Zamknij</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Konfiguracja</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2">OPENAI_IMAGE_MODEL</Typography>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace' }}>
                {runtimeConfig?.imageModel || '—'}
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
          <Button onClick={() => setConfigOpen(false)}>Zamknij</Button>
        </DialogActions>
      </Dialog>
      {isMobile && (
        <Dialog open={historyOpen} fullScreen onClose={() => setHistoryOpen(false)}>
          <DialogTitle>Historia</DialogTitle>
          <DialogContent dividers>
            <List dense>
              {history.filter(item => !!item.imageUrl).map(item => (
                <React.Fragment key={item.id}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => {
                      if (item.imageUrl) {
                        setSelected(item);
                        setHistoryOpen(false);
                      }
                    }}
                    sx={{ cursor: item.imageUrl ? 'pointer' : 'default' }}
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
                            <Box sx={{ mt: 1, borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
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
            <Button onClick={() => setHistoryOpen(false)}>Zamknij</Button>
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
          <Button onClick={() => setPromptInfoItem(null)}>Zamknij</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
