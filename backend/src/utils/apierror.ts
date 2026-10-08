import OpenAI from 'openai';

// Log transport details only; SDK errors can also contain headers and credentials.
export const apiErrorDetails = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') return { name: 'UnknownError' };
  const source = error as Record<string, unknown>;
  const details: Record<string, unknown> = {};
  for (const key of ['name', 'code', 'errno', 'syscall', 'hostname', 'status', 'request_id']) {
    if (typeof source[key] === 'string' || typeof source[key] === 'number') {
      details[key] = source[key];
    }
  }
  if (source.cause && source.cause !== error) {
    details.cause = transportCauses(source.cause);
  }
  return details;
};

const transportCauses = (error: unknown, depth = 0): unknown => {
  if (!error || typeof error !== 'object' || depth >= 5) return undefined;
  const source = error as Record<string, unknown>;
  const details: Record<string, unknown> = {};
  for (const key of ['name', 'code', 'errno', 'syscall', 'hostname']) {
    if (typeof source[key] === 'string' || typeof source[key] === 'number') details[key] = source[key];
  }
  if (source.cause) details.cause = transportCauses(source.cause, depth + 1);
  if (Array.isArray(source.errors)) {
    details.errors = source.errors.map((entry) => transportCauses(entry, depth + 1));
  }
  return details;
};

export const openAIErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return 'Przekroczono czas oczekiwania na OpenAI. Spróbuj ponownie.';
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return 'Nie można połączyć się z OpenAI. Sprawdź DNS, dostęp do internetu i certyfikaty HTTPS w kontenerze backendu.';
  }
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return 'OpenAI odrzuciło klucz API. Sprawdź OPENAI_API_KEY w konfiguracji backendu.';
    if (error.status === 429) return 'OpenAI zgłosiło przekroczenie limitu lub brak środków. Sprawdź limity konta API.';
    return `${fallback} (OpenAI HTTP ${error.status}).`;
  }
  return fallback;
};
