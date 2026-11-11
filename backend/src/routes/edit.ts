import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config.js';
import { EXT_PNG, FILE_IMAGE_JPG, FILE_IMAGE_PNG } from '../constants.js';
import { editImage } from '../services/gemini.js';
import { buildImagePrompt, readGenerationSettings } from '../services/generation.js';
import { getModelCatalog, resolveModel } from '../services/models.js';
import { detectReferences } from '../services/references.js';
import { createSession, getSessionDir, readMeta, saveImageBuffer, updateMeta } from '../services/storage.js';
import { ensureThumb } from '../services/thumbs.js';
import { logger } from '../utils/logger.js';
import { isValidId } from '../utils/validation.js';

export const editRouter = Router();

const landscapeRatio = (ratio: string) => {
  const parts = ratio.split(':').map((p) => p.trim());
  return parts.length === 2 ? `${parts[1]}:${parts[0]}` : ratio;
};

// POST /api/edit { sourceId, instruction, id? }
// Corrects an existing picture ("dodaj kota") and stores the result as a new history entry.
// `id` may point at the session created by /api/transcribe for a voice instruction.
editRouter.post('/', async (req: Request, res: Response) => {
  const { sourceId, instruction, id } = req.body || {};
  const text = typeof instruction === 'string' ? instruction.trim() : '';
  if (!config.geminiApiKey) return res.status(503).json({ error: 'Brak konfiguracji GEMINI_API_KEY – poprawki są wyłączone.' });
  if (typeof sourceId !== 'string' || !isValidId(sourceId)) return res.status(400).json({ error: 'Nieprawidłowy rysunek do poprawienia' });
  if (!text) return res.status(400).json({ error: 'Powiedz albo napisz, co zmienić' });
  if (text.length > 1000) return res.status(400).json({ error: 'Opis poprawki jest za długi' });
  if (id !== undefined && (typeof id !== 'string' || !isValidId(id))) return res.status(400).json({ error: 'Nieprawidłowe id' });

  try {
    const sourceDir = getSessionDir(sourceId);
    let sourcePath: string | null = null;
    for (const name of [FILE_IMAGE_PNG, FILE_IMAGE_JPG]) {
      try {
        await fs.access(path.join(sourceDir, name));
        sourcePath = path.join(sourceDir, name);
        break;
      } catch {
        /* try next */
      }
    }
    if (!sourcePath) return res.status(404).json({ error: 'Nie znaleziono rysunku do poprawienia' });

    const sourceMeta = await readMeta(sourceId);
    const sourceBuffer = await fs.readFile(sourcePath);
    const meta = await sharp(sourceBuffer).metadata();
    const isLandscape = (meta.width || 0) > (meta.height || 0);
    const aspectRatio = isLandscape ? landscapeRatio(config.geminiAspectRatio) : config.geminiAspectRatio;

    const settings = await readGenerationSettings();
    const mode = sourceMeta.mode === 'image' || sourceMeta.mode === 'coloring' ? sourceMeta.mode : settings.mode;
    const template = mode === 'image' ? config.promptEditImage : config.promptEditColoring;
    const prompt = buildImagePrompt(template, text);

    // People named in the instruction ("niech tata ma kapelusz") get their reference photos attached
    let newReferences: string[] = [];
    try {
      newReferences = (await detectReferences(text)).references;
    } catch (e: any) {
      logger.warn('Edit: reference detection failed, continuing without', { error: String(e?.message || e) });
    }

    const catalog = await getModelCatalog().catch(() => null);
    const model = (await resolveModel('image', catalog ?? undefined)).id;

    const targetId = id || (await createSession());
    if (id) {
      try { await fs.access(path.join(getSessionDir(id), 'meta.json')); } catch { await createSession(id); }
    }
    logger.info('Edit: start', { sourceId, targetId, instruction: text, mode, model, aspectRatio, newReferences });

    const { buffer, generationTimeMs } = await editImage(
      prompt,
      { data: sourceBuffer, mimeType: sourcePath.endsWith('.png') ? 'image/png' : 'image/jpeg' },
      newReferences,
      { aspectRatio, model },
    );
    await saveImageBuffer(targetId, buffer, EXT_PNG);
    const sourceRefs: string[] = Array.isArray(sourceMeta.references) ? sourceMeta.references : [];
    const references = Array.from(new Set([...sourceRefs, ...newReferences]));
    await updateMeta(targetId, {
      prompt: sourceMeta.prompt || '',
      improvedPrompt: sourceMeta.improvedPrompt || undefined,
      editInstruction: text,
      editedFrom: sourceId,
      references,
      generationTimeMs,
      model,
      mode,
    });
    ensureThumb(targetId).catch(() => {});
    logger.info('Edit: image saved', { targetId, generationTimeMs });
    res.json({ id: targetId, imageUrl: `/files/${targetId}/${FILE_IMAGE_PNG}`, references: newReferences });
  } catch (e: any) {
    const msg = String(e?.message || e);
    logger.error('Edit: error', { sourceId, error: msg });
    res.status(500).json({ error: msg || 'Nie udało się poprawić rysunku' });
  }
});
