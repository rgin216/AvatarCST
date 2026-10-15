import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function configFor(environment, configuredMode) {
  const env = { ...process.env, PIPELINE_MODE: configuredMode };
  if (environment === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = environment;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import * as pipeline from './pipeline.js';
    console.log(JSON.stringify({
      modes: pipeline.SESSION_PIPELINE_MODES,
      defaultMode: pipeline.DEFAULT_PIPELINE_MODE,
      requestedFree: pipeline.getSessionPipelineMode('free'),
      existingFreeUsesOpenAI: pipeline.usesOpenAITextPipeline('free'),
    }));
  `], { cwd: new URL('.', import.meta.url), env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

for (const environment of ['production', 'staging', 'test', '', undefined]) {
  test(`${environment === undefined ? 'unset NODE_ENV' : JSON.stringify(environment)} disables Free even when configured or saved`, () => {
    assert.deepEqual(configFor(environment, 'free'), {
      modes: ['openai-fast-scripted'], defaultMode: 'openai-fast-scripted',
      requestedFree: 'openai-fast-scripted', existingFreeUsesOpenAI: true,
    });
  });
}

function transcriptionFor(environment, sttProvider) {
  const env = { ...process.env, NODE_ENV: environment };
  if (sttProvider === undefined) delete env.STT_PROVIDER;
  else env.STT_PROVIDER = sttProvider;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { getTranscriptionProviders } from './pipeline.js';
    console.log(JSON.stringify({
      free: getTranscriptionProviders('free'),
      openai: getTranscriptionProviders('openai-fast-scripted'),
    }));
  `], { cwd: new URL('.', import.meta.url), env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('transcription follows the pipeline when STT_PROVIDER is unset or invalid', () => {
  for (const value of [undefined, '', 'whisper']) {
    assert.deepEqual(transcriptionFor('development', value), {
      free: { provider: 'groq', fallbackProvider: null },
      openai: { provider: 'openai', fallbackProvider: null },
    });
  }
});

test('STT_PROVIDER overrides transcription only, falling back to the pipeline provider', () => {
  assert.deepEqual(transcriptionFor('production', ' Groq '), {
    free: { provider: 'groq', fallbackProvider: 'openai' },
    openai: { provider: 'groq', fallbackProvider: 'openai' },
  });
  assert.deepEqual(transcriptionFor('development', 'openai'), {
    free: { provider: 'openai', fallbackProvider: 'groq' },
    openai: { provider: 'openai', fallbackProvider: null },
  });
});

test('development keeps the Free pipeline available', () => {
  assert.deepEqual(configFor('development', 'free'), {
    modes: ['free', 'openai-fast-scripted'], defaultMode: 'free',
    requestedFree: 'free', existingFreeUsesOpenAI: false,
  });
});
