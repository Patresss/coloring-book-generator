import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type Status = 'idle' | 'recording' | 'transcribing' | 'improving' | 'generating' | 'printing' | 'done' | 'error';

export const Mascot: React.FC<{
  status: Status;
  enabled: boolean;
  onToggle(enabled: boolean): void;
}> = ({ status, enabled, onToggle }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const text = useMemo(() => {
    switch (status) {
      case 'recording':
        return 'Super! Powiedz głośno swój pomysł ✨';
      case 'transcribing':
        return 'Słucham uważnie… 🎧';
      case 'improving':
        return 'Dopieszczam pomysł… 🌟';
      case 'generating':
        return 'Czaruję obrazek… chwileczkę! 🪄';
      case 'printing':
        return 'Drukareczka w ruchu! 🖨️';
      case 'done':
        return 'Gotowe! Możesz drukować lub spróbować ponownie 🎉';
      case 'error':
        return 'Ups! Spróbuj jeszcze raz 😊';
      default:
        return 'Naciśnij czerwony przycisk i powiedz, co chcesz narysować! 🎨';
    }
  }, [status]);

  if (!enabled) return null;

  return (
    <Box
      aria-live="polite"
      sx={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 1700, // above MUI dialogs on mobile
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        flexDirection: 'row-reverse', // emoji hugs the right edge
      }}
    >
      <Box
        sx={{
          fontSize: { xs: 44, sm: 56 },
          lineHeight: 1,
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.18))',
          animation: mounted ? 'mascotBob 3.2s ease-in-out infinite' : 'none',
        }}
        role="img"
        aria-label="Maskotka"
      >
        🐣
      </Box>
      <Paper elevation={3} sx={{ p: 1.25, pr: 0.5, borderRadius: 2, maxWidth: { xs: 220, sm: 320 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ pr: 0.5 }}>{text}</Typography>
          <Tooltip title="Ukryj podpowiedzi">
            <IconButton size="small" onClick={() => onToggle(false)} sx={{ ml: 0.5 }} aria-label="Ukryj podpowiedzi">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      <style>{`
        @keyframes mascotBob { 0% { transform: translateY(0) } 50% { transform: translateY(-4px) } 100% { transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </Box>
  );
};
