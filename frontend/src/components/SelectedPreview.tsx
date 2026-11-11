import React from 'react';
import { Box, ButtonBase, InputBase, Tooltip, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import { keyframes } from '@mui/system';
import { HistoryItem } from '../api/client';
import { Status } from '../types/status';
import { sky } from '../theme';

type SelectedPreviewProps = {
  item: HistoryItem;
  isMobile: boolean;
  previewBustToken: number;
  status: Status;
  onClose: () => void;
  onRegenerate: () => void;
  onPrint: () => void;
  onDelete: () => void;
  onShowDetails: () => void;
  canEdit: boolean;
  editRecording: boolean;
  onEditVoice: () => void;
  onEditText: (text: string) => void;
  onStopEdit: () => void;
  onCancelEdit: () => void;
};

const EDIT_COLOR = '#7C3AED';
const EDIT_COLOR_LIGHT = '#A78BFA';

const wave = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.45); }
  100% { box-shadow: 0 0 0 14px rgba(124, 58, 237, 0); }
`;
const noMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

const roundButton = (bg: string) => ({
  width: 46,
  height: 46,
  borderRadius: '50%',
  flex: 'none',
  color: '#fff',
  background: bg,
  transition: 'opacity .15s ease, transform .1s ease',
  '&:active': { transform: 'scale(0.94)' },
  '&.Mui-disabled': { opacity: 0.4 },
  '&.Mui-focusVisible': { outline: `3px solid ${sky.blue}`, outlineOffset: 2 },
});

type EditBarProps = Pick<SelectedPreviewProps, 'canEdit' | 'editRecording' | 'onEditVoice' | 'onEditText' | 'onStopEdit' | 'onCancelEdit'>;

// "Popraw rysunek": speak or type a change, e.g. "dodaj kota" – the picture is edited, not drawn again
const EditBar: React.FC<EditBarProps> = ({ canEdit, editRecording, onEditVoice, onEditText, onStopEdit, onCancelEdit }) => {
  const [text, setText] = React.useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !canEdit) return;
    setText('');
    onEditText(value);
  };
  const shell = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    width: 'min(600px, 100%)',
    height: 58,
    pl: '6px',
    pr: '6px',
    borderRadius: 999,
    bgcolor: 'background.paper',
    border: `1.5px solid ${editRecording ? EDIT_COLOR_LIGHT : sky.line}`,
    boxShadow: sky.softShadow,
    flex: 'none',
  } as const;

  if (editRecording) {
    return (
      <Box sx={shell} role="status" aria-live="polite">
        <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 28, pl: 1.5 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Box
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              sx={{ width: 4, height: '100%', borderRadius: 2, bgcolor: EDIT_COLOR_LIGHT, animation: `${wave} ${1 + (i % 4) * 0.12}s ease-in-out ${i * 0.08}s infinite`, ...noMotion }}
            />
          ))}
        </Box>
        <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 800, color: sky.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Słucham… co zmienić?
        </Typography>
        <Tooltip title="Anuluj" arrow>
          <ButtonBase onClick={onCancelEdit} aria-label="Anuluj poprawkę" sx={{ ...roundButton(sky.blueTint), color: sky.ink }}>
            <CloseRoundedIcon />
          </ButtonBase>
        </Tooltip>
        <Tooltip title="Gotowe – popraw rysunek" arrow>
          <ButtonBase onClick={onStopEdit} aria-label="Gotowe – popraw rysunek" sx={{ ...roundButton(`linear-gradient(145deg, #4ADE80, ${sky.green})`), animation: `${pulse} 1.3s ease-out infinite`, ...noMotion }}>
            <CheckRoundedIcon />
          </ButtonBase>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ ...shell, '&:focus-within': { borderColor: EDIT_COLOR_LIGHT } }}>
      <Tooltip title="Powiedz, co poprawić" arrow>
        <span>
          <ButtonBase
            type="button"
            onClick={onEditVoice}
            disabled={!canEdit}
            aria-label="Powiedz, co poprawić"
            sx={roundButton(`linear-gradient(145deg, ${EDIT_COLOR_LIGHT}, ${EDIT_COLOR})`)}
          >
            <MicRoundedIcon />
          </ButtonBase>
        </span>
      </Tooltip>
      <AutoFixHighRoundedIcon sx={{ fontSize: 20, color: EDIT_COLOR_LIGHT, flex: 'none', display: { xs: 'none', sm: 'block' } }} />
      <InputBase
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Co poprawić? np. „dodaj kota”"
        disabled={!canEdit}
        inputProps={{ 'aria-label': 'Co poprawić na rysunku', maxLength: 500, enterKeyHint: 'go' }}
        sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontFamily: 'inherit' }}
      />
      <ButtonBase type="submit" aria-label="Popraw rysunek" disabled={!text.trim() || !canEdit} sx={roundButton(EDIT_COLOR)}>
        <ArrowForwardRoundedIcon />
      </ButtonBase>
    </Box>
  );
};

