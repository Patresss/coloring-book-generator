import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { FILE_IMAGE_JPG, FILE_IMAGE_PNG } from '../constants.js';
import { getSessionDir } from './storage.js';
import { logger } from '../utils/logger.js';

// Small JPEG previews for the history list – a full page PNG is ~1–2 MB, the thumbnail ~40 KB.
export const FILE_THUMB = 'thumb.jpg';
const THUMB_WIDTH = 480;

const inFlight = new Map<string, Promise<string>>();

const sourceImage = async (dir: string) => {
  for (const name of [FILE_IMAGE_PNG, FILE_IMAGE_JPG]) {
    try {
      const full = path.join(dir, name);
      const stat = await fs.stat(full);
      return { full, mtimeMs: stat.mtimeMs };
    } catch {
      /* try next */
    }
  }
  return null;
};

// Returns the thumbnail path, (re)creating it when missing or older than the image.
export const ensureThumb = async (id: string): Promise<string | null> => {
  const dir = getSessionDir(id);
  const src = await sourceImage(dir);
  if (!src) return null;
  const thumbPath = path.join(dir, FILE_THUMB);
  try {
    const stat = await fs.stat(thumbPath);
    if (stat.mtimeMs >= src.mtimeMs) return thumbPath;
  } catch {
    /* not created yet */
  }
  const pending = inFlight.get(id);
  if (pending) return pending;
  const job = (async () => {
    const tmp = `${thumbPath}.${process.pid}.tmp`;
    await sharp(src.full)
      .flatten({ background: '#ffffff' })
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(tmp);
    await fs.rename(tmp, thumbPath);
    return thumbPath;
  })();
  inFlight.set(id, job);
  try {
    return await job;
  } catch (e: any) {
    logger.warn('Thumbs: failed to create thumbnail', { id, error: String(e?.message || e) });
    return null;
  } finally {
    inFlight.delete(id);
  }
};
