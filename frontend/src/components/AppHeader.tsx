import React from 'react';
import {
  AppBar,
  Toolbar,
  Tooltip,
  IconButton,
  Box,
  ButtonBase,
} from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { keyframes } from '@mui/system';
import { sky } from '../theme';

type AppHeaderProps = {
  isMobile: boolean;
  sfxEnabled: boolean;
  onToggleSfx: (value: boolean) => void;
  onOpenHistory: () => void;
  onOpenConfig: () => void;
  onGoHome: () => void;
};

const wiggle = keyframes`
  0% { transform: rotate(0deg) translateY(0); }
  30% { transform: rotate(-8deg) translateY(1px); }
  60% { transform: rotate(6deg) translateY(-1px); }
  100% { transform: rotate(0deg) translateY(0); }
`;

type HeaderButtonProps = {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
};

const HeaderButton: React.FC<HeaderButtonProps> = ({ label, onClick, pressed, children }) => (
  <Tooltip title={label} arrow>
    <IconButton
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      sx={{
        width: 44,
        height: 44,
        borderRadius: '14px',
        bgcolor: sky.blueTint,
        color: pressed === false ? sky.muted : sky.ink,
        '&:hover': { bgcolor: sky.blueSoft },
      }}
    >
      {children}
    </IconButton>
  </Tooltip>
);

export const AppHeader: React.FC<AppHeaderProps> = ({
  isMobile,
  sfxEnabled,
  onToggleSfx,
  onOpenHistory,
  onOpenConfig,
  onGoHome,
}) => (
  <AppBar position="fixed" elevation={0}>
    <Toolbar sx={{ px: { xs: 1.5, sm: 2.5 }, gap: 1 }}>
      {isMobile && (
        <HeaderButton label="Twoje kolorowanki" onClick={onOpenHistory}>
          <HistoryRoundedIcon />
        </HeaderButton>
      )}
      <ButtonBase
        onClick={onGoHome}
        aria-label="Przejdź do strony głównej"
        sx={{
          color: sky.ink,
          fontFamily: 'inherit',
          fontWeight: 800,
          fontSize: { xs: '1.3rem', sm: '1.45rem' },
          letterSpacing: '-0.2px',
          borderRadius: 2,
          px: 0.75,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Kolorowanki
        </Box>
        <BrushRoundedIcon
          sx={{
            fontSize: 24,
            color: sky.blue,
            animation: `${wiggle} 2.4s ease-in-out infinite`,
            transformOrigin: 'bottom center',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
      </ButtonBase>
      <Box sx={{ flexGrow: 1 }} />
      <HeaderButton
        label={sfxEnabled ? 'Dźwięki włączone' : 'Dźwięki wyłączone'}
        onClick={() => onToggleSfx(!sfxEnabled)}
        pressed={sfxEnabled}
      >
        {sfxEnabled ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
      </HeaderButton>
      <HeaderButton label="Konfiguracja" onClick={onOpenConfig}>
        <TuneRoundedIcon />
      </HeaderButton>
    </Toolbar>
  </AppBar>
);
