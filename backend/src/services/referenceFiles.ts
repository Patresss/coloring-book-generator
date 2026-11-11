import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Management of reference images (family members) in REFERENCE_DIR.
// Deleted files are moved to REFERENCE_DIR/.trash so nothing is lost by accident.

export const REFERENCE_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TRASH_DIR = '.trash';
const MAX_EDGE_PX = 1280; // big enough for faces, small enough for Gemini requests
const JPEG_QUALITY = 85;

export type ReferenceInfo = {
  name: string; // file name, e.g. "Achim - Dziadek.jpg"
  size: number;
  updatedAt: number;
};

export class ReferenceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Letters (any language), digits, spaces and a few separators; no path characters.
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._()'’-]{0,79}$/u;

export const validateBaseName = (raw: unknown): string => {
  const base = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!base) throw new ReferenceError('Podaj nazwę osoby', 400);
  if (!NAME_PATTERN.test(base) || base.endsWith('.')) {
    throw new ReferenceError('Nazwa może zawierać tylko litery, cyfry, spacje i znaki - _ . ( )', 400);
  }
  return base;
};

const resolveExisting = async (fileName: string): Promise<string> => {
  const name = String(fileName ?? '');
  if (!name || name !== path.basename(name) || name.startsWith('.') || !REFERENCE_IMAGE_EXTS.has(path.extname(name).toLowerCase())) {
    throw new ReferenceError('Nieprawidłowa nazwa pliku', 400);
  }
  const full = path.join(config.referenceDir, name);
  try {
    const stat = await fs.stat(full);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    throw new ReferenceError('Nie ma takiej osoby', 404);
  }
  return full;
};

const existsCaseInsensitive = async (fileName: string, except?: string): Promise<boolean> => {
  const lower = fileName.toLocaleLowerCase('pl-PL');
  const all = await listReferences();
  return all.some((r) => r.name !== except && r.name.toLocaleLowerCase('pl-PL') === lower);
};

export const listReferences = async (): Promise<ReferenceInfo[]> => {
  let entries: import('fs').Dirent[] = [];
  try {
    entries = await fs.readdir(config.referenceDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.') && REFERENCE_IMAGE_EXTS.has(path.extname(e.name).toLowerCase()));
  const infos = await Promise.all(files.map(async (e) => {
    const stat = await fs.stat(path.join(config.referenceDir, e.name));
    return { name: e.name, size: stat.size, updatedAt: stat.mtimeMs };
  }));
  return infos.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
};

export const referencePath = resolveExisting;

// Normalizes any uploaded photo (HEIC from iPhone is not supported by sharp builds without libheif)
// to an upright JPEG with a sensible size.
export const addReference = async (baseName: string, data: Buffer): Promise<ReferenceInfo> => {
  const base = validateBaseName(baseName);
  const fileName = `${base}.jpg`;
  if (await existsCaseInsensitive(fileName)) throw new ReferenceError('Osoba o takiej nazwie już istnieje', 409);
  let jpeg: Buffer;
  try {
    jpeg = await sharp(data)
      .rotate()
      .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (e: any) {
    logger.warn('References: cannot decode upload', { error: String(e?.message || e) });
    throw new ReferenceError('Nie udało się odczytać zdjęcia. Użyj pliku JPG, PNG lub WEBP.', 400);
  }
  await fs.mkdir(config.referenceDir, { recursive: true });
  const full = path.join(config.referenceDir, fileName);
  await fs.writeFile(full, jpeg, { flag: 'wx' });
  logger.info('References: added', { fileName, bytes: jpeg.byteLength });
  const stat = await fs.stat(full);
  return { name: fileName, size: stat.size, updatedAt: stat.mtimeMs };
};

export const renameReference = async (fileName: string, newBaseName: string): Promise<ReferenceInfo> => {
  const from = await resolveExisting(fileName);
  const base = validateBaseName(newBaseName);
  const newName = `${base}${path.extname(fileName).toLowerCase()}`;
  if (newName === fileName) {
    const stat = await fs.stat(from);
    return { name: fileName, size: stat.size, updatedAt: stat.mtimeMs };
  }
  if (await existsCaseInsensitive(newName, fileName)) throw new ReferenceError('Osoba o takiej nazwie już istnieje', 409);
  const to = path.join(config.referenceDir, newName);
  await fs.rename(from, to);
  logger.info('References: renamed', { from: fileName, to: newName });
  await renameInHistory(fileName, newName);
  const stat = await fs.stat(to);
  return { name: newName, size: stat.size, updatedAt: stat.mtimeMs };
};

export const deleteReference = async (fileName: string): Promise<void> => {
  const from = await resolveExisting(fileName);
  const trash = path.join(config.referenceDir, TRASH_DIR);
  await fs.mkdir(trash, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.rename(from, path.join(trash, `${stamp} ${fileName}`));
  logger.info('References: moved to trash', { fileName });
};

// Keep old coloring pages pointing at the renamed file, so "generate again" still finds the person.
const renameInHistory = async (oldName: string, newName: string) => {
  let dirs: import('fs').Dirent[] = [];
  try {
    dirs = await fs.readdir(config.dataDir, { withFileTypes: true });
  } catch {
    return;
  }
  let updated = 0;
  await Promise.all(dirs.filter((d) => d.isDirectory()).map(async (d) => {
    const metaPath = path.join(config.dataDir, d.name, 'meta.json');
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      if (!Array.isArray(meta.references) || !meta.references.includes(oldName)) return;
      meta.references = meta.references.map((r: string) => (r === oldName ? newName : r));
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      updated++;
    } catch {
      /* skip unreadable sessions */
    }
  }));
  if (updated) logger.info('References: history updated after rename', { oldName, newName, sessions: updated });
};
