import dns from 'node:dns/promises';
import https from 'node:https';
import OpenAI from 'openai';

// Deliberately use no real credentials and make no paid generation requests.
const timeoutMs = 10000;
const details = (error, depth = 0) => {
  if (!error || depth >= 5) return undefined;
  const result = {};
  for (const key of ['name', 'code', 'errno', 'syscall', 'hostname', 'status']) {
    if (typeof error[key] === 'string' || typeof error[key] === 'number') result[key] = error[key];
  }
  if (error.cause) result.cause = details(error.cause, depth + 1);
  if (Array.isArray(error.errors)) result.errors = error.errors.map((entry) => details(entry, depth + 1));
  return result;
};

const probe = (url, family) => new Promise((resolve) => {
  const start = Date.now();
  const request = https.get(url, { family }, (response) => {
    response.resume();
    clearTimeout(timer);
    resolve({ reachable: true, httpStatus: response.statusCode, durationMs: Date.now() - start });
  });
  const timer = setTimeout(() => {
    request.destroy(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' }));
  }, timeoutMs);
  request.on('error', (error) => {
    clearTimeout(timer);
    resolve({ reachable: false, error: details(error), durationMs: Date.now() - start });
  });
});

const sdkProbe = async (forceIpv4) => {
  const agent = forceIpv4 ? new https.Agent({ keepAlive: true, family: 4 }) : undefined;
  const client = new OpenAI({
    apiKey: 'diagnostic-invalid-key',
    baseURL: 'https://api.openai.com/v1',
    timeout: timeoutMs,
    maxRetries: 0,
    ...(agent ? { httpAgent: agent } : {}),
  });
  try {
    await client.models.list();
    return { reachable: true };
  } catch (error) {
    // An HTTP response (normally 401) proves DNS, TCP and verified TLS worked.
    return { reachable: Boolean(error.status), error: details(error) };
  } finally {
    agent?.destroy();
  }
};

const checks = {
  openaiDefault: () => probe('https://api.openai.com/v1/models'),
  openaiIpv4: () => probe('https://api.openai.com/v1/models', 4),
  openaiIpv6: () => probe('https://api.openai.com/v1/models', 6),
  openaiSdkDefault: () => sdkProbe(false),
  openaiSdkIpv4: () => sdkProbe(true),
  geminiDefault: () => probe('https://generativelanguage.googleapis.com/'),
};

console.log(JSON.stringify({ node: process.version, utc: new Date().toISOString(), dnsServers: dns.getServers() }));
const results = Object.fromEntries(await Promise.all(Object.entries(checks).map(async ([name, check]) => {
  const result = await check();
  console.log(JSON.stringify({ check: name, ...result }));
  return [name, result];
})));

if (!results.openaiSdkDefault.reachable && results.openaiSdkIpv4.reachable) {
  console.log('Transport SDK przez IPv4 działa, a domyślny nie: sprawdź konfigurację IPv6 sieci kontenera.');
}
console.log('HTTP 401 dla OpenAI jest oczekiwane: test używa celowo nieprawidłowego klucza. Błąd samego IPv6 nie oznacza awarii, jeśli połączenie domyślne działa.');
if (!results.openaiSdkDefault.reachable || !results.geminiDefault.reachable) process.exitCode = 1;
