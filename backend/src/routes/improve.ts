import { Router, type Request, type Response } from 'express';
import { improvePrompt } from '../services/openai.js';
import { createSession, updateMeta, getSessionDir } from '../services/storage.js';
import { logger } from '../utils/logger.js';
import { isValidId } from '../utils/validation.js';
import fs from 'fs';
import path from 'path';

export const improveRouter = Router();

improveRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Brak promptu' });
    let sessionId: string = id;
    if (!sessionId) {
      sessionId = await createSession();
    } else if (!isValidId(sessionId)) {
      return res.status(400).json({ error: 'Nieprawidłowe id' });
    } else {
      const dir = getSessionDir(sessionId);
      const metaPath = path.join(dir, 'meta.json');
      if (!fs.existsSync(metaPath)) {
        await createSession(sessionId);
      }
    }
    logger.info('Prompt improvement: start', { id: sessionId, prompt });
    const improved = await improvePrompt(prompt);
    try {
      await updateMeta(sessionId, { improvedPrompt: improved });
    } catch {}
    res.json({ id: sessionId, improved });
  } catch (e: any) {
    logger.error('Prompt improvement: error', e);
    res.status(500).json({ error: e?.message || 'Improve error' });
  }
});
