import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';
import { skyGradient } from '../theme';

const CLOUD_PATH = 'M36 82a26 26 0 0 1-4-52 34 34 0 0 1 64-10 28 28 0 0 1 44 22 20 20 0 0 1-6 40z';

const drift = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(28px); }
`;

type Cloud = {
  width: { xs: number; sm: number };
  opacity: number;
  duration: number;
  position: Record<string, string | number>;
};

const clouds: Cloud[] = [
  { width: { xs: 120, sm: 190 }, opacity: 0.9, duration: 14, position: { left: '34%', top: '13%' } },
  { width: { xs: 90, sm: 130 }, opacity: 0.9, duration: 18, position: { right: '7%', top: '24%' } },
  { width: { xs: 150, sm: 240 }, opacity: 0.7, duration: 22, position: { right: -40, bottom: '7%' } },
  { width: { xs: 100, sm: 150 }, opacity: 0.7, duration: 16, position: { left: '28%', bottom: '15%' } },
  { width: { xs: 70, sm: 110 }, opacity: 0.6, duration: 20, position: { left: '6%', top: '42%' } },
];

// Calm sky backdrop: a soft blue gradient with a few slowly drifting clouds
export const AnimatedBackground: React.FC = () => (
  <Box
    aria-hidden
    sx={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
      background: skyGradient,
    }}
  >
    {clouds.map((cloud, index) => (
      <Box
        // eslint-disable-next-line react/no-array-index-key
        key={index}
        component="svg"
        viewBox="0 0 160 90"
        sx={{
          position: 'absolute',
          width: cloud.width,
          fill: '#fff',
          opacity: cloud.opacity,
          filter: 'drop-shadow(0 8px 14px rgba(47, 128, 237, 0.12))',
          animation: `${drift} ${cloud.duration}s ease-in-out infinite alternate`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          ...cloud.position,
        }}
      >
        <path d={CLOUD_PATH} />
      </Box>
    ))}
  </Box>
);
