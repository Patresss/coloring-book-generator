import { Router, type Request, type Response } from 'express';
import { detectReferences } from '../services/references.js';
import { isValidId } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { updateMeta } from '../services/storage.js';

export const referencesRouter = Router();

// POST /api/references/detect { id, prompt }
referencesRouter.post('/detect', async (req: Request, res: Response) => {
  try {
    const { id, prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Brak promptu' });
    if (id && !isValidId(id)) return res.status(400).json({ error: 'Nieprawidłowe id' });
    logger.info('References: detect route', { id, prompt });
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

