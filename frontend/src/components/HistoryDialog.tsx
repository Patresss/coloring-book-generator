import React from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { HistoryItem } from '../api/client';
import { HistoryList } from './HistoryList';
import { sky, skyGradient } from '../theme';

type HistoryDialogProps = {
  open: boolean;
  items: HistoryItem[];
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
  onShowPrompt: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
};

export const HistoryDialog: React.FC<HistoryDialogProps> = ({
  open,
  items,
  onClose,
  onSelect,
  onShowPrompt,
  onDelete,
}) => (
  <Dialog
    open={open}
    fullScreen
    onClose={onClose}
    aria-labelledby="history-dialog-title"
    PaperProps={{ sx: { background: skyGradient, display: 'flex', flexDirection: 'column' } }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        minHeight: 56,
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${sky.line}`,
        flex: 'none',
      }}
    >
      <Typography id="history-dialog-title" component="h2" sx={{ flex: 1, fontWeight: 800, fontSize: '1.2rem', pl: 0.5 }}>
        Twoje kolorowanki
      </Typography>
      <IconButton
        onClick={onClose}
        aria-label="Zamknij"
        sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: sky.blueTint, color: sky.ink }}
      >
        <CloseRoundedIcon />
      </IconButton>
    </Box>
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
      <HistoryList
        items={items}
        onSelect={(item) => {
          if (item.imageUrl) {
            onSelect(item);
            onClose();
          }
        }}
        onShowPrompt={onShowPrompt}
        onDelete={onDelete}
      />
    </Box>
  </Dialog>
);
