import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { initStorage } from './services/storage.js';
import { transcribeRouter } from './routes/transcribe.js';
import { generateRouter } from './routes/generate.js';
import { printRouter } from './routes/print.js';
import { historyRouter } from './routes/history.js';
import { configRouter } from './routes/config.js';
import { improveRouter } from './routes/improve.js';
import { authRequired } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { referencesRouter } from './routes/references.js';

const app = express();

// CORS: allow all in dev; restrict in prod if CORS_ORIGIN is set
const corsOrigin = process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '20mb' }));

// Simple requestId + access log middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  logger.info('REQ', { id: (req as any).requestId, method: req.method, url: req.url });
  next();
});

// Simple in-memory rate limiter per IP for critical endpoints
type RateState = { count: number; windowStart: number };
const rateMap = new Map<string, RateState>();
const makeRateLimit = (max: number, windowMs: number) => {
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
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }
    next();
  };
};

// API routes
// Auth endpoints first (login/logout/page), unprotected
app.use('/api/auth', authRouter);
app.get('/auth', (_req: Request, res: Response) => res.redirect('/api/auth/page'));

// Require authentication for everything else if password is configured
app.use(authRequired);

app.use('/api/transcribe', makeRateLimit(10, 60_000), transcribeRouter);
app.use('/api/generate', makeRateLimit(15, 60_000), generateRouter);
app.use('/api/improve', makeRateLimit(20, 60_000), improveRouter);
app.use('/api/references', makeRateLimit(20, 60_000), referencesRouter);
app.use('/api/print', printRouter);
app.use('/api/history', historyRouter);
app.use('/api/config', configRouter);

app.use('/files', express.static(config.dataDir));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

initStorage().then(() => {
  app.listen(config.port, () => {
    logger.info(`Backend listening on http://localhost:${config.port}`);
  });
});
