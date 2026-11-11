import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import { getModel } from '../services/models.js';

export const configRouter = Router();

configRouter.get('/', async (_req: Request, res: Response) => {
  const expectedEnv = [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'PRINTER_URI'
  ];
  const missingEnv = expectedEnv.filter((k) => !process.env[k]);
  const canGenerate = !!config.geminiApiKey; // blokujemy generowanie bez klucza Gemini
  res.json({
    openaiTimeoutMs: config.openaiTimeoutMs,
    geminiTimeoutMs: config.geminiTimeoutMs,
    imageModel: await getModel('image'),
    geminiAspectRatio: config.geminiAspectRatio,
    textModel: await getModel('text'),
    sttModel: await getModel('stt'),
    printerUri: config.printerUri,
    missingEnv,
    canGenerate,
  });
});
