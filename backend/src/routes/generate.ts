import { Router, type Request, type Response } from 'express';
import { saveImageBuffer, createSession, getSessionDir, readMeta, updateMeta } from '../services/storage.js';
import { generateImage, generateImageWithReferences, uploadReferenceFiles } from '../services/openai.js';
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
    const { id, prompt, forceHighQuality, quality } = req.body || {};
    if (!id || !prompt) return res.status(400).json({ error: 'Brak id lub promptu' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    const qualityOverride: string | undefined = (typeof quality === 'string' && quality.trim()) ? String(quality).trim() : (forceHighQuality ? 'high' : undefined);
    logger.info('Generation: start', { id, prompt, qualityOverride: qualityOverride || 'default' });
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
      // Try reference-aware generation if references exist in meta
      let pngBuffer: Buffer | null = null;
      try {
        const meta = await readMeta(id);
        const refs: string[] = Array.isArray(meta?.references) ? meta.references : [];
        if (refs.length > 0) {
          const { fileIds } = await uploadReferenceFiles(refs);
          if (fileIds.length > 0) {
            pngBuffer = await generateImageWithReferences(prompt, fileIds, { qualityOverride });
          }
        }
      } catch (e) {
        // Do not treat as fatal for generation; proceed without references
        logger.warn('Generation: reference generation failed, fallback to standard', { id, error: String((e as any)?.message || e) });
      }
      
      // Fallback to standard generation if references failed or unavailable
      if (!pngBuffer) {
        pngBuffer = await generateImage(prompt, { qualityOverride });
      }
      
      const source = pngBuffer;
      const jpg = await sharp(source).flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 95 }).toBuffer();
      const imgPath = await saveImageBuffer(id, jpg, EXT_JPG);
      logger.info('Generation: image saved', { id, path: imgPath });
      res.json({ imageUrl: `/files/${id}/${FILE_IMAGE_JPG}`, thumbUrl: `/files/${id}/${FILE_IMAGE_JPG}`, path: imgPath });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('moderation_blocked') || msg.toLowerCase().includes('safety system')) {
        logger.warn('Generation: rejected by AI', { id, error: msg });
        return res.status(400).send('Żądanie zostało zablokowane przez system bezpieczeństwa OpenAI. Zmień prompt i spróbuj ponownie.');
      }
      throw e;
    }
  } catch (e: any) {
    logger.error('Generation: error', e);
    res.status(500).json({ error: e?.message || 'Generate error' });
  }
});
