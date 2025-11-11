import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';

type Piece = { id: number; left: number; delay: number; color: string; rotation: number; size: number };

export const Confetti: React.FC<{ triggerKey: number | string | null }> = ({ triggerKey }) => {
  const [active, setActive] = useState(false);
  const pieces = useMemo<Piece[]>(() => {
    const colors = ['#FB8500', '#FFB703', '#60A5FA', '#00B4D8', '#34D399', '#EF476F'];
    return Array.from({ length: 36 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 10,
    }));
  }, [triggerKey]);

  useEffect(() => {
    if (triggerKey == null) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 2200);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!active) return null;

  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 9999 }}>
      {pieces.map(p => (
        <Box key={p.id}
          sx={{
            position: 'absolute',
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            borderRadius: 0.5,
            transform: `rotate(${p.rotation}deg)`,
            animation: `fall 2.1s cubic-bezier(.21,.61,.35,1) ${p.delay}s both, spin 2s linear ${p.delay}s both`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        />
      ))}
      <style>{`
        @keyframes fall { 0% { transform: translateY(-20px); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(110vh); opacity: 0.9; } }
        @keyframes spin { 0% { } 100% { transform: rotate(540deg); } }
      `}</style>
    </Box>
  );
};

