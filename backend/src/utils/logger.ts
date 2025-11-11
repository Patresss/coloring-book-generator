const ts = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(`[${ts()}] [INFO]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${ts()}] [WARN]`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] [ERROR]`, ...args),
};
