import type { NextFunction, Request, Response } from 'express';

type RateState = { count: number; windowStart: number };

// Simple in-memory rate limiter per IP. Every limiter keeps its own counters,
// so e.g. loading reference thumbnails does not eat into the generate limit.
export const makeRateLimit = (max: number, windowMs: number) => {
  const rateMap = new Map<string, RateState>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}`;
    const now = Date.now();
    const state = rateMap.get(key) || { count: 0, windowStart: now };
    if (now - state.windowStart > windowMs) {
      state.count = 0;
      state.windowStart = now;
    }
    state.count += 1;
    rateMap.set(key, state);
    if (state.count > max) {
      return res.status(429).json({ error: 'Za dużo zapytań, zwolnij trochę.' });
    }
    next();
  };
};
