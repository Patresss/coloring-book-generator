import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const getClient = () => new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs });

// For file uploads, use longer timeout (5 minutes) to avoid connection issues
const getClientForFileUpload = () => new OpenAI({ apiKey: config.openaiApiKey, timeout: 5 * 60 * 1000 });

export type ReferenceDetectionResult = {
  references: string[]; // file names chosen by AI
  available: string[];  // all available file names in referenceDir
};

export const listReferenceFiles = async (): Promise<string[]> => {
  try {
    const dir = config.referenceDir;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(name => IMAGE_EXTS.has(path.extname(name).toLowerCase()));
    return files;
  } catch (e) {
    // If directory does not exist, treat as empty
    logger.warn('References: failed to read referenceDir, treating as empty', { dir: config.referenceDir, error: String((e as any)?.message || e) });
    return [];
  }
};

export const detectReferences = async (userPrompt: string): Promise<ReferenceDetectionResult> => {
  const available = await listReferenceFiles();
  if (!config.openaiApiKey) {
    // Without API key, just return empty (no references)
    return { references: [], available };
  }
  // If nothing available, skip AI call
  if (available.length === 0) return { references: [], available };

  const system = 'Jesteś pomocnikiem. Na podstawie listy plików referencyjnych wybierz które pasują do opisu. Zwróć WYŁĄCZNIE poprawny JSON.';
  const instruction = `Dostępne pliki referencyjne (nazwa pliku):\n${available.join('\n')}\n\nOpis użytkownika:\n${userPrompt}\n\nZwróć JSON postaci: { "references": ["plik1.jpg", "plik2.png"] } — tylko istniejące nazwy. Możesz zwrócić pustą listę.`;

  const client = getClient();
  logger.info('References: detect start', { count: available.length });
  let content: string | undefined;
  try {
    const resp = await client.chat.completions.create({
      model: config.textModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: instruction },
      ],
      temperature: 0,
    } as any);
    content = (resp as any)?.choices?.[0]?.message?.content?.trim?.();
  } catch (e: any) {
    const msg = String(e?.message || e);
    logger.error('References: detection API error', { error: msg });
    throw new Error('Błąd wyszukiwania referencji');
  }
  if (!content) throw new Error('Brak odpowiedzi z AI dla wyszukiwania referencji');
  try {
    const parsed = JSON.parse(content);
    let refs: string[] = Array.isArray(parsed?.references) ? parsed.references : [];
    refs = refs.filter((n: string) => typeof n === 'string' && available.includes(n));
    logger.info('References: detect result', { references: refs });
    return { references: refs, available };
  } catch (e) {
    logger.error('References: invalid JSON from AI', { content });
    throw new Error('Błąd parsowania odpowiedzi AI (referencje)');
  }
};

export const uploadReferenceFiles = async (fileNames: string[]): Promise<{ fileIds: string[]; paths: string[] }> => {
  if (!config.openaiApiKey) throw new Error('Brak konfiguracji OPENAI_API_KEY');
  const client = getClientForFileUpload();
  const dir = config.referenceDir;
  const ids: string[] = [];
  const usedPaths: string[] = [];
  for (const name of fileNames) {
    const p = path.join(dir, name);
    if (!fsSync.existsSync(p)) continue;
    try {
      // Use createReadStream - OpenAI SDK expects stream, not buffer
      const stream = fsSync.createReadStream(p);
      const created = await client.files.create({
        file: stream as any,
        purpose: 'vision' as any,
      });
      ids.push((created as any).id);
      usedPaths.push(p);
      logger.info('References: file uploaded', { name, fileId: (created as any).id });
    } catch (e: any) {
      logger.warn('References: upload failed for file, skipping', { name, error: String(e?.message || e) });
    }
  }
  return { fileIds: ids, paths: usedPaths };
};

export const generateImageWithReferences = async (prompt: string, fileIds: string[], opts?: { qualityOverride?: string }): Promise<Buffer> => {
  if (!config.openaiApiKey) throw new Error('Brak konfiguracji OPENAI_API_KEY');
  
  const client = getClient();
  const model = config.textModel;
  const quality = (opts?.qualityOverride || config.openaiImageQuality || '').trim();
  const instruction = `Narysuj czarno-białą ilustrację do kolorowania (line art, wyraźne kontury, bez tła, brak szarości, brak cieniowania). Temat: "${prompt}". Styl przyjazny dla dzieci.`;
  const content: any[] = [
    { type: 'input_text', text: instruction },
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

  const out: any = resp;
  // Extract image bytes from response output
  // The response contains output array with image_generation_call objects
  const imageGenCalls = (out?.output || []).filter((o: any) => o.type === 'image_generation_call');
  if (!imageGenCalls.length) {
    logger.error('OpenAI: responses image missing image_generation_call in output');
    throw new Error('Brak danych obrazu (responses)');
  }
  
  const imgB64 = imageGenCalls[0]?.result;
  if (!imgB64) {
    logger.error('OpenAI: responses image missing result data');
    throw new Error('Brak danych obrazu (responses)');
  }
  
  return Buffer.from(imgB64, 'base64');
};

