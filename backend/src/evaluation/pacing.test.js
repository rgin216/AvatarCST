import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacedGenerator } from './pacing.js';

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
