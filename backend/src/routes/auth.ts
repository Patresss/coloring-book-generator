import { Router, type Request, type Response } from 'express';
import { authRequired, clearAuthCookie, issueSessionToken, setAuthCookie, verifyPassword } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login { password }
authRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Brak hasła.' });
  }
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: 'Nieprawidłowe hasło.' });
  }
  const token = issueSessionToken();
  setAuthCookie(res, token);
  res.json({ ok: true });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /auth — prosta strona logowania (fallback, pomocne gdy frontend nie obsługuje logowania)
authRouter.get('/page', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
  <html lang="pl"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logowanie</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;display:grid;place-items:center;height:100dvh;margin:0;background:#f6f7f9;color:#111}form{background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.08);min-width:320px}input{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px}button{margin-top:12px;width:100%;padding:10px 12px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer}</style>
  </head><body>
  <form onsubmit="event.preventDefault(); login()">
    <h3>Wymagane hasło</h3>
    <p>Podaj hasło aby uzyskać dostęp.</p>
    <input id="pw" type="password" placeholder="Hasło" autofocus />
    <button type="submit">Zaloguj</button>
    <p id="msg" style="color:#b91c1c"></p>
  </form>
  <script>
    async function login(){
      const pw = document.getElementById('pw').value;
      const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
      if(r.ok){ location.href = '/'; } else { const j = await r.json().catch(()=>({error:'Błąd'})); document.getElementById('msg').textContent = j.error || 'Błąd logowania'; }
    }
  </script>
  </body></html>`);
});

// Expose a tiny endpoint to verify current auth state
authRouter.get('/me', authRequired, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

