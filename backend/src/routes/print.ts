import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getSessionDir, markPrinted } from '../services/storage.js';
import { printFile } from '../services/printer.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { FILE_IMAGE_JPG, FILE_IMAGE_PNG } from '../constants.js';
import { isValidId } from '../utils/validation.js';

export const printRouter = Router();

printRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Brak id' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    const dir = getSessionDir(id);
    const candidates = [FILE_IMAGE_JPG, FILE_IMAGE_PNG];
    const existing = candidates.map(name => path.join(dir, name)).find(p => fs.existsSync(p));
    if (!existing) return res.status(404).json({ error: 'Brak obrazu do druku (image.jpg/png nie istnieje)' });
    logger.info('Printing: start', { id, file: existing, printer: config.printerUri });
    const jobId = await printFile(existing);
    await markPrinted(id);
    logger.info('Printing: finished', { id, jobId });
    res.json({ jobId, file: path.basename(existing) });
  } catch (e: any) {
    logger.error('Printing: error', e);
    res.status(500).json({ error: e?.message || 'Print error' });
  }
});
