import { Router, type Request, type Response } from 'express';
import { detectReferences } from '../services/references.js';
import { isValidId } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { updateMeta, createSession, getSessionDir } from '../services/storage.js';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { makeRateLimit } from '../utils/rateLimit.js';
import {
  ReferenceError,
  addReference,
  deleteReference,
  listReferences,
  referencePath,
  renameReference,
} from '../services/referenceFiles.js';

export const referencesRouter = Router();

const detectLimit = makeRateLimit(20, 60_000);
const manageLimit = makeRateLimit(30, 60_000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new ReferenceError('To nie jest zdjęcie', 400));
    cb(null, true);
  },
});

const sendError = (res: Response, e: any, fallback: string) => {
  if (e instanceof ReferenceError) return res.status(e.status).json({ error: e.message });
  if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Zdjęcie jest za duże (max 25 MB)' });
  logger.error('References: manage error', { error: String(e?.message || e) });
  return res.status(500).json({ error: fallback });
};

const fileUrl = (name: string, updatedAt: number) =>
  `/api/references/file/${encodeURIComponent(name)}?v=${Math.round(updatedAt)}`;

// GET /api/references – all reference images
referencesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await listReferences();
    res.json(items.map((r) => ({ ...r, url: fileUrl(r.name, r.updatedAt) })));
  } catch (e) {
    sendError(res, e, 'Nie udało się wczytać osób');
  }
});

// GET /api/references/file/:name – the image itself (no rate limit: the grid loads many at once)
referencesRouter.get('/file/:name', async (req: Request, res: Response) => {
  try {
    const full = await referencePath(req.params.name);
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(full);
  } catch (e) {
    sendError(res, e, 'Nie udało się wczytać zdjęcia');
  }
});

// POST /api/references (multipart: image, name) – adds a new person
referencesRouter.post('/', manageLimit, (req: Request, res: Response) => {
  upload.single('image')(req, res, async (err: any) => {
    if (err) return sendError(res, err, 'Nie udało się wysłać zdjęcia');
    try {
      if (!req.file) return res.status(400).json({ error: 'Wybierz zdjęcie' });
      const info = await addReference(req.body?.name, req.file.buffer);
      res.status(201).json({ ...info, url: fileUrl(info.name, info.updatedAt) });
    } catch (e) {
      sendError(res, e, 'Nie udało się dodać osoby');
    }
  });
});

// PATCH /api/references/:name { name } – renames a person (extension is kept)
referencesRouter.patch('/:name', manageLimit, async (req: Request, res: Response) => {
  try {
    const info = await renameReference(req.params.name, req.body?.name);
    res.json({ ...info, url: fileUrl(info.name, info.updatedAt) });
  } catch (e) {
    sendError(res, e, 'Nie udało się zmienić nazwy');
  }
});

// DELETE /api/references/:name – moves the image to REFERENCE_DIR/.trash
referencesRouter.delete('/:name', manageLimit, async (req: Request, res: Response) => {
  try {
    await deleteReference(req.params.name);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e, 'Nie udało się usunąć osoby');
  }
});

// POST /api/references/detect { id, prompt }
referencesRouter.post('/detect', detectLimit, async (req: Request, res: Response) => {
  try {
    const { id, prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Brak promptu' });
    if (id && !isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    logger.info('References: detect route', { id, prompt });
    // Ensure session exists if id is provided
    if (id) {
      const metaPath = path.join(getSessionDir(id), 'meta.json');
      if (!fs.existsSync(metaPath)) {
        await createSession(id);
      }
    }
    const result = await detectReferences(prompt);
    if (id) {
      try { await updateMeta(id, { references: result.references }); } catch {}
    }
    res.json({ id, references: result.references, available: result.available });
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Per requirement: problems during searching should be an error (empty list is not an error)
    logger.error('References: detect error', { error: msg });
    res.status(500).json({ error: msg || 'Błąd wyszukiwania referencji' });
  }
});

