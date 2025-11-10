import fs from 'fs/promises';
import fsSync from 'fs';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getClient() {
  return new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs });
}

function extractResponsesText(resp: any): string | undefined {
  const t = resp?.output_text;
  if (typeof t === 'string' && t.trim()) return t.trim();
  const outputs = resp?.output;
  if (Array.isArray(outputs)) {
    const parts: string[] = [];
    for (const o of outputs) {
      const cont = o?.content;
      if (Array.isArray(cont)) {
        for (const c of cont) {
          if (c?.type === 'output_text' && typeof c?.text === 'string') parts.push(c.text);
        }
      }
    }
    const joined = parts.join(' ').trim();
    if (joined) return joined;
  }
  return undefined;
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

export const generateImage = async (prompt: string): Promise<Buffer> => {
  if (!config.openaiApiKey) {
    throw new Error('Brak konfiguracji OPENAI_API_KEY');
  }
  const p = `Narysuj czarno-białą ilustrację do kolorowania (line art, wyraźne kontury, bez tła, brak szarości, brak cieniowania), temat: '${prompt}'. Styl przyjazny dla dzieci.`;
  const model = config.imageModel || 'gpt-image-1';
  // Map model -> preferred size. If not present, omit size to use API default.
  const MODEL_SIZE_MAP: Record<string, string> = {
    'gpt-image-1': '1536x1024',
    'dall-e-3': '1792x1024',
  };
  const size = MODEL_SIZE_MAP[model as keyof typeof MODEL_SIZE_MAP];
  logger.info('OpenAI: image generation prompt', { original: prompt, composed: p, model, size: size ?? 'default' });

  const client = getClient();
  // simple retry for transient errors (2 retries). Do NOT retry user errors (e.g., moderation).
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const isDalle3 = model === 'dall-e-3';
      const result = await client.images.generate({
        model,
        prompt: p,
        ...(size ? { size } : {}),
        ...(isDalle3 ? { response_format: 'b64_json' } : {}),
      } as any);
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
      if (attempt < 2) await delay(500 * Math.pow(2, attempt));
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
  const isModern = /^(gpt-4o|gpt-4\.1|gpt-5|o)/.test(chatModel);
  let improved: string | undefined;
  if (isModern) {
    const resp = await (client as any).responses.create({
      model: chatModel,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ],
      max_output_tokens: 200,
    });
    improved = extractResponsesText(resp);
    // Fallback: try chat.completions without unsupported params
    if (!improved) {
      try {
        const cc = await client.chat.completions.create({
          model: chatModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        } as any);
        improved = (cc as any)?.choices?.[0]?.message?.content?.trim?.();
      } catch {}
    }
  } else {
    const resp = await client.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    improved = (resp as any)?.choices?.[0]?.message?.content?.trim();
  }
  if (!improved) throw new Error('Brak treści ulepszonego promptu');
  return improved;
};