const revealSweep = keyframes`
  0% { transform: translateY(-100%); opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
`;

type ActionButtonProps = {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

const ActionButton: React.FC<ActionButtonProps> = ({ label, color, onClick, disabled, children }) => (
  <Tooltip title={label} arrow placement="left">
    <span>
      <ButtonBase
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: color,
          color: '#fff',
          boxShadow: '0 6px 14px rgba(22, 50, 77, 0.20)',
          transition: 'scale .15s ease, opacity .15s ease',
          '&:hover': { scale: '1.08' },
          '&:active': { scale: '0.94' },
          '&.Mui-disabled': { opacity: 0.4 },
          '&.Mui-focusVisible': { outline: `3px solid ${sky.blue}`, outlineOffset: 3 },
          '& svg': { fontSize: 28 },
        }}
      >
        {children}
      </ButtonBase>
    </span>
  </Tooltip>
);

export const SelectedPreview: React.FC<SelectedPreviewProps> = ({
  item,
  isMobile,
  previewBustToken,
  status,
  onClose,
  onRegenerate,
  onPrint,
  onDelete,
  onShowDetails,
  canEdit,
  editRecording,
  onEditVoice,
  onEditText,
  onStopEdit,
  onCancelEdit,
}) => {
  const actionsDisabled = !(status === 'idle' || status === 'done' || status === 'error');
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [showReveal, setShowReveal] = React.useState(true);

  React.useEffect(() => {
    setImageLoaded(false);
    setShowReveal(true);
    const timer = setTimeout(() => setShowReveal(false), 1500);
    return () => clearTimeout(timer);
  }, [item.id, previewBustToken]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 2,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {item.imageUrl && (
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', maxWidth: '100%', maxHeight: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 14px 40px rgba(22, 50, 77, 0.18)', bgcolor: '#fff' }}>
            <Box
              component="img"
              src={`${item.imageUrl}?t=${previewBustToken}`}
              alt={item.prompt}
              loading="eager"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              sx={{
                display: 'block',
                maxWidth: '100%',
                // Fallback for browsers without container units, then the exact free height
                maxHeight: isMobile ? 'calc(100dvh - 270px)' : 'calc(100dvh - 175px)',
                '@supports (width: 1cqw)': { maxHeight: isMobile ? 'calc(100cqh - 150px)' : 'calc(100cqh - 72px)' },
                objectFit: 'contain',
                opacity: imageLoaded ? 1 : 0,
                transform: imageLoaded ? 'scale(1)' : 'scale(0.96)',
                transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            {showReveal && imageLoaded && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%)',
                  animation: `${revealSweep} 1.5s ease-out forwards`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </Box>
          <EditBar
            canEdit={canEdit}
            editRecording={editRecording}
            onEditVoice={onEditVoice}
            onEditText={onEditText}
            onStopEdit={onStopEdit}
            onCancelEdit={onCancelEdit}
          />
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 1.5, flex: 'none' }}>
        <ActionButton label="Zamknij podgląd" color={sky.ink} onClick={onClose} disabled={editRecording}>
          <CloseRoundedIcon />
        </ActionButton>
        <ActionButton label="Szczegóły" color="#0EA5E9" onClick={onShowDetails}>
          <InfoOutlinedIcon />
        </ActionButton>
        {item.imageUrl && (
          <ActionButton label="Narysuj jeszcze raz" color="#3B82F6" onClick={onRegenerate} disabled={actionsDisabled}>
            <AutorenewRoundedIcon />
          </ActionButton>
        )}
        {item.id && (
          <ActionButton label="Drukuj" color={sky.green} onClick={onPrint} disabled={actionsDisabled}>
            <PrintRoundedIcon />
          </ActionButton>
        )}
        <ActionButton label="Usuń kolorowankę" color="#EF4444" onClick={onDelete} disabled={actionsDisabled}>
          <DeleteRoundedIcon />
        </ActionButton>
      </Box>
    </Box>
  );
};
