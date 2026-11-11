// Turns API errors ("{"error":"..."}" bodies, Error objects, strings) into a readable message
export const extractErrorMessage = (error: unknown, fallback = 'Nieznany błąd'): string => {
  const fromPayload = (payload: any): string | undefined => {
    if (!payload) return undefined;
    if (typeof payload === 'string') return payload;
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.message === 'string') return payload.message;
    return undefined;
  };
  const tryParseJsonMessage = (value: string): string | undefined => {
    try {
      return fromPayload(JSON.parse(value));
    } catch {
      return undefined;
    }
  };
  if (typeof error === 'string') return tryParseJsonMessage(error) || error;
  if (error && typeof error === 'object') {
    const message = (error as any).message;
    if (typeof message === 'string') return tryParseJsonMessage(message) || message;
  }
  return fallback;
};
