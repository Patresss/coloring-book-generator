import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  Link,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { SelectChangeEvent } from '@mui/material/Select';
import { api, ModelKind, ModelsInfo, RuntimeConfig } from '../api/client';
import { GenerationSettingsSection } from './GenerationSettingsSection';

type ConfigDialogProps = {
  open: boolean;
  runtimeConfig: RuntimeConfig | null;
  onClose: () => void;
  onOpenReferences: () => void;
};

const MODEL_SECTIONS: { kind: ModelKind; title: string; provider: string }[] = [
  { kind: 'image', title: 'Generowanie kolorowanek', provider: 'Gemini' },
  { kind: 'text', title: 'Ulepszanie promptu i wykrywanie osób', provider: 'OpenAI' },
  { kind: 'stt', title: 'Rozpoznawanie mowy', provider: 'OpenAI' },
];

const AUTO = '__auto__';

const errorText = (e: unknown) => {
  const raw = String((e as any)?.message || e);
  try {
    return JSON.parse(raw)?.error || raw;
  } catch {
    return raw;
  }
};

const ValueBox: React.FC<{ children: React.ReactNode; breakAll?: boolean }> = ({ children, breakAll }) => (
  <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', wordBreak: breakAll ? 'break-all' : undefined }}>
    {children}
  </Box>
);

export const ConfigDialog: React.FC<ConfigDialogProps> = ({ open, runtimeConfig, onClose, onOpenReferences }) => {
  const [models, setModels] = useState<ModelsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<ModelKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKind, setSavedKind] = useState<ModelKind | null>(null);

  const loadModels = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setModels(await api.getModels(refresh));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSavedKind(null);
      loadModels();
    }
  }, [open, loadModels]);

  const handleModelChange = (kind: ModelKind) => async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setSaving(kind);
    setError(null);
    setSavedKind(null);
    try {
      setModels(await api.saveModels({ [kind]: value === AUTO ? null : value }));
      setSavedKind(kind);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(null);
    }
  };

  const providerErrors = models
    ? Object.entries(models.errors || {}).filter(([, msg]) => Boolean(msg))
    : [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Konfiguracja</DialogTitle>
      <DialogContent dividers>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Więcej szczegółów i kod źródłowy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zobacz projekt na{' '}
            <Link href="https://github.com/Patresss/coloring-book-generator" target="_blank" rel="noopener noreferrer">
              GitHub
            </Link>
            {' '}— instrukcje, zmiany i źródła.
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Osoby z rodziny</Typography>
            <Typography variant="caption" color="text.secondary">
              Zdjęcia referencyjne – dodawanie, zmiana nazwy i usuwanie.
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<GroupsRoundedIcon />} onClick={onOpenReferences} sx={{ borderRadius: 999, flex: 'none' }}>
            Zarządzaj
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <GenerationSettingsSection open={open} />

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight={600}>Modele AI</Typography>
          <Tooltip title="Pobierz aktualną listę modeli">
            <span>
              <IconButton size="small" onClick={() => loadModels(true)} disabled={loading} aria-label="Odśwież listę modeli">
                {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Lista pobierana z API Gemini i OpenAI. Wybór zapisuje się na serwerze i działa na wszystkich urządzeniach.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {providerErrors.map(([provider, msg]) => (
          <Alert key={provider} severity="warning" sx={{ mb: 1.5 }}>
            Nie udało się pobrać modeli {provider === 'gemini' ? 'Gemini' : 'OpenAI'}: {msg}
          </Alert>
        ))}

        <Stack spacing={2}>
          {MODEL_SECTIONS.map(({ kind, title, provider }) => {
            const info = models?.[kind];
            const value = info ? (info.source === 'selected' ? info.active : AUTO) : '';
            const autoModel = info && info.source !== 'selected' ? info.active : (info?.recommended ?? '');
            const autoLabel = info?.source === 'env'
              ? `Domyślny z konfiguracji serwera (${autoModel})`
              : `Automatycznie – najlepszy (${autoModel || '—'})`;
            return (
              <Box key={kind}>
                <Typography variant="subtitle2">
                  {title}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">({provider})</Typography>
                </Typography>
                <FormControl fullWidth size="small" sx={{ mt: 0.5 }} disabled={!info || saving === kind}>
                  <Select value={value} onChange={handleModelChange(kind)} displayEmpty>
                    {!info && <MenuItem value="">{loading ? 'Ładowanie…' : '—'}</MenuItem>}
                    {info && <MenuItem value={AUTO}>{autoLabel}</MenuItem>}
                    {info?.options.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        <Box component="span" sx={{ fontFamily: 'monospace' }}>{option.id}</Box>
                        {option.label && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {option.label}
                          </Typography>
                        )}
                        {option.id === info.recommended && (
                          <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                            ★ zalecany
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {saving === kind && (
                  <Typography variant="caption" color="text.secondary">Zapisywanie…</Typography>
                )}
                {savedKind === kind && saving !== kind && (
                  <Typography variant="caption" color="success.main">Zapisano – używany model: {info?.active}</Typography>
                )}
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle2">GEMINI_IMAGE_ASPECT_RATIO</Typography>
            <ValueBox>{runtimeConfig?.geminiAspectRatio || '—'}</ValueBox>
          </Box>
          <Box>
            <Typography variant="subtitle2">GEMINI_TIMEOUT_MS</Typography>
            <ValueBox>{runtimeConfig?.geminiTimeoutMs ?? '—'}</ValueBox>
          </Box>
          <Box>
            <Typography variant="subtitle2">OPENAI_TIMEOUT_MS</Typography>
            <ValueBox>{runtimeConfig?.openaiTimeoutMs ?? '—'}</ValueBox>
          </Box>
          <Box>
            <Typography variant="subtitle2">PRINTER_URI</Typography>
            <ValueBox breakAll>{runtimeConfig?.printerUri || '—'}</ValueBox>
          </Box>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Pozostałe wartości zmienisz w zmiennych środowiskowych i po restarcie aplikacji.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Zamknij
        </Button>
      </DialogActions>
    </Dialog>
  );
};
