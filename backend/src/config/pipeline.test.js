import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function configFor(environment, configuredMode) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import * as pipeline from './pipeline.js';
    console.log(JSON.stringify({
      modes: pipeline.SESSION_PIPELINE_MODES,
      defaultMode: pipeline.DEFAULT_PIPELINE_MODE,
      requestedFree: pipeline.getSessionPipelineMode('free'),
      existingFreeUsesOpenAI: pipeline.usesOpenAITextPipeline('free'),
    }));
  `], { cwd: new URL('.', import.meta.url), env: { ...process.env, NODE_ENV: environment, PIPELINE_MODE: configuredMode }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('production disables Free even when configured or saved on an existing session', () => {
  assert.deepEqual(configFor('production', 'free'), {
    modes: ['openai-fast-scripted'], defaultMode: 'openai-fast-scripted',
    requestedFree: 'openai-fast-scripted', existingFreeUsesOpenAI: true,
  });
});

test('development keeps the Free pipeline available', () => {
  assert.deepEqual(configFor('development', 'free'), {
    modes: ['free', 'openai-fast-scripted'], defaultMode: 'free',
    requestedFree: 'free', existingFreeUsesOpenAI: false,
  });
});
