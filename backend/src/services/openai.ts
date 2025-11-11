import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getClient() {
  return new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs });
}

// For file uploads, use longer timeout (5 minutes) to avoid connection issues
function getClientForFileUpload() {
  return new OpenAI({ apiKey: config.openaiApiKey, timeout: 5 * 60 * 1000 });
}

export const transcribeAudio = async (audioPath: string): Promise<string> => {
  if (!config.openaiApiKey) {
    // Fallback for local testing without API key
    return 'Smok, zamek i rycerz';
  }
  const fileBuf = await fs.readFile(audioPath);
  logger.info('OpenAI: transcribe call', { audioPath, bytes: fileBuf.byteLength });

  const client = getClient();
  const fileStream = fsSync.createReadStream(audioPath);
  const resp = await client.audio.transcriptions.create({
    file: fileStream as any,
    model: config.sttModel || 'whisper-1',
    language: 'pl',
  });
  return (resp as any).text || '';
};

export const generateImage = async (prompt: string, opts?: { qualityOverride?: string }): Promise<Buffer> => {
  if (!config.openaiApiKey) {
    throw new Error('Brak konfiguracji OPENAI_API_KEY');
  }
  const p = `Narysuj czarno-białą ilustrację do kolorowania (line art, wyraźne kontury, bez tła, brak szarości, brak cieniowania), temat: '${prompt}'. Styl przyjazny dla dzieci. Nie dodawaj żadnego tekstu na obrazku, chyba ze jest to wprost wymagane przez prompt.`;
  const model = config.imageModel || 'gpt-image-1';
  // Map model -> preferred size. If not present, omit size to use API default.
  const MODEL_SIZE_MAP: Record<string, string> = {
    'gpt-image-1': '1536x1024',
    'dall-e-3': '1792x1024',
  };
  const size = MODEL_SIZE_MAP[model as keyof typeof MODEL_SIZE_MAP];
  const quality = (opts?.qualityOverride || config.openaiImageQuality || '').trim();
  logger.info('OpenAI: image generation prompt', { original: prompt, composed: p, model, size: size ?? 'default', quality: quality || 'default' });

  const client = getClient();
  // simple retry for transient errors (2 retries). Do NOT retry user errors (e.g., moderation).
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const isDalle3 = model === 'dall-e-3';
      const isGptImage1 = model === 'gpt-image-1';
      const result = await client.images.generate({
        model,
        prompt: p,
        ...(size ? { size } : {}),
        ...(isDalle3 ? { response_format: 'b64_json' } : {}),
        ...(quality ? { quality } : {}),
        ...(isGptImage1 ? { background: 'transparent' } : {}),
      } as any);
      logger.info('Image generated', { prompt });

      const b64 = (result as any)?.data?.[0]?.b64_json;
      if (!b64) throw new Error('Brak danych obrazu z OpenAI');
      return Buffer.from(b64, 'base64');
    } catch (e: any) {
      const msg = String(e?.message || e);
      lastErr = e;
      logger.warn('OpenAI: image attempt failed', { attempt, error: msg, status: e?.status });
      const status = e?.status as number | undefined;
      const isTransient = status === 429 || (status !== undefined && status >= 500);
      if (!isTransient) throw e;
    }
  }
  throw lastErr || new Error('OpenAI image failed');
};

export const improvePrompt = async (original: string): Promise<string> => {
  if (!config.openaiApiKey) {
    // Fallback for local dev: return original prompt
    return original;
  }
  const system = 'Jesteś asystentem, który ulepsza krótkie prompty do generowania kolorowanek (line art). Zwracaj wyłącznie ulepszony prompt, bez cudzysłowów, bez komentarzy. Ulepszony prompt ma dotyczyć tylko zawartości kolorowanki dla dzieci, . Wiemy jak odpowiednio przygotować kolrowanke';
  const user = `Ulepsz ten prompt tak, aby powstała kolorowanka dla dzieci: \n\n"${original}"\n\n = przyjazny styl, dużo elementów do kolorowania.`;
  logger.info('OpenAI: improve prompt call', { original });

  const client = getClient();
  const chatModel = config.textModel || 'gpt-4o-mini';
  let improved: string | undefined;

  try {
    const cc = await client.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    } as any);
    improved = (cc as any)?.choices?.[0]?.message?.content?.trim?.();
  } catch (e: any) {
      const msg = String(e?.message || e);
      logger.error('Error while generating improved prompt', { msg });
  }
  logger.info('Improved prompt', { improved });

  if (!improved) throw new Error('Brak treści ulepszonego promptu');
  return improved;
};

export const generateImageWithReferences = async (
  prompt: string,
  fileIds: string[],
  opts?: { qualityOverride?: string }
): Promise<Buffer> => {
  if (!config.openaiApiKey) throw new Error('Brak konfiguracji OPENAI_API_KEY');
  if (!fileIds.length) throw new Error('Brak fileIds do generowania');

  const client = getClient();
  const model = config.textModel;
  const quality = (opts?.qualityOverride || config.openaiImageQuality || '').trim();
  const p = `Narysuj czarno-białą ilustrację do kolorowania (line art, wyraźne kontury, bez tła, brak szarości, brak cieniowania), temat: '${prompt}'. Styl przyjazny dla dzieci. Nie dodawaj żadnego tekstu na obrazku, chyba ze jest to wprost wymagane przez prompt.`;
  
  const content: any[] = [
    { type: 'input_text', text: p },
    ...fileIds.map((id) => ({ type: 'input_image', file_id: id })),
  ];
  
  logger.info('OpenAI: responses image generation (with references)', { prompt, referencesCount: fileIds.length, model, quality: quality || 'default' });
  
  const resp = await client.responses.create({
    model,
    input: [{ role: 'user', content }],
    tools: [{ 
      type: 'image_generation',
      size: '1536x1024',
      ...(quality ? { quality } : {}),
    }],
  } as any);

  const imageGenCalls = (resp?.output || []).filter((o: any) => o.type === 'image_generation_call');
  if (!imageGenCalls.length) {
    logger.error('OpenAI: responses image missing image_generation_call in output');
    throw new Error('Brak danych obrazu z API responses');
  }
  
  const imgB64 = (imageGenCalls[0] as any)?.result;
  if (!imgB64) {
    logger.error('OpenAI: responses image missing result data');
    throw new Error('Brak danych obrazu (responses)');
  }
  
  return Buffer.from(imgB64, 'base64');
};

export const uploadReferenceFiles = async (fileNames: string[]): Promise<{ fileIds: string[] }> => {
  if (!config.openaiApiKey) throw new Error('Brak konfiguracji OPENAI_API_KEY');
  const client = getClientForFileUpload();
  const referenceDir = config.referenceDir;
  const ids: string[] = [];
  
  for (const name of fileNames) {
    const filePath = `${referenceDir}/${name}`;
    try {
      const stream = fsSync.createReadStream(filePath);
      const created = await client.files.create({
        file: stream as any,
        purpose: 'vision' as any,
      });
      ids.push((created as any).id);
      logger.info('References: file uploaded', { name, fileId: (created as any).id });
    } catch (e: any) {
      logger.warn('References: upload failed for file, skipping', { name, error: String(e?.message || e) });
    }
  }
  
  return { fileIds: ids };
};
