import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { HistoryItem } from '../api/client';
import { sky } from '../theme';

type ConfirmDeleteDialogProps = {
  item: HistoryItem | null;
  onCancel: () => void;
  onConfirm: (item: HistoryItem) => void;
};

// Deleting is permanent, so ask first – small fingers tap the bin by accident
export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({ item, onCancel, onConfirm }) => {
  // Keep the last item while the dialog fades out
  const lastItemRef = React.useRef<HistoryItem | null>(null);
  if (item) lastItemRef.current = item;
  const shown = item ?? lastItemRef.current;

  return (
    <Dialog open={!!item} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-delete-title">
      <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
        {shown?.imageUrl && (
          <Box
            component="img"
            src={shown.thumbUrl || shown.imageUrl}
            alt=""
            sx={{ width: 132, height: 132, objectFit: 'contain', bgcolor: '#fff', borderRadius: '14px', border: `1px solid ${sky.line}`, mb: 2 }}
          />
        )}
        <Typography id="confirm-delete-title" component="h2" sx={{ fontWeight: 800, fontSize: 22 }}>
          Usunąć tę kolorowankę?
        </Typography>
        <Typography sx={{ color: sky.muted, mt: 0.5 }}>Nie da się jej potem przywrócić.</Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2.5, px: 2 }}>
        <Button onClick={onCancel} variant="outlined" size="large" autoFocus sx={{ borderRadius: 999, minWidth: 120 }}>
          Zostaw
        </Button>
        <Button
          onClick={() => shown && onConfirm(shown)}
          variant="contained"
          color="error"
          size="large"
          startIcon={<DeleteRoundedIcon />}
          sx={{ borderRadius: 999, minWidth: 120 }}
        >
          Usuń
        </Button>
      </DialogActions>
    </Dialog>
  );
};
