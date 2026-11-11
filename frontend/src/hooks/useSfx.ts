import { useCallback, useRef } from 'react';

// Small synthesized sound effects. One shared AudioContext: creating a new one per sound leaks
// contexts, and on iOS a context created outside a tap stays muted.
let sharedContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  try {
    if (!sharedContext) {
      const Ctx: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      sharedContext = new Ctx();
    }
    if (sharedContext.state === 'suspended') sharedContext.resume().catch(() => {});
    return sharedContext;
  } catch {
    return null;
  }
};

const tone = (ctx: AudioContext, freq: number, start: number, duration: number, volume = 0.18, type: OscillatorType = 'sine') => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.03);
};

// Soft "pencil on paper" sound: band-passed noise with one swell per drawn line
const scribble = (ctx: AudioContext, durationMs: number, strokes: number) => {
  const duration = durationMs / 1000;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t0);
  const per = duration / Math.max(1, strokes);
  for (let s = 0; s < strokes; s++) {
    const a = t0 + s * per;
    gain.gain.linearRampToValueAtTime(0.05, a + per * 0.25);
    gain.gain.linearRampToValueAtTime(0.012, a + per * 0.95);
  }
  gain.gain.linearRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t0);
  source.stop(t0 + duration);
};

export const useSfx = (enabled: boolean) => {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (!enabledRef.current) return;
    const ctx = getContext();
    if (ctx) {
      try { fn(ctx); } catch {}
    }
  }, []);

  return {
    click: useCallback(() => play((ctx) => tone(ctx, 420, ctx.currentTime, 0.08)), [play]),
    error: useCallback(() => play((ctx) => {
      tone(ctx, 260, ctx.currentTime, 0.1);
      tone(ctx, 200, ctx.currentTime + 0.11, 0.16);
    }), [play]),
    // Short rising arpeggio when a picture is finished
    fanfare: useCallback(() => play((ctx) => {
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, f, t + i * 0.09, i === 3 ? 0.35 : 0.14, 0.16, 'triangle'));
    }), [play]),
    scribble: useCallback((durationMs: number, strokes: number) => play((ctx) => scribble(ctx, durationMs, strokes)), [play]),
  };
};

export type Sfx = ReturnType<typeof useSfx>;
