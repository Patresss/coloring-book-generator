import React from 'react';
import { Box } from '@mui/material';

// Calmer, kid-friendly background: large soft radial blobs, minimal motion
export const AnimatedBackground: React.FC = () => {
  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {/* Very soft corner glows (reduced saturation/opacity) */}
      <Box sx={{
        position: 'absolute', top: '-20%', left: '-10%', width: { xs: 260, sm: 380 }, height: { xs: 260, sm: 380 },
        background: 'radial-gradient(closest-side, rgba(96,165,250,0.06), rgba(96,165,250,0))',
        filter: 'blur(14px)', opacity: 1, borderRadius: '50%', animation: 'drift1 20s ease-in-out infinite',
      }} />
      <Box sx={{
        position: 'absolute', bottom: '-18%', right: '-12%', width: { xs: 300, sm: 420 }, height: { xs: 300, sm: 420 },
        background: 'radial-gradient(closest-side, rgba(251,133,0,0.07), rgba(251,133,0,0))',
        filter: 'blur(18px)', opacity: 1, borderRadius: '50%', animation: 'drift2 24s ease-in-out infinite',
      }} />

      {/* Hide extra decorations on mobile to keep it clean */}
      <Box component="svg" viewBox="0 0 100 100" sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: '16%', right: '12%', width: 64, opacity: 0.10, animation: 'bob 8s ease-in-out -1s infinite' }}>
        <path d="M50 8 L61 38 L93 38 L66 57 L76 88 L50 70 L24 88 L34 57 L7 38 L39 38 Z" fill="none" stroke="#34D399" strokeWidth="4" strokeLinejoin="round" />
      </Box>

      <style>{`
        @keyframes drift1 { 0% { transform: translate3d(0,0,0); } 50% { transform: translate3d(8px,10px,0); } 100% { transform: translate3d(0,0,0); } }
        @keyframes drift2 { 0% { transform: translate3d(0,0,0); } 50% { transform: translate3d(-10px,-8px,0); } 100% { transform: translate3d(0,0,0); } }
        @keyframes bob { 0% { transform: translateY(0); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </Box>
  );
};
