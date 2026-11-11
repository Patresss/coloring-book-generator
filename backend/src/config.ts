import dotenv from 'dotenv';
import path from 'path';
import * as constants from './constants.js';

// Load .env from current working dir and also try parent dir (repo root)
dotenv.config();
try {
  const parentEnv = path.resolve(process.cwd(), '..', '.env');
  dotenv.config({ path: parentEnv });
} catch {}

const parseList = (value?: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const defaultGeminiImageModels = ['gemini-3-pro-image', 'gemini-nano-banana-2.1'];
const configuredImageModels = parseList(process.env.GEMINI_IMAGE_MODELS);
const fallbackImageModels = configuredImageModels.length > 0 ? configuredImageModels : defaultGeminiImageModels;
const primaryGeminiModel = fallbackImageModels[0] || defaultGeminiImageModels[0];
const geminiImageModels = Array.from(new Set([primaryGeminiModel, ...fallbackImageModels]));

export const config = {
  port: Number(process.env.PORT) || 3000,
  dataDir: path.resolve(process.env.DATA_DIR || '../data'),
  referenceDir: path.resolve(process.env.REFERENCE_DIR || '../reference'),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiImageModel: primaryGeminiModel,
  geminiImageModels,
  geminiAspectRatio: process.env.GEMINI_IMAGE_ASPECT_RATIO || '2:3',
  geminiImageSize: (process.env.GEMINI_IMAGE_SIZE as '1K' | '2K' | '4K' | undefined) || '1K',
  geminiApiVersion: (process.env.GEMINI_API_VERSION as 'v1' | 'v1beta' | 'v1alpha' | undefined) || 'v1beta',
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 600000),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  printerUri: process.env.PRINTER_URI || '',
  imageReferencesModel: process.env.OPENAI_IMAGE_REFERENCES_MODEL || 'gpt-5',
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-6.1-sol',
  sttModel: process.env.OPENAI_STT_MODEL || 'gpt-transcribe',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 240000),
  // Prompts with environment variable overrides
  promptColoringBook: process.env.PROMPT_COLORING_BOOK || constants.PROMPT_COLORING_BOOK,
  promptImprove: process.env.PROMPT_IMPROVE || constants.PROMPT_IMPROVE,
  promptImage: process.env.PROMPT_IMAGE || constants.PROMPT_IMAGE,
  promptImproveImage: process.env.PROMPT_IMPROVE_IMAGE || constants.PROMPT_IMPROVE_IMAGE,
  promptEditColoring: process.env.PROMPT_EDIT_COLORING || constants.PROMPT_EDIT_COLORING,
  promptEditImage: process.env.PROMPT_EDIT_IMAGE || constants.PROMPT_EDIT_IMAGE,
  promptDetectReferences: process.env.PROMPT_DETECT_REFERENCES || constants.PROMPT_DETECT_REFERENCES,
};
