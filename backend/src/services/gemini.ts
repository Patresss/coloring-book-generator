import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ensureClient = () => {
  if (!config.geminiApiKey) {
    throw new Error('Brak konfiguracji GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey: config.geminiApiKey,
    httpOptions: { apiVersion: config.geminiApiVersion },
  });
};

const buildPrompt = (subject: string) => `${config.promptColoringBook} '${subject}'`;

interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

interface TextPart {
  text: string;
}

type ContentPart = TextPart | InlineDataPart;

const loadReferenceParts = async (fileNames: string[]): Promise<InlineDataPart[]> => {
  const parts: InlineDataPart[] = [];
  for (const name of fileNames) {
    const absPath = path.join(config.referenceDir, name);
    try {
      const data = await fs.readFile(absPath);
      const resolvedMime = mime.lookup(name);
      const mimeType = typeof resolvedMime === 'string' ? resolvedMime : 'image/jpeg';
      parts.push({
        inlineData: {
          data: data.toString('base64'),
          mimeType,
        },
      });
      logger.info('Gemini: reference prepared', { fileName: name, bytes: data.byteLength });
    } catch (error: any) {
      logger.warn('Gemini: failed to read reference image', { fileName: name, absPath, error: String(error?.message || error) });
    }
  }
  return parts;
};

const extractInlineImage = (response: any): string | undefined => {
  const candidates = response?.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) return inline.data;
    }
  }
  return undefined;
};

const summarizeParts = (parts: ContentPart[] = []) => parts.map((part) => {
  if ('inlineData' in part) {
    return `inline(${part.inlineData?.mimeType || 'unknown'} len=${part.inlineData?.data?.length || 0})`;
  }
  if ('text' in part) {
    const txt = String(part.text);
    return `text(${txt.slice(0, 60)}${txt.length > 60 ? '…' : ''})`;
  }
  return 'unknown';
});

type GeminiOptions = { aspectRatio?: string; model?: string };

// Timeout wrapper for Gemini API calls
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout po ${timeoutMs}ms podczas operacji: ${operation}. Gemini 3 Pro może wymagać więcej czasu na generowanie - zwiększ GEMINI_TIMEOUT_MS w .env`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
};

const generateWithGemini = async (subject: string, references: string[] | undefined, opts?: GeminiOptions) => {
  const client = ensureClient();
  const prompt = buildPrompt(subject);
  const referenceParts = references?.length ? await loadReferenceParts(references) : [];

  if (referenceParts.length === 0 && references?.length) {
    throw new Error('Brak dostępnych referencji do przesłania do Gemini');
  }

  const effectiveAspect = opts?.aspectRatio || config.geminiAspectRatio;
  const effectiveModel = opts?.model || config.geminiImageModel;

  // imageSize is not supported by Gemini 2.x image models
  const isGemini3 = !/gemini-(1|2)\./.test(effectiveModel);

  logger.info('Gemini: generate call', {
    subject,
    prompt,
    referencesRequested: references?.length || 0,
    referencesAttached: referenceParts.length,
    model: effectiveModel,
    aspectRatio: effectiveAspect || 'default',
    imageSize: isGemini3 ? config.geminiImageSize : 'N/A',
    timeoutMs: config.geminiTimeoutMs,
  });

  // Build contents array: [text, ...references]
  const contents: ContentPart[] = [
    { text: prompt },
    ...referenceParts,
  ];

  // Build generation config
  const generationConfig: any = {
    responseModalities: ['TEXT', 'IMAGE'],
  };

  const imageConfig: Record<string, any> = {};
  if (effectiveAspect) {
    imageConfig.aspectRatio = effectiveAspect;
  }
  if (config.geminiImageSize && isGemini3) {
    imageConfig.imageSize = config.geminiImageSize;
  }
  if (Object.keys(imageConfig).length > 0) {
    generationConfig.imageConfig = imageConfig;
  }

  const maxAttempts = references?.length ? 2 : 1;
  let lastResult: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const start = Date.now();
    const response = await withTimeout(
      client.models.generateContent({
        model: effectiveModel,
        contents: contents,
        config: generationConfig,
      }),
      config.geminiTimeoutMs,
      `Gemini ${effectiveModel} generateContent (próba ${attempt + 1}/${maxAttempts})`
    );

    lastResult = response;
    const blocked = response?.promptFeedback?.blockReason;
    if (blocked && blocked !== 'BLOCKED_REASON_UNSPECIFIED') {
      logger.warn('Gemini: request blocked', { subject, reason: blocked });
      throw new Error('Żądanie zostało zablokowane przez system bezpieczeństwa Gemini. Zmień prompt i spróbuj ponownie.');
    }

    const data = extractInlineImage(response);
    logger.info('Gemini: generate finished', { durationMs: Date.now() - start, attempt });

    if (data) {
      return Buffer.from(data, 'base64');
    }

    const candidatesSummary = (response?.candidates ?? []).map((candidate: any, idx: number) => ({
      index: idx,
      finishReason: candidate.finishReason,
      partKinds: summarizeParts(candidate.content?.parts ?? []),
    }));

    const finishReasons = candidatesSummary.map((c) => c.finishReason || 'unknown');
    const firstText = (response?.candidates ?? [])
      .flatMap((c: any) => (c.content?.parts ?? []))
      .map((part: any) => part?.text)
      .find((txt) => typeof txt === 'string' && txt.trim().length > 0);

    const shouldRetry = attempt + 1 < maxAttempts && finishReasons.every((fr) => fr !== 'IMAGE_BLOCKED' && fr !== 'IMAGE_OTHER');
    if (shouldRetry) {
      logger.warn('Gemini: missing inline data, retrying', {
        attempt,
        finishReasons,
        hasHint: Boolean(firstText),
        result: response
      });
      continue;
    }

    if (finishReasons.includes('IMAGE_OTHER')) {
      logger.error('Gemini: missing inline image data due to inconsistent prompt', {
        subject,
        finishReasons,
      });
      throw new Error(`Nie udało się wygenerować obrazu, błąd: ${finishReasons} Spróbuj uprościć lub przeformułować swój pomysł.`);
    }

    logger.error('Gemini: missing inline image data', {
      subject,
      promptFeedback: response?.promptFeedback,
      candidatesSummary,
      finishReasons,
      hint: firstText?.slice(0, 200),
    });
    const hintText = firstText ? ` Wskazówka od modelu: ${firstText.slice(0, 200)}` : '';
    const reasonText = finishReasons.length ? ` (powód: ${finishReasons.join(', ')})` : '';
    throw new Error('Brak danych obrazu z Gemini' + reasonText + '.' + hintText);
  }
  throw new Error('Brak danych obrazu z Gemini');
};

export const generateImage = async (subject: string, opts?: GeminiOptions): Promise<{ buffer: Buffer; generationTimeMs: number }> => {
  const startTime = Date.now();
  const buffer = await generateWithGemini(subject, undefined, opts);
  const generationTimeMs = Date.now() - startTime;
  return { buffer, generationTimeMs };
};

export const generateImageWithReferences = async (subject: string, fileNames: string[], opts?: GeminiOptions): Promise<{ buffer: Buffer; generationTimeMs: number }> => {
  if (!fileNames.length) throw new Error('Brak referencji do Gemini');
  const startTime = Date.now();
  const buffer = await generateWithGemini(subject, fileNames, opts);
  const generationTimeMs = Date.now() - startTime;
  return { buffer, generationTimeMs };
};
