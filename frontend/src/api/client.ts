import { signalAuthRequired } from './auth';
export type HistoryItem = { id: string; createdAt: number; prompt: string; improvedPrompt?: string; references?: string[]; generationTimeMs?: number; model?: string; imageUrl?: string };

const parseTimeout = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Prefer OPENAI_TIMEOUT_MS (build-time) or VITE_OPENAI_TIMEOUT_MS as initial default; updated via /api/config at runtime
let OPENAI_TIMEOUT = parseTimeout(
  (import.meta.env as any).OPENAI_TIMEOUT_MS ?? (import.meta.env as any).VITE_OPENAI_TIMEOUT_MS,
  60000
);

export const setTimeoutMs = (ms: number) => {
  OPENAI_TIMEOUT = parseTimeout(ms, OPENAI_TIMEOUT);
};

export const loadConfig = async () => {
  try {
    const res = await safeFetch('/api/config');
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.openaiTimeoutMs === 'number') {
      setTimeoutMs(data.openaiTimeoutMs);
    }
  } catch {}
};

export type RuntimeConfig = {
  openaiTimeoutMs: number;
  geminiTimeoutMs?: number;
  imageModel?: string;
  geminiAspectRatio?: string;
  textModel?: string;
  sttModel?: string;
  printerUri?: string;
  missingEnv?: string[];
  canGenerate?: boolean;
};

export type ModelKind = 'image' | 'text' | 'stt';
export type ModelOption = { id: string; label?: string };
export type ModelKindInfo = {
  options: ModelOption[];
  active: string;
  source: 'selected' | 'env' | 'recommended' | 'fallback';
  recommended: string | null;
};
export type ModelsInfo = Record<ModelKind, ModelKindInfo> & {
  fetchedAt: number;
  errors: Partial<Record<'gemini' | 'openai', string>>;
};

export type GenerationMode = 'coloring' | 'image';
export type PromptInfo = { value: string; default: string; custom: boolean };
export type GenerationSettings = {
  mode: GenerationMode;
  prompts: Record<GenerationMode, PromptInfo>;
};
export type GenerationSettingsUpdate = {
  mode?: GenerationMode;
  prompts?: Partial<Record<GenerationMode, string | null>>;
};

export type ReferenceItem = { name: string; size: number; updatedAt: number; url: string };

export const getConfig = async (): Promise<RuntimeConfig> => {
  const res = await safeFetch('/api/config');
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
};

const withTimeout = async <T>(fn: (signal: AbortSignal) => Promise<T>, ms = 240000): Promise<T> => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Przekroczono czas oczekiwania (${Math.round(ms / 1000)}s)`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
};

const postJson = async <T>(url: string, body: any, timeoutMs?: number): Promise<T> =>
  withTimeout(async (signal) => {
    const res = await safeFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(await safeText(res));
    return res.json();
  }, timeoutMs);

const safeText = async (res: Response) => {
  try { return await res.text(); } catch { return `${res.status} ${res.statusText}`; }
};

const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const res = await fetch(input, init);
  if (res.status === 401) {
    signalAuthRequired();
    // consume body to free stream, then throw
    try { await res.text(); } catch {}
    throw new Error('Unauthorized');
  }
  return res;
};

export const api = {
  loadConfig,
  getConfig,
  setTimeoutMs,
  async transcribe(audio: Blob): Promise<{ id: string; prompt: string }> {
    const form = new FormData();
    form.append('audio', audio, 'audio.webm');
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/transcribe', { method: 'POST', body: form, signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, OPENAI_TIMEOUT);
  },
  async generate(id: string, prompt: string, options?: { landscape?: boolean; imageModel?: string; references?: string[] }): Promise<{ imageUrl: string; thumbUrl: string }>{
    const body: any = { id, prompt };
    if (options?.landscape) body.landscape = true;
    if (options?.imageModel) body.imageModel = options.imageModel;
    if (Array.isArray(options?.references) && options?.references.length > 0) body.references = options.references;
    return postJson('/api/generate', body, OPENAI_TIMEOUT);
  },
  async improve(id: string, prompt: string): Promise<{ id: string; improved: string }>{
    return postJson('/api/improve', { id, prompt }, OPENAI_TIMEOUT);
  },
  async detectReferences(id: string, prompt: string): Promise<{ id: string; references: string[]; available: string[] }>{
    return postJson('/api/references/detect', { id, prompt }, OPENAI_TIMEOUT);
  },
  async getModels(refresh = false): Promise<ModelsInfo> {
    return withTimeout(async (signal) => {
      const res = await safeFetch(`/api/models${refresh ? '?refresh=1' : ''}`, { signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 60000);
  },
  async saveModels(update: Partial<Record<ModelKind, string | null>>): Promise<ModelsInfo> {
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/models', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update), signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 60000);
  },
  async getGenerationSettings(): Promise<GenerationSettings> {
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/settings/generation', { signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 30000);
  },
  async saveGenerationSettings(update: GenerationSettingsUpdate): Promise<GenerationSettings> {
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/settings/generation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update), signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 30000);
  },
  async listReferences(): Promise<ReferenceItem[]> {
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/references', { signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 30000);
  },
  async addReference(image: File, name: string): Promise<ReferenceItem> {
    const form = new FormData();
    form.append('name', name);
    form.append('image', image, image.name || 'zdjecie.jpg');
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/references', { method: 'POST', body: form, signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 120000);
  },
  async renameReference(fileName: string, name: string): Promise<ReferenceItem> {
    return withTimeout(async (signal) => {
      const res = await safeFetch(`/api/references/${encodeURIComponent(fileName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal,
      });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 30000);
  },
  async deleteReference(fileName: string): Promise<{ ok: true }> {
    return withTimeout(async (signal) => {
      const res = await safeFetch(`/api/references/${encodeURIComponent(fileName)}`, { method: 'DELETE', signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    }, 30000);
  },
  async print(id: string): Promise<{ jobId: string }>{
    return postJson('/api/print', { id });
  },
  async history(): Promise<HistoryItem[]>{
    return withTimeout(async (signal) => {
      const res = await safeFetch('/api/history', { signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    });
  },
  async remove(id: string): Promise<{ ok: true }>{
    return withTimeout(async (signal) => {
      const res = await safeFetch(`/api/history/${id}`, { method: 'DELETE', signal });
      if (!res.ok) throw new Error(await safeText(res));
      return res.json();
    });
  }
};
