import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
  getModelCatalog,
  recommendedModel,
  resolveModel,
  saveModelSelection,
  type ModelCatalog,
  type ModelKind,
} from '../services/models.js';

export const modelsRouter = Router();

const KINDS: ModelKind[] = ['image', 'text', 'stt'];

const describe = async (catalog: ModelCatalog) => {
  const entries = await Promise.all(KINDS.map(async (kind) => {
    const active = await resolveModel(kind, catalog);
    const options = [...catalog[kind]];
    // Keep the active model visible even if the API list does not contain it
    if (!options.some((o) => o.id === active.id)) options.unshift({ id: active.id });
    return [kind, {
      options,
      active: active.id,
      source: active.source,
      recommended: recommendedModel(catalog, kind) ?? null,
    }] as const;
  }));
  return {
    ...Object.fromEntries(entries),
    fetchedAt: catalog.fetchedAt,
    errors: catalog.errors,
  };
};

// GET /api/models[?refresh=1]
modelsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const catalog = await getModelCatalog(req.query.refresh === '1');
    res.json(await describe(catalog));
  } catch (e: any) {
    logger.error('Models: list error', { error: String(e?.message || e) });
    res.status(500).json({ error: 'Nie udało się pobrać listy modeli' });
  }
});

const selectionSchema = z.object({
  image: z.string().trim().max(200).nullable().optional(),
  text: z.string().trim().max(200).nullable().optional(),
  stt: z.string().trim().max(200).nullable().optional(),
});

// PUT /api/models { image?, text?, stt? } — null or '' resets to the default
modelsRouter.put('/', async (req: Request, res: Response) => {
  const parsed = selectionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe dane' });
  try {
    const catalog = await getModelCatalog();
    const update: Partial<Record<ModelKind, string>> = {};
    for (const kind of KINDS) {
      const value = parsed.data[kind];
      if (value === undefined) continue;
      if (value && catalog[kind].length > 0 && !catalog[kind].some((o) => o.id === value)) {
        return res.status(400).json({ error: `Model ${value} nie jest dostępny` });
      }
      update[kind] = value || '';
    }
    await saveModelSelection(update);
    res.json(await describe(catalog));
  } catch (e: any) {
    logger.error('Models: save error', { error: String(e?.message || e) });
    res.status(500).json({ error: 'Nie udało się zapisać wyboru modeli' });
  }
});
