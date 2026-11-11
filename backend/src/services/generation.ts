import { config } from '../config.js';
import { PROMPT_SUBJECT_PLACEHOLDER } from '../constants.js';
import { logger } from '../utils/logger.js';
import { readSettingsSection, writeSettingsSection } from './settings.js';

export type GenerationMode = 'coloring' | 'image';

export const GENERATION_MODES: GenerationMode[] = ['coloring', 'image'];

export type GenerationSettings = {
  mode: GenerationMode;
  // Custom prompts set in the UI; undefined = use the default
  prompts: Partial<Record<GenerationMode, string>>;
};

export const defaultPrompt = (mode: GenerationMode): string =>
  mode === 'image' ? config.promptImage : config.promptColoringBook;

export const defaultImprovePrompt = (mode: GenerationMode): string =>
  mode === 'image' ? config.promptImproveImage : config.promptImprove;

export const readGenerationSettings = async (): Promise<GenerationSettings> => {
  const raw = await readSettingsSection('generation');
  const prompts: GenerationSettings['prompts'] = {};
  for (const mode of GENERATION_MODES) {
    const value = raw.prompts?.[mode];
    if (typeof value === 'string' && value.trim()) prompts[mode] = value;
  }
  return { mode: raw.mode === 'image' ? 'image' : 'coloring', prompts };
};

export type GenerationSettingsUpdate = {
  mode?: GenerationMode;
  // null or empty string = back to the default prompt
  prompts?: Partial<Record<GenerationMode, string | null>>;
};

export const saveGenerationSettings = async (update: GenerationSettingsUpdate): Promise<GenerationSettings> => {
  const current = await readGenerationSettings();
  const next: GenerationSettings = { mode: update.mode ?? current.mode, prompts: { ...current.prompts } };
  for (const mode of GENERATION_MODES) {
    if (!update.prompts || !(mode in update.prompts)) continue;
    const value = update.prompts[mode];
    if (value && value.trim() && value.trim() !== defaultPrompt(mode).trim()) next.prompts[mode] = value;
    else delete next.prompts[mode];
  }
  await writeSettingsSection('generation', next);
  logger.info('Generation settings saved', { mode: next.mode, customPrompts: Object.keys(next.prompts) });
  return next;
};

export const promptTemplate = (settings: GenerationSettings, mode: GenerationMode = settings.mode): string =>
  settings.prompts[mode] ?? defaultPrompt(mode);

// Inserts the subject at {temat}; without the placeholder the subject is appended at the end.
export const buildImagePrompt = (template: string, subject: string): string => {
  const quoted = `'${subject}'`;
  return template.includes(PROMPT_SUBJECT_PLACEHOLDER)
    ? template.split(PROMPT_SUBJECT_PLACEHOLDER).join(quoted)
    : `${template.trimEnd()} ${quoted}`;
};
