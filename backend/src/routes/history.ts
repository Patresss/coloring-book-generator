import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { deleteSession, getSessionDir, listHistory, readMeta } from '../services/storage.js';
import { imageToA4Pdf } from '../services/pdf.js';
import { FILE_IMAGE_JPG, FILE_IMAGE_PNG } from '../constants.js';
import { logger } from '../utils/logger.js';
import { isValidId } from '../utils/validation.js';

export const historyRouter = Router();

historyRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await listHistory();
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'History error' });
  }
});

// GET /api/history/:id/pdf – the picture on an A4 page, ready to print anywhere
historyRouter.get('/:id/pdf', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
  try {
    const dir = getSessionDir(id);
    let image: Buffer | null = null;
    for (const name of [FILE_IMAGE_PNG, FILE_IMAGE_JPG]) {
      try {
        image = await fs.readFile(path.join(dir, name));
        break;
      } catch {
        /* try next */
      }
    }
    if (!image) return res.status(404).json({ error: 'Nie znaleziono rysunku' });
    const meta = await readMeta(id);
    const pdf = await imageToA4Pdf(image, meta?.prompt ? `Kolorowanka: ${meta.prompt}` : 'Kolorowanka');
    const date = new Date(meta?.createdAt || Date.now()).toISOString().slice(0, 10);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="kolorowanka-${date}-${id}.pdf"`);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(pdf);
  } catch (e: any) {
    logger.error('History: PDF error', { id, error: String(e?.message || e) });
    res.status(500).json({ error: 'Nie udało się przygotować PDF' });
  }
});

historyRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ error: 'Brak id' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    await deleteSession(id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Delete error' });
  }
});
