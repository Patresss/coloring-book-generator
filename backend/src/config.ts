import dotenv from 'dotenv';
import path from 'path';

// Load .env from current working dir and also try parent dir (repo root)
dotenv.config();
try {
  const parentEnv = path.resolve(process.cwd(), '..', '.env');
  dotenv.config({ path: parentEnv });
} catch {}

export const config = {
  port: Number(process.env.PORT) || 3000,
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  referenceDir: path.resolve(process.env.REFERENCE_DIR || './reference'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  printerUri: process.env.PRINTER_URI || '',
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  openaiImageQuality: process.env.OPENAI_IMAGE_QUALITY || '',
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  sttModel: process.env.OPENAI_STT_MODEL || 'whisper-1',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 120000),
};
