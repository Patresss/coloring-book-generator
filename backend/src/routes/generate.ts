import { Router, type Request, type Response } from 'express';
import { saveImageBuffer, createSession, getSessionDir, readMeta, updateMeta } from '../services/storage.js';
import { generateImage, generateImageWithReferences } from '../services/gemini.js';
import { logger } from '../utils/logger.js';
import { EXT_PNG, FILE_IMAGE_PNG } from '../constants.js';
import fs from 'fs';
import path from 'path';
import { isValidId } from '../utils/validation.js';
import { config } from '../config.js';
import { getModelCatalog, resolveModel } from '../services/models.js';

export const generateRouter = Router();

const flipAspectRatio = (ratio: string | undefined, landscape: boolean | undefined): string | undefined => {
  if (!ratio || !landscape) return ratio;
  const parts = ratio.split(':').map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return ratio;
  return `${parts[1]}:${parts[0]}`;
};

generateRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!config.geminiApiKey) {
      return res.status(503).json({ error: 'Brak konfiguracji GEMINI_API_KEY – generowanie zablokowane.' });
    }
    const { id, prompt, landscape, imageModel, references } = req.body || {};
    if (!id || !prompt) return res.status(400).json({ error: 'Brak id lub promptu' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    const isLandscape = Boolean(landscape);
    const requestedModel = typeof imageModel === 'string' ? imageModel.trim() : undefined;
    const providedReferences = Array.isArray(references)
      ? references
          .map((ref) => (typeof ref === 'string' ? ref.trim() : ''))
          .filter((ref) => ref.length > 0)
      : [];
    const catalog = await getModelCatalog().catch(() => null);
    const allowedRequested = requestedModel && (catalog?.image.some((m) => m.id === requestedModel) || config.geminiImageModels.includes(requestedModel));
    const resolvedModel = allowedRequested ? requestedModel : (await resolveModel('image', catalog ?? undefined)).id;
    logger.info('Generation: start', {
      id,
      prompt,
      landscape: isLandscape,
      requestedModel,
      model: resolvedModel,
      providedReferences: providedReferences.length,
    });
    const aspectRatio = flipAspectRatio(config.geminiAspectRatio, isLandscape);
    const dir = getSessionDir(id);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      await createSession(id);
    }
    // Nie nadpisuj podstawowego promptu (pochodzi z transkrypcji).
    // Jeśli meta.prompt istnieje i różni się od przekazanego promptu, zapisz jako improvedPrompt.
    // Jeśli meta.prompt nie istnieje, zapisz nowy prompt jako podstawowy.
    try {
      const meta = await readMeta(id);
      if (meta?.prompt && meta.prompt !== prompt) {
        await updateMeta(id, { improvedPrompt: prompt });
      } else if (!meta?.prompt) {
        await updateMeta(id, { prompt });
      }
    } catch {}
    try {
      const meta = await readMeta(id);
      let refs: string[] = Array.isArray(meta?.references) ? meta.references : [];
      if (providedReferences.length > 0) {
        refs = providedReferences;
        try { await updateMeta(id, { references: refs }); } catch {}
      }
      let pngBuffer: Buffer;
      let generationTimeMs: number;
      const generationOpts = { aspectRatio, model: resolvedModel };
      if (refs.length > 0) {
        try {
          const result = await generateImageWithReferences(prompt, refs, generationOpts);
          pngBuffer = result.buffer;
          generationTimeMs = result.generationTimeMs;
        } catch (e: any) {
          logger.error('Generation: reference mode failed', {
            id,
            references: refs,
            error: e?.message || String(e),
          });
          throw e;
        }
      } else {
        const result = await generateImage(prompt, generationOpts);
        pngBuffer = result.buffer;
        generationTimeMs = result.generationTimeMs;
      }

      const imgPath = await saveImageBuffer(id, pngBuffer, EXT_PNG);
      await updateMeta(id, { generationTimeMs, model: resolvedModel });
      logger.info('Generation: image saved', { id, path: imgPath, generationTimeMs, model: resolvedModel });
      res.json({ imageUrl: `/files/${id}/${FILE_IMAGE_PNG}`, thumbUrl: `/files/${id}/${FILE_IMAGE_PNG}`, path: imgPath });
    } catch (e: any) {
      const msg = String(e?.message || e);
      const normalized = msg.toLowerCase();
      if (msg.includes('moderation_blocked') || normalized.includes('safety system') || normalized.includes('system bezpieczeństwa')) {
        logger.warn('Generation: rejected by AI', { id, error: msg });
        return res.status(400).send('Żądanie zostało zablokowane przez system bezpieczeństwa Gemini. Zmień prompt i spróbuj ponownie.');
      }
      throw e;
    }
  } catch (e: any) {
    logger.error('Generation: error', e);
    res.status(500).json({ error: e?.message || 'Generate error' });
  }
});
