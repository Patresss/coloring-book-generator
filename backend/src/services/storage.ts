import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { EXT_JPG, EXT_PNG, FILE_IMAGE_JPG, FILE_IMAGE_PNG } from '../constants.js';
import { isValidId } from '../utils/validation.js';

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export const getSessionDir = (id: string) => {
  if (!isValidId(id)) {
    throw new Error('Invalid session id');
  }
  return path.join(config.dataDir, id);
};

export const initStorage = async () => {
  await ensureDir(config.dataDir);
};

export const createSession = async (id?: string) => {
  const candidate = id || String(Date.now());
  if (!isValidId(candidate)) throw new Error('Invalid session id');
  const sessionId = candidate;
  const dir = getSessionDir(sessionId);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ id: sessionId, createdAt: Date.now() }, null, 2));
  return sessionId;
};

export const readMeta = async (id: string): Promise<any> => {
  const metaPath = path.join(getSessionDir(id), 'meta.json');
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { id };
  }
};

const writeMeta = async (id: string, meta: any) => {
  const dir = getSessionDir(id);
  await ensureDir(dir);
  const metaPath = path.join(dir, 'meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
};

export const updateMeta = async (id: string, patch: Record<string, any>) => {
  const current = await readMeta(id);
  const next = { ...current, ...patch };
  await writeMeta(id, next);
  return next;
};

export const saveAudio = async (id: string, buffer: Buffer, ext = 'webm') => {
  const dir = getSessionDir(id);
  await ensureDir(dir);
  const audioPath = path.join(dir, `audio.${ext}`);
  await fs.writeFile(audioPath, buffer);
  return audioPath;
};

export const savePrompt = async (id: string, prompt: string) => {
  await updateMeta(id, { prompt });
  return path.join(getSessionDir(id), 'meta.json');
};

export const saveImageBuffer = async (id: string, buffer: Buffer, ext: typeof EXT_JPG | typeof EXT_PNG = 'png') => {
  const dir = getSessionDir(id);
  await ensureDir(dir);
  const imagePath = path.join(dir, `image.${ext}`);
  await fs.writeFile(imagePath, buffer);
  return imagePath;
};

export const listHistory = async () => {
  await ensureDir(config.dataDir);
  const entries = await fs.readdir(config.dataDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  const items = await Promise.all(dirs.map(async (id) => {
    const dir = getSessionDir(id);
    const metaPath = path.join(dir, 'meta.json');
    const imageJpg = path.join(dir, FILE_IMAGE_JPG);
    const imagePng = path.join(dir, FILE_IMAGE_PNG);
    let meta: any = { id };
    try {
      const m = await fs.readFile(metaPath, 'utf-8');
      meta = JSON.parse(m);
    } catch {}
    // Only use meta.json; brak kompatybilności wstecznej
    const prompt = meta.prompt || '';
    const improvedPrompt = meta.improvedPrompt || '';
    const hasJpg = fsSync.existsSync(imageJpg);
    const hasPng = fsSync.existsSync(imagePng);
    return {
      id,
      createdAt: meta.createdAt || 0,
      prompt,
      improvedPrompt: improvedPrompt || undefined,
      imageUrl: hasJpg ? `/files/${id}/${FILE_IMAGE_JPG}` : (hasPng ? `/files/${id}/${FILE_IMAGE_PNG}` : undefined),
    };
  }));
  // newest first
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items;
};

export const markPrinted = async (id: string) => {
  try {
    await updateMeta(id, { printedAt: Date.now() });
  } catch (e) {
    logger.warn('Cannot mark printed for', id, e);
  }
};

export const deleteSession = async (id: string) => {
  const dir = getSessionDir(id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    logger.info('Storage: deleted session', { id, dir });
  } catch (e) {
    logger.error('Storage: failed to delete session', { id, dir, e });
    throw e;
  }
};
