import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { createOpenAIClient } from './openai.js';

export type ModelKind = 'image' | 'text' | 'stt';

export type ModelOption = { id: string; label?: string };

export type ModelCatalog = {
  image: ModelOption[];
  text: ModelOption[];
  stt: ModelOption[];
  fetchedAt: number;
  errors: Partial<Record<'gemini' | 'openai', string>>;
};

export type ModelSelection = Partial<Record<ModelKind, string>>;

const CATALOG_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Przekroczono czas pobierania listy modeli (${label})`)), FETCH_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(t));
  });
const SETTINGS_FILE = 'settings.json';

// Preferred order when picking the default ("best") model; first available wins.
const IMAGE_PREFERENCE = [
  'gemini-3-pro-image',
  'gemini-3-pro-image-preview',
  'nano-banana-pro-preview',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];
// Text model is used for prompt improvement and reference detection: short calls,
// so a balanced model beats the slowest/most expensive one.
const TEXT_PREFERENCE = [
  'gpt-6.1-sol',
  'gpt-6-sol',
  'gpt-6-astra',
  'gpt-6.1-terra',
  'gpt-5.5',
];
const STT_PREFERENCE = [
  'gpt-transcribe',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  'whisper-1',
];

const FALLBACK: Record<ModelKind, string> = {
  image: 'gemini-3-pro-image',
  text: 'gpt-6.1-sol',
  stt: 'gpt-transcribe',
};

// Model ids that cannot be used with the endpoints this app calls.
const TEXT_EXCLUDE = /(audio|realtime|tts|transcribe|whisper|image|embedding|search|instruct|moderation|codex|computer|dall-e|davinci|babbage|live|translate|diarize|sora|deep-research|-pro\b|oss)/;
const STT_EXCLUDE = /(live|realtime|diarize|tts)/;
const DATED_SNAPSHOT = /-\d{4}-\d{2}-\d{2}$|-\d{4}$/;

const envDefault = (kind: ModelKind): string | undefined => {
  if (kind === 'image') return process.env.GEMINI_IMAGE_MODELS ? config.geminiImageModel : undefined;
  if (kind === 'text') return process.env.OPENAI_TEXT_MODEL || undefined;
  return process.env.OPENAI_STT_MODEL || undefined;
};

const stripPrefix = (name: string) => name.replace(/^models\//, '');

const fetchGeminiImageModels = async (): Promise<ModelOption[]> => {
  const client = new GoogleGenAI({
    apiKey: config.geminiApiKey,
    httpOptions: { apiVersion: config.geminiApiVersion },
  });
  const pager = await client.models.list({ config: { pageSize: 1000 } });
  const out: ModelOption[] = [];
  for await (const model of pager) {
    const id = stripPrefix(model.name || '');
    const label = model.displayName || undefined;
    const actions = model.supportedActions || [];
    const isImage = id.includes('image') || /nano banana/i.test(label || '') || id.includes('nano-banana');
    if (id && isImage && actions.includes('generateContent')) {
      out.push({ id, label });
    }
  }
  return out;
};

const fetchOpenAIModels = async (): Promise<{ text: ModelOption[]; stt: ModelOption[] }> => {
  const client = createOpenAIClient();
  const ids: string[] = [];
  for await (const model of client.models.list()) {
    ids.push(model.id);
  }
  const text = ids
    .filter((id) => /^(gpt-\d|o\d)/.test(id) && !TEXT_EXCLUDE.test(id) && !DATED_SNAPSHOT.test(id))
    .map((id) => ({ id }));
  const stt = ids
    .filter((id) => /(transcribe|whisper)/.test(id) && !STT_EXCLUDE.test(id) && !DATED_SNAPSHOT.test(id))
    .map((id) => ({ id }));
  return { text, stt };
};

// Sort key for GPT text models: newest generation first, then by tier (strongest first).
const TEXT_TIERS: Record<string, number> = {
  '': 0, '-astra': 0, '-sol': 1, '-terra': 2, '-mini': 2, '-luna': 3, '-nano': 3,
};
const textRank = (id: string): [number, number] => {
  const m = id.match(/^gpt-(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return [0, 9];
  return [Number(m[1]), TEXT_TIERS[m[2]] ?? 5];
};

const sortText = (options: ModelOption[]) => {
  const sorted = [...options].sort((a, b) => {
    const [va, ta] = textRank(a.id);
    const [vb, tb] = textRank(b.id);
    return vb - va || ta - tb || a.id.localeCompare(b.id);
  });
  // Put the preferred default first so it becomes the recommended model
  const preferred = TEXT_PREFERENCE.find((id) => sorted.some((o) => o.id === id));
  if (!preferred) return sorted;
  return [sorted.find((o) => o.id === preferred)!, ...sorted.filter((o) => o.id !== preferred)];
};

const sortByPreference = (options: ModelOption[], preference: string[]) =>
  [...options].sort((a, b) => {
    const ia = preference.indexOf(a.id);
    const ib = preference.indexOf(b.id);
    const ra = ia === -1 ? preference.length : ia;
    const rb = ib === -1 ? preference.length : ib;
    return ra - rb || a.id.localeCompare(b.id);
  });

let catalogCache: ModelCatalog | null = null;
let catalogInFlight: Promise<ModelCatalog> | null = null;

const buildCatalog = async (): Promise<ModelCatalog> => {
  const errors: ModelCatalog['errors'] = {};
  let image: ModelOption[] = [];
  let text: ModelOption[] = [];
  let stt: ModelOption[] = [];

  const [gemini, openai] = await Promise.allSettled([
    config.geminiApiKey ? withTimeout(fetchGeminiImageModels(), 'Gemini') : Promise.reject(new Error('Brak GEMINI_API_KEY')),
    config.openaiApiKey ? withTimeout(fetchOpenAIModels(), 'OpenAI') : Promise.reject(new Error('Brak OPENAI_API_KEY')),
  ]);
  if (gemini.status === 'fulfilled') image = gemini.value;
  else errors.gemini = String(gemini.reason?.message || gemini.reason);
  if (openai.status === 'fulfilled') ({ text, stt } = openai.value);
  else errors.openai = String(openai.reason?.message || openai.reason);

  if (errors.gemini || errors.openai) {
    logger.warn('Models: failed to fetch some model lists', errors);
  }

  return {
    image: sortByPreference(image, IMAGE_PREFERENCE),
    text: sortText(text),
    stt: sortByPreference(stt, STT_PREFERENCE),
    fetchedAt: Date.now(),
    errors,
  };
};

export const getModelCatalog = async (refresh = false): Promise<ModelCatalog> => {
  if (!refresh && catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return catalogCache;
  }
  if (!catalogInFlight) {
    catalogInFlight = buildCatalog()
      .then((catalog) => {
        // Keep the previous list if a refresh fails completely
        const failed = catalog.image.length === 0 && catalog.text.length === 0 && catalog.stt.length === 0;
        if (!failed || !catalogCache) catalogCache = catalog;
        return failed && catalogCache ? { ...catalogCache, errors: catalog.errors } : catalog;
      })
      .finally(() => { catalogInFlight = null; });
  }
  return catalogInFlight;
};

export const recommendedModel = (catalog: ModelCatalog, kind: ModelKind): string | undefined =>
  catalog[kind][0]?.id;

const settingsPath = () => path.join(config.dataDir, SETTINGS_FILE);
let selectionCache: ModelSelection | null = null;

export const readModelSelection = async (): Promise<ModelSelection> => {
  if (selectionCache) return selectionCache;
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath(), 'utf-8'));
    const models = raw?.models ?? {};
    selectionCache = {
      image: typeof models.image === 'string' ? models.image : undefined,
      text: typeof models.text === 'string' ? models.text : undefined,
      stt: typeof models.stt === 'string' ? models.stt : undefined,
    };
  } catch {
    selectionCache = {};
  }
  return selectionCache;
};

export const saveModelSelection = async (update: ModelSelection): Promise<ModelSelection> => {
  const current = await readModelSelection();
  const next: ModelSelection = { ...current };
  for (const kind of ['image', 'text', 'stt'] as ModelKind[]) {
    if (!(kind in update)) continue;
    const value = update[kind];
    if (value) next[kind] = value;
    else delete next[kind]; // empty value = back to the default
  }
  let existing: any = {};
  try { existing = JSON.parse(await fs.readFile(settingsPath(), 'utf-8')); } catch {}
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({ ...existing, models: next }, null, 2));
  selectionCache = next;
  logger.info('Models: selection saved', next);
  return next;
};

export type ResolvedModel = { id: string; source: 'selected' | 'env' | 'recommended' | 'fallback' };

// Order: model picked in the UI > env variable > best model from the API list > hardcoded fallback.
export const resolveModel = async (kind: ModelKind, catalog?: ModelCatalog): Promise<ResolvedModel> => {
  const selection = await readModelSelection();
  if (selection[kind]) return { id: selection[kind]!, source: 'selected' };
  const fromEnv = envDefault(kind);
  if (fromEnv) return { id: fromEnv, source: 'env' };
  try {
    const cat = catalog ?? await getModelCatalog();
    const best = recommendedModel(cat, kind);
    if (best) return { id: best, source: 'recommended' };
  } catch {}
  return { id: FALLBACK[kind], source: 'fallback' };
};

export const getModel = async (kind: ModelKind): Promise<string> => (await resolveModel(kind)).id;
