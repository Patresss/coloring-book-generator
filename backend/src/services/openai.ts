import fs from 'fs/promises';
import fsSync from 'fs';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { apiErrorDetails, openAIErrorMessage } from '../utils/apierror.js';

export const createOpenAIClient = () => new OpenAI({
  apiKey: config.openaiApiKey,
  timeout: config.openaiTimeoutMs,
});

function getClient() {
  return createOpenAIClient();
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

export const improvePrompt = async (original: string): Promise<string> => {
  if (!config.openaiApiKey) {
    // Fallback for local dev: return original prompt
    return original;
  }
  const userPrompt = config.promptImprove + " '" + original + "'";
  logger.info('OpenAI: improve prompt call', { original });

  const client = getClient();
  const chatModel = config.textModel || 'gpt-4o-mini';
  let improved: string | undefined;

  try {
    const cc = await client.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    } as any);
    improved = (cc as any)?.choices?.[0]?.message?.content?.trim?.();
  } catch (e: unknown) {
    logger.error('OpenAI: prompt improvement failed', apiErrorDetails(e));
    throw new Error(openAIErrorMessage(e, 'Nie udało się ulepszyć promptu'));
  }
  logger.info('Improved prompt', { improved });

  if (!improved) throw new Error('Brak treści ulepszonego promptu');
  return improved;
};
