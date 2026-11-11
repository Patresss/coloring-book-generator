import React from 'react';
import { Box, ButtonBase, Tooltip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
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
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                maxHeight: isMobile ? 'calc(100dvh - 190px)' : 'calc(100dvh - 100px)',
                '@supports (width: 1cqw)': { maxHeight: isMobile ? 'calc(100cqh - 72px)' : '100cqh' },
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
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 1.5, flex: 'none' }}>
        <ActionButton label="Zamknij podgląd" color={sky.ink} onClick={onClose}>
          <CloseRoundedIcon />
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
