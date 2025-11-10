import { Router, type Request, type Response } from 'express';
import { saveImageBuffer, createSession, getSessionDir, readMeta, updateMeta } from '../services/storage.js';
import { generateImage } from '../services/openai.js';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';
import { EXT_JPG, FILE_IMAGE_JPG } from '../constants.js';
import fs from 'fs';
import path from 'path';
import { isValidId } from '../utils/validation.js';

export const generateRouter = Router();

generateRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'Brak konfiguracji OPENAI_API_KEY – generowanie zablokowane.' });
    }
    const { id, prompt } = req.body || {};
    if (!id || !prompt) return res.status(400).json({ error: 'Brak id lub promptu' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    logger.info('Generowanie: start', { id, prompt });
    const dir = getSessionDir(id);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      await createSession(id);
    }
    // Nie nadpisuj podstawowego promptu (pochodzi z transkrypcji).
    // Jeśli meta.prompt istnieje i różni się od przekazanego promptu, zapisz jako improvedPrompt.
    try {
      const meta = await readMeta(id);
      if (meta?.prompt && meta.prompt !== prompt) {
        await updateMeta(id, { improvedPrompt: prompt });
      }
    } catch {}
    try {
      const pngBuffer = await generateImage(prompt);
      const source = pngBuffer;
      const jpg = await sharp(source).flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 95 }).toBuffer();
      const imgPath = await saveImageBuffer(id, jpg, EXT_JPG);
      logger.info('Generowanie: zapisano obraz', { id, path: imgPath });
      res.json({ imageUrl: `/files/${id}/${FILE_IMAGE_JPG}`, thumbUrl: `/files/${id}/${FILE_IMAGE_JPG}`, path: imgPath });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('moderation_blocked') || msg.toLowerCase().includes('safety system')) {
        logger.warn('Generowanie: odrzucone przez AI', { id, error: msg });
        return res.status(400).send('Żądanie zostało zablokowane przez system bezpieczeństwa OpenAI. Zmień prompt i spróbuj ponownie.');
      }
      throw e;
    }
  } catch (e: any) {
    logger.error('Generowanie: błąd', e);
    res.status(500).json({ error: e?.message || 'Generate error' });
  }
});
