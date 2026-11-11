import React from 'react';
import { Box, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { HistoryItem } from '../api/client';
import { sky } from '../theme';

type HistoryListProps = {
  items: HistoryItem[];
  selectedId?: string | null;
  onSelect: (item: HistoryItem) => void;
  onShowPrompt: (item: HistoryItem) => void;
  onDelete?: (item: HistoryItem) => void;
  // 1 = one big thumbnail per row (sidebar); otherwise as many as fit
  columns?: 1 | 'auto';
};

const PAGE_SIZE = 24;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "Dziś, 11:55" / "Wczoraj, 18:02" / "9 lis, 16:15"
export const formatWhen = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Dziś, ${time}`;
  if (days === 1) return `Wczoraj, ${time}`;
  return `${date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}, ${time}`;
};

const smallAction = {
  width: 28,
  height: 28,
  borderRadius: '9px',
  color: sky.muted,
  '& svg': { fontSize: 18 },
} as const;

export const HistoryList: React.FC<HistoryListProps> = ({
  items,
  selectedId,
  onSelect,
  onShowPrompt,
  onDelete,
  columns = 'auto',
}) => {
  const single = columns === 1;
  // Render in chunks: hundreds of pages would otherwise all mount (and start loading) at once
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLLIElement | null>(null);
  const hasMore = visible < items.length;

  React.useEffect(() => {
    if (!hasMore || !sentinelRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible((count) => count + PAGE_SIZE);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visible]);
  if (items.length === 0) {
    return (
      <Typography sx={{ color: sky.muted, fontWeight: 700, textAlign: 'center', py: 5, px: 2 }}>
        Tu pojawią się Twoje kolorowanki
      </Typography>
    );
  }
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: single ? '1fr' : 'repeat(auto-fill, minmax(132px, 1fr))',
        gap: single ? 1.5 : 1.25,
      }}
    >
      {items.slice(0, visible).map((item) => {
        const selected = selectedId === item.id;
        return (
          <Box
            component="li"
            key={item.id}
            sx={{
              bgcolor: 'background.paper',
              border: `1.5px solid ${selected ? sky.blue : sky.line}`,
              boxShadow: selected ? `0 0 0 3px ${sky.blueSoft}` : 'none',
              borderRadius: '16px',
              p: '6px',
              minWidth: 0,
              transition: 'border-color .15s ease, box-shadow .15s ease',
            }}
          >
            <ButtonBase
              onClick={() => item.imageUrl && onSelect(item)}
              aria-label={item.prompt ? `Otwórz: ${item.prompt}` : 'Otwórz kolorowankę'}
              sx={{
                display: 'block',
                width: '100%',
                aspectRatio: single ? 'auto' : '3 / 4',
                minHeight: single ? 120 : undefined,
                borderRadius: '11px',
                overflow: 'hidden',
                bgcolor: '#fff',
                transition: 'transform .15s ease',
                '&:hover': { transform: 'scale(1.025)' },
              }}
            >
              {item.imageUrl && (
                <Box
                  component="img"
                  src={item.thumbUrl || item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  sx={{ width: '100%', height: single ? 'auto' : '100%', maxHeight: single ? 520 : undefined, objectFit: 'contain', display: 'block' }}
                />
              )}
            </ButtonBase>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 0.5, pt: 0.25, minHeight: 30 }}>
              <Typography
                component="span"
                sx={{ fontSize: 11.5, fontWeight: 700, color: sky.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {formatWhen(item.createdAt)}
              </Typography>
              <Box sx={{ display: 'flex', flex: 'none' }}>
                {(item.prompt || item.improvedPrompt) && (
                  <Tooltip title="Szczegóły" arrow>
                    <IconButton
                      onClick={() => onShowPrompt(item)}
                      aria-label="Szczegóły"
                      sx={{ ...smallAction, '&:hover': { bgcolor: sky.blueSoft, color: sky.blue } }}
                    >
                      <InfoOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {onDelete && (
                  <Tooltip title="Usuń" arrow>
                    <IconButton
                      onClick={() => onDelete(item)}
                      aria-label="Usuń"
                      sx={{ ...smallAction, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.12)', color: 'error.main' } }}
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        );
      })}
      {hasMore && (
        <Box component="li" ref={sentinelRef} aria-hidden sx={{ gridColumn: '1 / -1', height: 1 }} />
      )}
    </Box>
  );
};
