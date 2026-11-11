import React from 'react';
import { Box } from '@mui/material';
import { HistoryItem } from '../api/client';
import { HistoryList } from './HistoryList';
import { sky } from '../theme';

type HistorySidebarProps = {
  items: HistoryItem[];
  selectedId?: string | null;
  onSelect: (item: HistoryItem) => void;
  onShowPrompt: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  items,
  selectedId,
  onSelect,
  onShowPrompt,
  onDelete,
}) => (
  <Box
    component="aside"
    aria-label="Twoje kolorowanki"
    sx={{
      width: { sm: 220, md: 300, xl: 340 },
      flex: 'none',
      borderRight: `1px solid ${sky.line}`,
      bgcolor: sky.side,
      backdropFilter: 'blur(6px)',
      p: 1.5,
      overflowY: 'auto',
    }}
  >
    <HistoryList
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      onShowPrompt={onShowPrompt}
      onDelete={onDelete}
      columns={1}
    />
  </Box>
);
