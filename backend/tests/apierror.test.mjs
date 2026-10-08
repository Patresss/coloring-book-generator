import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { apiErrorDetails, openAIErrorMessage } from '../dist/utils/apierror.js';
import { improvePrompt } from '../dist/services/openai.js';
import { detectReferences } from '../dist/services/references.js';
import { config } from '../dist/config.js';

test('transport diagnostics retain nested DNS / TLS causes without request credentials', () => {
  const error = new OpenAI.APIConnectionError({ cause: Object.assign(new Error('private detail'), {
    code: 'EAI_AGAIN', hostname: 'api.openai.com',
    headers: { authorization: 'secret' },
    cause: Object.assign(new Error('private detail'), { code: 'CERT_HAS_EXPIRED' }),
    errors: [Object.assign(new Error('private detail'), { code: 'ENETUNREACH' })],
  }) });
  const result = apiErrorDetails(error);
  assert.equal(result.cause.code, 'EAI_AGAIN');
  assert.equal(result.cause.cause.code, 'CERT_HAS_EXPIRED');
  assert.equal(result.cause.errors[0].code, 'ENETUNREACH');
  assert.doesNotMatch(JSON.stringify(result), /secret|private detail|authorization/);
  assert.match(openAIErrorMessage(error, 'fallback'), /DNS/);
});

test('timeout and authentication errors have distinct safe user messages', () => {
  assert.match(openAIErrorMessage(new OpenAI.APIConnectionTimeoutError(), 'fallback'), /czas oczekiwania/);
  const error = new OpenAI.AuthenticationError(401, {}, 'Invalid key: secret', {});
  assert.match(openAIErrorMessage(error, 'fallback'), /OPENAI_API_KEY/);
  assert.doesNotMatch(openAIErrorMessage(error, 'fallback'), /secret/);
});

test('both AI operations report connection failures rather than empty AI responses', async () => {
  const originalKey = config.openaiApiKey;
  const originalCreate = OpenAI.Chat.Completions.prototype.create;
  const originalParse = OpenAI.Responses.prototype.parse;
  const originalReferenceDir = config.referenceDir;
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const referenceDir = await mkdtemp(join(tmpdir(), 'coloring-references-'));
  try {
    config.openaiApiKey = 'test-key';
    config.referenceDir = referenceDir;
    await writeFile(join(referenceDir, 'dino.png'), 'test');
    const fail = async () => { throw new OpenAI.APIConnectionError({ cause: Object.assign(new Error(), { code: 'ENOTFOUND' }) }); };
    OpenAI.Chat.Completions.prototype.create = fail;
    OpenAI.Responses.prototype.parse = fail;
    await assert.rejects(improvePrompt('dino'), /Nie można połączyć się z OpenAI/);
    await assert.rejects(detectReferences('dino'), /Nie można połączyć się z OpenAI/);
    OpenAI.Chat.Completions.prototype.create = async () => ({ choices: [{ message: { content: ' Dino w parku ' } }] });
    assert.equal(await improvePrompt('dino'), 'Dino w parku');
    OpenAI.Chat.Completions.prototype.create = async () => ({ choices: [] });
    await assert.rejects(improvePrompt('dino'), /Brak treści/);
    OpenAI.Responses.prototype.parse = async () => ({ status: 'completed', output_parsed: { references: ['dino.png', 'missing.png'] } });
    assert.deepEqual((await detectReferences('dino')).references, ['dino.png']);
  } finally {
    config.openaiApiKey = originalKey;
    config.referenceDir = originalReferenceDir;
    OpenAI.Chat.Completions.prototype.create = originalCreate;
    OpenAI.Responses.prototype.parse = originalParse;
    await rm(referenceDir, { recursive: true, force: true });
  }
});
