import dotenv from 'dotenv';
import path from 'path';
import * as constants from './constants.js';

// Load .env from current working dir and also try parent dir (repo root)
dotenv.config();
try {
  const parentEnv = path.resolve(process.cwd(), '..', '.env');
  dotenv.config({ path: parentEnv });
} catch {}

export const config = {
  port: Number(process.env.PORT) || 3000,
  dataDir: path.resolve('./data'),
  referenceDir: path.resolve('./reference'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  printerUri: process.env.PRINTER_URI || '',
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  imageReferencesModel: process.env.OPENAI_IMAGE_REFERENCES_MODEL || 'gpt-5',
  openaiImageQuality: process.env.OPENAI_IMAGE_QUALITY || '',
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  sttModel: process.env.OPENAI_STT_MODEL || 'whisper-1',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 240000),
  // Prompts with environment variable overrides
  promptColoringBook: process.env.PROMPT_COLORING_BOOK || constants.PROMPT_COLORING_BOOK,
  promptImprove: process.env.PROMPT_IMPROVE || constants.PROMPT_IMPROVE,
  promptDetectReferences: process.env.PROMPT_DETECT_REFERENCES || constants.PROMPT_DETECT_REFERENCES,
};
