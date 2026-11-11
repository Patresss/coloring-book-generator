import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { downloadPdf } from '../utils/share';
import { HistoryItem } from '../api/client';
import { PeopleChips } from './PeopleChips';
import { formatWhen } from './HistoryList';
import { sky } from '../theme';

type PromptDetailsDialogProps = {
  item: HistoryItem | null;
  open: boolean;
  canRedraw: boolean;
  onClose: () => void;
  onRedraw: (item: HistoryItem) => void;
};

const textBox = {
  p: 1.25,
  bgcolor: sky.blueTint,
  borderRadius: '12px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
} as const;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box>
    <Typography variant="subtitle2" gutterBottom>{title}</Typography>
    {children}
  </Box>
);

export const PromptDetailsDialog: React.FC<PromptDetailsDialogProps> = ({ item, open, canRedraw, onClose, onRedraw }) => {
  // Keep the last item while the dialog fades out
  const lastRef = React.useRef<HistoryItem | null>(null);
  if (item) lastRef.current = item;
  const shown = item ?? lastRef.current;

  const facts = shown
    ? [
        shown.createdAt ? formatWhen(shown.createdAt) : null,
        shown.mode === 'image' ? 'obraz' : shown.mode === 'coloring' ? 'kolorowanka' : null,
        shown.generationTimeMs !== undefined ? `${(shown.generationTimeMs / 1000).toFixed(1)} s` : null,
        shown.model || null,
      ].filter(Boolean)
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="details-title">
      <DialogTitle id="details-title">Szczegóły</DialogTitle>
      <DialogContent dividers sx={{ borderColor: sky.line }}>
        {shown && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              {(shown.thumbUrl || shown.imageUrl) && (
                <Box
                  component="img"
                  src={shown.thumbUrl || shown.imageUrl}
                  alt=""
                  sx={{ width: 96, flex: 'none', borderRadius: '12px', border: `1px solid ${sky.line}`, bgcolor: '#fff' }}
                />
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Section title="Pomysł">
                  <Box sx={textBox}>{shown.prompt || '—'}</Box>
                </Section>
              </Box>
            </Stack>
            {shown.editInstruction && (
              <Section title="Poprawka">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ ...textBox, bgcolor: '#F1ECFF' }}>
                  <AutoFixHighRoundedIcon sx={{ color: '#7C3AED', fontSize: 20, flex: 'none' }} />
                  <span>{shown.editInstruction}</span>
                </Stack>
                <Typography variant="caption" color="text.secondary">To poprawiona wersja wcześniejszego rysunku.</Typography>
              </Section>
            )}
            {shown.improvedPrompt && (
              <Section title="Opis dla AI">
                <Box sx={{ ...textBox, fontSize: 14 }}>{shown.improvedPrompt}</Box>
              </Section>
            )}
            {shown.references && shown.references.length > 0 && (
              <Section title="Osoby na rysunku">
                <PeopleChips references={shown.references} size="small" justify="flex-start" />
              </Section>
            )}
            {facts.length > 0 && (
              <Typography variant="caption" sx={{ color: sky.muted }}>
                {facts.join(' · ')}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={{ borderRadius: 999 }}>
          Zamknij
        </Button>
        {shown?.imageUrl && (
          <Button variant="outlined" startIcon={<PictureAsPdfRoundedIcon />} onClick={() => downloadPdf(shown)} sx={{ borderRadius: 999 }}>
            Pobierz PDF
          </Button>
        )}
        {shown && (shown.prompt || shown.improvedPrompt) && (
          <Button
            variant="contained"
            startIcon={<AutorenewRoundedIcon />}
            disabled={!canRedraw}
            onClick={() => onRedraw(shown)}
            sx={{ borderRadius: 999, px: 2.5 }}
          >
            Narysuj jeszcze raz z tym opisem
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
