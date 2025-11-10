const safeText = async (res: Response) => {
  try { return await res.text(); } catch { return `${res.status} ${res.statusText}`; }
};

type VoidFn = () => void;
const subscribers: VoidFn[] = [];

export const onAuthRequired = (cb: VoidFn) => {
  subscribers.push(cb);
  return () => {
    const idx = subscribers.indexOf(cb);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
};

export const signalAuthRequired = () => {
  subscribers.forEach((cb) => { try { cb(); } catch {} });
};

export const auth = {
  async me(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/me');
      return res.ok;
    } catch {
      return false;
    }
  },
  async login(password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error(await safeText(res));
  },
  async logout(): Promise<void> {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  }
};
