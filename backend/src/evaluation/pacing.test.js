import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacedGenerator } from './pacing.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Anthropic HTTP 429 uses the bounded quota retry path', async () => {
  let calls = 0;
  const waits = [];
  const generate = createPacedGenerator(async () => {
    if (++calls === 1) throw new Error('Anthropic HTTP 429');
    return 'ok';
  }, { sleep: async ms => waits.push(ms) });
  assert.equal(await generate([], { provider: 'anthropic', model: 'test' }), 'ok');
  assert.deepEqual(waits, [61000]);
  assert.equal(generate.events.length, 1);
});

test('CLI rejects blank pacing operands but accepts scientific notation and zero', () => {
  const script = fileURLToPath(new URL('../../scripts/evaluate-llms.js', import.meta.url));
  for (const option of ['delay-ms', 'quota-retries']) {
    for (const value of ['', '   ']) {
      const result = spawnSync(process.execPath, [script, `--${option}=${value}`], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`${option} must not be blank`));
    }
  }
  const result = spawnSync(process.execPath, [script, '--delay-ms=1e3', '--quota-retries=0', '--limit=1'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).requestPolicy, { intervalMs: 1000, maxRetries: 0 });
});

test('paces each model independently before the measured request', async () => {
  let clock = 0;
  const waits = [];
  const generate = createPacedGenerator(async () => 'ok', { now: () => clock, sleep: async ms => { waits.push(ms); clock += ms; } });
  const a = { provider: 'groq', model: 'a' }, b = { provider: 'groq', model: 'b' };
  await generate.beforeCall(a); await generate([], a);
  await generate.beforeCall(b); await generate([], b);
  assert.deepEqual(waits, []);
  await generate.beforeCall(a); await generate([], a);
  assert.deepEqual(waits, [61000]);
});

test('bounded quota retries respect provider timing and retain failures', async () => {
  let calls = 0;
  const waits = [];
  const generate = createPacedGenerator(async () => { calls++; throw new Error('Groq error 429: Please try again in 90.5s.'); }, { sleep: async ms => waits.push(ms) });
  await assert.rejects(generate([], { provider: 'groq', model: 'a' }), /429/);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [91500, 91500]);
  assert.equal(generate.events.length, 3);
  assert.equal(generate.events[2].retry, false);
});

test('does not retry malformed outputs or non-quota provider errors', async () => {
  let calls = 0;
  const generate = createPacedGenerator(async () => { calls++; throw new Error('Groq error 401'); });
  await assert.rejects(generate([], { model: 'a' }), /401/);
  assert.equal(calls, 1);
  assert.throws(() => createPacedGenerator(() => {}, { intervalMs: -1 }), /delay-ms/);
  assert.throws(() => createPacedGenerator(() => {}, { maxRetries: 6 }), /quota-retries/);
});
