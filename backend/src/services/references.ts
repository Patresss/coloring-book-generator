import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const getClient = () => new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs });

export type ReferenceDetectionResult = {
  references: string[]; // file names chosen by AI
  available: string[];  // all available file names in referenceDir
};

export const listReferenceFiles = async (): Promise<string[]> => {
  try {
    const entries = await fs.readdir(config.referenceDir, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(name => IMAGE_EXTS.has(path.extname(name).toLowerCase()));
    return files;
  } catch (e) {
    logger.warn('References: failed to read referenceDir, treating as empty', { dir: config.referenceDir, error: String((e as any)?.message || e) });
    return [];
  }
};

export const detectReferences = async (userPrompt: string): Promise<ReferenceDetectionResult> => {
  const available = await listReferenceFiles();
  if (!config.openaiApiKey) {
    return { references: [], available };
  }
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

