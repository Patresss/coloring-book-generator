import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

type Session = { token: string; createdAt: number };

const SESSIONS = new Map<string, Session>();

const getPassword = () => process.env.APP_PASSWORD || process.env.AUTH_PASSWORD || '';

const COOKIE_NAME = 'cbg_auth';

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

export function isAuthEnabled(): boolean {
  return !!getPassword();
}

export function issueSessionToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  SESSIONS.set(token, {
    token,
    createdAt: now,
  });
  return token;
}

export function revokeSessionToken(token: string | undefined) {
  if (token) SESSIONS.delete(token);
}

function isValidToken(token?: string): boolean {
  if (!token) return false;
  const s = SESSIONS.get(token);
  return !!s;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  // If password not set, skip auth entirely
  if (!isAuthEnabled()) return next();

  // Allow unauthenticated access to health and auth endpoints
  if (req.path === '/health' || req.path.startsWith('/api/auth')) return next();

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (isValidToken(token)) return next();

  res.status(401).json({ error: 'Unauthorized', message: 'Wymagane logowanie. Zaloguj się pod /auth lub POST /api/auth/login.' });
}

export function setAuthCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production';
  // Persistent cookie for 1 year
  const oneYear = 365 * 24 * 60 * 60; // seconds
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${oneYear}${secure ? '; Secure' : ''}`);
}

export function clearAuthCookie(res: Response) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);
}

export function verifyPassword(pw: string): boolean {
  const expected = getPassword();
  if (!expected) return true; // if not configured
  // constant-time compare
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
