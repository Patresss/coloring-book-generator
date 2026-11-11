import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
  GENERATION_MODES,
  defaultPrompt,
  readGenerationSettings,
  saveGenerationSettings,
  type GenerationSettings,
} from '../services/generation.js';

export const settingsRouter = Router();

const describe = (settings: GenerationSettings) => ({
  mode: settings.mode,
  prompts: Object.fromEntries(GENERATION_MODES.map((mode) => [mode, {
    value: settings.prompts[mode] ?? defaultPrompt(mode),
    default: defaultPrompt(mode),
    custom: settings.prompts[mode] !== undefined,
  }])),
});

// GET /api/settings/generation
settingsRouter.get('/generation', async (_req: Request, res: Response) => {
  try {
    res.json(describe(await readGenerationSettings()));
  } catch (e: any) {
    logger.error('Settings: read error', { error: String(e?.message || e) });
    res.status(500).json({ error: 'Nie udało się odczytać ustawień' });
  }
});

const promptValue = z.string().max(10_000, 'Prompt jest za długi (max 10 000 znaków)').nullable().optional();
const generationSchema = z.object({
  mode: z.enum(['coloring', 'image']).optional(),
  prompts: z.object({ coloring: promptValue, image: promptValue }).optional(),
});

// PUT /api/settings/generation { mode?, prompts?: { coloring?, image? } } — null resets a prompt
settingsRouter.put('/generation', async (req: Request, res: Response) => {
  const parsed = generationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Nieprawidłowe dane' });
  }
  try {
    res.json(describe(await saveGenerationSettings(parsed.data)));
  } catch (e: any) {
    logger.error('Settings: save error', { error: String(e?.message || e) });
    res.status(500).json({ error: 'Nie udało się zapisać ustawień' });
  }
});
