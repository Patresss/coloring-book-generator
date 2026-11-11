import React, { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api, GenerationMode, GenerationSettings } from '../api/client';

const PROMPT_SECTIONS: { mode: GenerationMode; title: string }[] = [
  { mode: 'coloring', title: 'Prompt – kolorowanki' },
  { mode: 'image', title: 'Prompt – zwykłe obrazy' },
];

const errorText = (e: unknown) => {
  const raw = String((e as any)?.message || e);
  try {
    return JSON.parse(raw)?.error || raw;
  } catch {
    return raw;
  }
};

type Props = { open: boolean };

export const GenerationSettingsSection: React.FC<Props> = ({ open }) => {
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<GenerationMode, string>>({ coloring: '', image: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);

  const apply = (next: GenerationSettings) => {
    setSettings(next);
    setDrafts({ coloring: next.prompts.coloring.value, image: next.prompts.image.value });
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      apply(await api.getGenerationSettings());
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    if (open) {
      setNotice(null);
      load();
    }
  }, [open, load]);

  const save = async (key: string, update: Parameters<typeof api.saveGenerationSettings>[0], text: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      apply(await api.saveGenerationSettings(update));
      setNotice({ key, text });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const coloring = settings?.mode !== 'image';

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600}>Rodzaj obrazków</Typography>
      {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
      <FormControlLabel
        sx={{ mt: 0.5 }}
        control={(
          <Switch
            checked={coloring}
            disabled={!settings || busy === 'mode'}
            onChange={(e) => save(
              'mode',
              { mode: e.target.checked ? 'coloring' : 'image' },
              e.target.checked ? 'Włączono tryb kolorowanek' : 'Włączono tryb zwykłych obrazów',
            )}
          />
        )}
        label={coloring ? 'Kolorowanki (czarno-białe kontury)' : 'Zwykłe obrazy (w kolorze)'}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {coloring
          ? 'Domyślny tryb: strony do pokolorowania. Wyłącz, żeby generować zwykłe obrazy.'
          : 'Generowane są zwykłe obrazy. Włącz, żeby wrócić do kolorowanek.'}
        {' '}Ustawienie zapisuje się na serwerze.
      </Typography>
      {notice?.key === 'mode' && (
        <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>{notice.text}</Typography>
      )}

      <Box sx={{ mt: 1.5 }}>
        {PROMPT_SECTIONS.map(({ mode, title }) => {
          const info = settings?.prompts[mode];
          const draft = drafts[mode];
          const dirty = Boolean(info) && draft !== info!.value;
          const isActive = settings?.mode === mode;
          return (
            <Accordion key={mode} disableGutters variant="outlined" sx={{ '&:not(:last-of-type)': { borderBottom: 0 } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2">{title}</Typography>
                  {isActive && <Chip size="small" color="primary" label="używany" />}
                  {info?.custom && <Chip size="small" variant="outlined" label="własny" />}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={16}
                  value={draft}
                  disabled={!info}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [mode]: e.target.value }))}
                  inputProps={{ style: { fontSize: 13 } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  W miejscu <code>{'{temat}'}</code> zostanie wstawiony Twój pomysł. Bez tego znacznika temat trafi na koniec promptu.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!dirty || busy !== null || !draft.trim()}
                    onClick={() => save(mode, { prompts: { [mode]: draft } }, 'Zapisano prompt')}
                  >
                    Zapisz
                  </Button>
                  <Button
                    size="small"
                    disabled={!info || busy !== null || (!info.custom && !dirty)}
                    onClick={() => save(mode, { prompts: { [mode]: null } }, 'Przywrócono domyślny prompt')}
                  >
                    Przywróć domyślny
                  </Button>
                  {dirty && (
                    <Button size="small" color="inherit" disabled={busy !== null} onClick={() => setDrafts((prev) => ({ ...prev, [mode]: info!.value }))}>
                      Anuluj zmiany
                    </Button>
                  )}
                  {notice?.key === mode && (
                    <Typography variant="caption" color="success.main">{notice.text}</Typography>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};
