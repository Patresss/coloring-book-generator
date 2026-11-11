import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

// App settings changed from the UI, persisted in DATA_DIR/settings.json.
// Each feature owns one top-level section (e.g. "models", "generation").
type SettingsFile = Record<string, unknown>;

const settingsPath = () => path.join(config.dataDir, 'settings.json');

let cache: SettingsFile | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

const load = async (): Promise<SettingsFile> => {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath(), 'utf-8'));
    cache = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    cache = {};
  }
  return cache!;
};

export const readSettingsSection = async (section: string): Promise<Record<string, any>> => {
  const value = (await load())[section];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
};

// Serialized so concurrent saves of different sections cannot overwrite each other.
export const writeSettingsSection = (section: string, value: Record<string, any>): Promise<void> => {
  const run = writeQueue.then(async () => {
    const next = { ...(await load()), [section]: value };
    await fs.mkdir(config.dataDir, { recursive: true });
    const tmp = `${settingsPath()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, settingsPath());
    cache = next;
  });
  writeQueue = run.catch(() => {});
  return run;
};
