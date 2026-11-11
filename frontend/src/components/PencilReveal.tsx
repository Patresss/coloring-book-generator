import React from 'react';
import { Box } from '@mui/material';

type PencilRevealProps = {
  // Start when the picture underneath is loaded and laid out
  active: boolean;
  onStart?: (durationMs: number, strokes: number) => void;
  onDone: () => void;
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

type Point = { x: number; y: number };

// Serpentine "scribble" over the whole picture: left→right, down, right→left, …
const buildPath = (w: number, h: number, rows: number, brush: number): Point[] => {
  const rowH = h / rows;
  const pts: Point[] = [];
  const step = 6;
  for (let r = 0; r < rows; r++) {
    const y = rowH * (r + 0.5);
    const leftToRight = r % 2 === 0;
    const from = leftToRight ? -brush * 0.3 : w + brush * 0.3;
    const to = leftToRight ? w + brush * 0.3 : -brush * 0.3;
    const len = Math.abs(to - from);
    for (let d = 0; d <= len; d += step) {
      const x = from + (leftToRight ? d : -d);
      // A little hand-drawn wobble
      pts.push({ x, y: y + Math.sin((x + r * 37) / 29) * rowH * 0.14 });
    }
  }
  return pts;
};

/**
 * White sheet over a finished picture that a pencil "draws away" stroke by stroke,
 * so the coloring page appears as if it was being drawn right now.
 */
export const PencilReveal: React.FC<PencilRevealProps> = ({ active, onStart, onDone }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pencilRef = React.useRef<HTMLSpanElement>(null);
  const [finished, setFinished] = React.useState(false);
  const callbacks = React.useRef({ onStart, onDone });
  callbacks.current = { onStart, onDone };

  // Paint the white cover before the browser shows the picture (no flash of the finished image)
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(box.clientHeight * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, box.clientWidth, box.clientHeight);
  }, [active]);

  React.useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    const w = box?.clientWidth || 0;
    const h = box?.clientHeight || 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!canvas || !ctx || !w || !h || reduced) {
      setFinished(true);
      callbacks.current.onDone();
      return undefined;
    }

    const rows = Math.max(5, Math.min(9, Math.round(h / (w / 7))));
    const brush = (h / rows) * 1.45;
    const path = buildPath(w, h, rows, brush);
    const duration = 1000; // short and snappy
    callbacks.current.onStart?.(duration, rows);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush;

    let frame = 0;
    let drawn = 0;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const target = Math.floor(easeInOut(t) * (path.length - 1));
      if (target > drawn) {
        ctx.beginPath();
        ctx.moveTo(path[drawn].x, path[drawn].y);
        for (let i = drawn + 1; i <= target; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        drawn = target;
      }
      const tip = path[drawn];
      if (pencilRef.current && tip) {
        const goingRight = Math.floor((drawn / path.length) * rows) % 2 === 0;
        pencilRef.current.style.transform = `translate(${tip.x}px, ${tip.y}px) scaleX(${goingRight ? 1 : -1})`;
      }
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setFinished(true);
        doneTimer = setTimeout(() => callbacks.current.onDone(), 200);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [active]);

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ width: '100%', height: '100%', display: 'block', opacity: finished ? 0 : 1, transition: 'opacity .2s ease' }}
      />
      {/* Emoji pencil whose tip (bottom-left corner) follows the stroke */}
      <Box
        component="span"
        ref={pencilRef}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          fontSize: { xs: 40, sm: 56 },
          lineHeight: 1,
          marginTop: { xs: '-38px', sm: '-53px' },
          marginLeft: '-4px',
          transformOrigin: '4px calc(100% - 3px)',
          filter: 'drop-shadow(0 6px 8px rgba(22, 50, 77, 0.25))',
          opacity: active && !finished ? 1 : 0,
          transition: 'opacity .25s ease',
        }}
      >
        ✏️
      </Box>
    </Box>
  );
};
