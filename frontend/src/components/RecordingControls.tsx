import React from 'react';
import { Box, Button, ButtonBase, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CropPortraitRoundedIcon from '@mui/icons-material/CropPortraitRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { keyframes } from '@mui/system';
import { Status } from '../types/status';
import { sky } from '../theme';
import { buildIdeaSet } from './ideaCatalog';

type RecordingControlsProps = {
  status: Status;
  isMobile: boolean;
  canRecord: boolean;
  autoPrint: boolean;
  improveEnabled: boolean;
  landscapeMode: boolean;
  ideasVisible: boolean;
  onAutoPrintChange: (value: boolean) => void;
  onImproveChange: (value: boolean) => void;
  onLandscapeChange: (value: boolean) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onIdeaSelect: (prompt: string) => void;
};

const ORBIT_SECONDS = 120;

const orbit = keyframes`
  to { transform: rotate(360deg); }
`;
const orbitBack = keyframes`
  to { transform: rotate(-360deg); }
`;
const breathe = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.035); }
`;
const ripple = keyframes`
  0% { transform: scale(1); opacity: 0.55; }
  100% { transform: scale(1.55); opacity: 0; }
`;
const wave = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;
const popIn = keyframes`
  from { scale: 0.6; }
  to { scale: 1; }
`;
const noMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

type ToggleChipProps = {
  label: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

// Icon + caption toggle; easier to hit and to understand than a bare switch
const ToggleChip: React.FC<ToggleChipProps> = ({ label, hint, active, onClick, children }) => (
  <Tooltip title={hint} arrow>
    <ButtonBase
      onClick={onClick}
      aria-pressed={active}
      aria-label={hint}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        minWidth: { xs: 62, sm: 70 },
        px: 1,
        py: '7px',
        borderRadius: '16px',
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 800,
        lineHeight: 1.2,
        color: active === undefined ? sky.ink : active ? sky.blue : sky.muted,
        bgcolor: active ? sky.blueSoft : 'transparent',
        transition: 'background-color .15s ease, color .15s ease',
        '&:hover': { bgcolor: active ? sky.blueSoft : sky.blueTint },
        '& svg': { fontSize: 24, transition: 'transform .25s ease' },
      }}
    >
      {children}
      <span>{label}</span>
    </ButtonBase>
  </Tooltip>
);

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  status,
  canRecord,
  autoPrint,
  improveEnabled,
  landscapeMode,
  ideasVisible,
  onAutoPrintChange,
  onImproveChange,
  onLandscapeChange,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onIdeaSelect,
}) => {
  const [ideas, setIdeas] = React.useState(() => buildIdeaSet());
  const [ideasKey, setIdeasKey] = React.useState(0);
  const [text, setText] = React.useState('');
  const recording = status === 'recording';
  const micDisabled = !recording && !canRecord;
  const showIdeas = ideasVisible && status === 'idle';

  const refreshIdeas = () => {
    setIdeas(buildIdeaSet());
    setIdeasKey((key) => key + 1);
  };

  const submitText = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !canRecord) return;
    setText('');
    onIdeaSelect(value);
  };

  const statusText = recording
    ? 'Słucham… naciśnij, gdy skończysz'
    : canRecord
      ? 'Naciśnij i powiedz, co narysować'
      : 'Chwileczkę…';

  const micColors = recording
    ? { from: '#4ADE80', to: sky.green, glow: 'rgba(34, 165, 101, 0.40)' }
    : { from: sky.coralLight, to: sky.coral, glow: 'rgba(244, 63, 94, 0.38)' };

  return (
    <Stack
      alignItems="center"
      sx={{
        // Ring diameter follows the free space of the main area (container units when available)
        '--D': 'max(190px, min(460px, 86vw, calc(100dvh - 330px)))',
        '@supports (width: 1cqw)': {
          '--D': 'max(190px, min(460px, 90cqw, calc(100cqh - 235px)))',
        },
        '--M': 'calc(var(--D) * 0.4)',
        width: '100%',
        gap: { xs: 1.25, sm: 2 },
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0.5,
          p: '6px',
          borderRadius: '22px',
          bgcolor: 'background.paper',
          border: `1px solid ${sky.line}`,
          boxShadow: sky.softShadow,
          visibility: recording ? 'hidden' : 'visible',
        }}
      >
        <ToggleChip
          label={landscapeMode ? 'Poziomo' : 'Pionowo'}
          hint={landscapeMode ? 'Kartka pozioma – naciśnij, aby zmienić na pionową' : 'Kartka pionowa – naciśnij, aby zmienić na poziomą'}
          active={landscapeMode}
          onClick={() => onLandscapeChange(!landscapeMode)}
        >
          <CropPortraitRoundedIcon sx={{ transform: landscapeMode ? 'rotate(90deg)' : 'none' }} />
        </ToggleChip>
        <ToggleChip
          label="Drukuj"
          hint={autoPrint ? 'Drukowanie od razu – włączone' : 'Drukowanie od razu – wyłączone'}
          active={autoPrint}
          onClick={() => onAutoPrintChange(!autoPrint)}
        >
          <PrintRoundedIcon />
        </ToggleChip>
        <ToggleChip
          label="Ulepszaj"
          hint={improveEnabled ? 'AI dopisuje szczegóły do pomysłu – włączone' : 'AI dopisuje szczegóły do pomysłu – wyłączone'}
          active={improveEnabled}
          onClick={() => onImproveChange(!improveEnabled)}
        >
          <AutoAwesomeRoundedIcon />
        </ToggleChip>
        <Box sx={{ width: '1px', bgcolor: sky.line, my: 1, mx: 0.25 }} />
        <ToggleChip label="Losuj" hint="Pokaż inne pomysły" onClick={refreshIdeas}>
          <CasinoRoundedIcon sx={{ '.MuiButtonBase-root:active &': { transform: 'rotate(180deg)' } }} />
        </ToggleChip>
      </Box>

      <Box sx={{ position: 'relative', width: 'var(--D)', height: 'var(--D)', flex: 'none' }}>
        {showIdeas && (
          <Box
            key={ideasKey}
            sx={{
              position: 'absolute',
              inset: 0,
              animation: `${orbit} ${ORBIT_SECONDS}s linear infinite`,
              // Stop the carousel while a child is hovered or focused so it is easy to hit
              '&:hover, &:focus-within': { animationPlayState: 'paused' },
              '&:hover .idea-upright, &:focus-within .idea-upright': { animationPlayState: 'paused' },
              ...noMotion,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', '& .idea-upright': { animation: 'none' } },
            }}
          >
            {ideas.map((idea, index) => {
              const angle = (index / ideas.length) * 360 - 90;
              return (
                <Box
                  key={`${idea.icon}-${index}`}
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 'calc(var(--D) * 0.19)',
                    height: 'calc(var(--D) * 0.19)',
                    margin: 'calc(var(--D) * -0.095)',
                    transform: `rotate(${angle}deg) translateX(calc(var(--D) * 0.405)) rotate(${-angle}deg)`,
                  }}
                >
                  <Box
                    className="idea-upright"
                    sx={{ width: '100%', height: '100%', animation: `${orbitBack} ${ORBIT_SECONDS}s linear infinite` }}
                  >
                    <Tooltip title={idea.label} arrow>
                      <ButtonBase
                        onClick={() => onIdeaSelect(idea.prompt)}
                        aria-label={`Pomysł: ${idea.label}`}
                        sx={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          bgcolor: '#fff',
                          boxShadow: sky.bubbleShadow,
                          fontSize: 'calc(var(--D) * 0.088)',
                          lineHeight: 1,
                          userSelect: 'none',
                          transition: 'scale .15s ease, box-shadow .2s ease',
                          animation: `${popIn} .3s ease backwards`,
                          animationDelay: `${index * 25}ms`,
                          '&:hover': { scale: '1.14', boxShadow: '0 10px 26px rgba(47, 128, 237, 0.32)' },
                          '&:active': { scale: '0.94' },
                          '&.Mui-focusVisible': { outline: `3px solid ${sky.blue}`, outlineOffset: 2 },
                          ...noMotion,
                        }}
                      >
                        <span aria-hidden>{idea.icon}</span>
                      </ButtonBase>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <Box sx={{ position: 'relative', width: 'var(--M)', height: 'var(--M)', pointerEvents: 'auto' }}>
            {recording &&
              [0, 0.6].map((delay) => (
                <Box
                  key={delay}
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    bgcolor: micColors.to,
                    animation: `${ripple} 1.4s ease-out ${delay}s infinite`,
                    ...noMotion,
                  }}
                />
              ))}
            <ButtonBase
              aria-label={recording ? 'Gotowe – narysuj kolorowankę' : 'Nagraj pomysł głosowo'}
              disabled={micDisabled}
              onClick={recording ? onStopRecording : onStartRecording}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                color: '#fff',
                background: `linear-gradient(145deg, ${micColors.from}, ${micColors.to})`,
                boxShadow: `0 0 0 calc(var(--M) * 0.055) rgba(255, 255, 255, 0.78), 0 calc(var(--M) * 0.1) calc(var(--M) * 0.22) ${micColors.glow}`,
                animation: recording || micDisabled ? 'none' : `${breathe} 2.6s ease-in-out infinite`,
                transition: 'filter .2s ease, opacity .2s ease',
                '&:hover': { filter: 'brightness(1.05)' },
                '&:active': { filter: 'brightness(0.95)' },
                '&.Mui-disabled': { opacity: 0.55 },
                '&.Mui-focusVisible': { outline: `4px solid ${sky.blue}`, outlineOffset: 6 },
                '& svg': { fontSize: 'calc(var(--M) * 0.46)' },
                ...noMotion,
              }}
            >
              {recording ? <CheckRoundedIcon /> : <MicRoundedIcon />}
            </ButtonBase>
          </Box>
        </Box>
      </Box>

      <Typography
        role="status"
        aria-live="polite"
        sx={{ fontWeight: 800, fontSize: { xs: 17, sm: 20 }, textAlign: 'center', color: sky.ink, minHeight: '1.5em', px: 1 }}
      >
        {statusText}
      </Typography>

      {recording ? (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ height: 54 }}>
          <Box
            aria-label="Nagrywanie – wizualizacja dźwięku"
            sx={{ display: 'flex', alignItems: 'center', gap: '4px', height: 36 }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <Box
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                sx={{
                  width: 5,
                  height: '100%',
                  borderRadius: 3,
                  background: `linear-gradient(to top, ${sky.blue}, #7FB6FF)`,
                  animation: `${wave} ${1.1 + (i % 5) * 0.12}s ease-in-out ${i * 0.08}s infinite`,
                  ...noMotion,
                }}
              />
            ))}
          </Box>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<CloseRoundedIcon />}
            onClick={onCancelRecording}
            sx={{ borderRadius: 999, bgcolor: 'background.paper', borderColor: sky.line, color: sky.ink, px: 2.5 }}
          >
            Anuluj
          </Button>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={submitText}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: 'min(430px, 100%)',
            height: 54,
            pl: 2,
            pr: '6px',
            borderRadius: 999,
            bgcolor: 'background.paper',
            border: `1.5px solid ${sky.line}`,
            boxShadow: sky.softShadow,
            transition: 'border-color .15s ease',
            '&:focus-within': { borderColor: sky.blue },
          }}
        >
          <EditRoundedIcon sx={{ fontSize: 20, color: sky.muted }} />
          <InputBase
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="…albo napisz pomysł"
            inputProps={{ 'aria-label': 'Napisz pomysł na kolorowankę', maxLength: 500, enterKeyHint: 'go' }}
            sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontFamily: 'inherit' }}
          />
          <ButtonBase
            type="submit"
            aria-label="Narysuj"
            disabled={!text.trim() || !canRecord}
            sx={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              bgcolor: sky.blue,
              color: '#fff',
              flex: 'none',
              transition: 'opacity .15s ease, transform .1s ease',
              '&.Mui-disabled': { opacity: 0.35 },
              '&:active': { transform: 'scale(0.94)' },
            }}
          >
            <ArrowForwardRoundedIcon />
          </ButtonBase>
        </Box>
      )}
    </Stack>
  );
};
