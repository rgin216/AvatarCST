import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { distribution, runLatencyEvaluation, validateLatencyConfig, pairedLatency, toCsv } from './latency.js';

const models = ['a', 'b', 'c'].map(id => ({ id, provider: 'groq', model: id }));
const scenarios = JSON.parse(await readFile(new URL('../../evaluation/scenarios.json', import.meta.url), 'utf8')).slice(0, 2);

test('warmups are retained but excluded; order rotates and identical prompts are paired', async () => {
  let clock = 0;
  const calls = [], waits = [], saved = [];
  const report = await runLatencyEvaluation({ models, scenarios, repeats: 2, warmups: 1, delayMs: 100,
    now: () => clock, sleep: async ms => { waits.push(ms); clock += ms; }, onRow: async row => { saved.push(row); clock += 1000; },
    generate: async (messages, options) => { calls.push({ messages, options }); clock += { a: 10, b: 20, c: 30 }[options.model]; return 'Thank you.'; } });
  assert.equal(saved.length, 15);
  assert.equal(waits.length, 14);
  assert.deepEqual(report.rows.slice(3).map(row => row.modelId), ['a', 'b', 'c', 'b', 'c', 'a', 'b', 'c', 'a', 'c', 'a', 'b']);
  assert.deepEqual(report.summary.map(s => s.successfulLatency.meanMs), [10, 20, 30]);
  assert.equal(report.summary[0].attempts, 4);
  assert.equal(report.comparisons[0].meanDeltaMs, -10);
  assert.equal(report.comparisons[0].completePairs, 4);
  assert.equal(new Set(report.rows.slice(3, 6).map(r => r.promptHash)).size, 1);
  assert.deepEqual(calls[3].messages, calls[4].messages);
  assert.ok(calls.every(c => !c.options.json));
});

test('failures and empty responses checkpoint, stay out of successful stats and pairs', async () => {
  let clock = 0;
  const report = await runLatencyEvaluation({ models, scenarios: scenarios.slice(0, 1), warmups: 0, repeats: 1, now: () => clock,
    generate: async (_, options) => { clock += 5; if (options.model === 'a') throw new Error('429 rate limit'); return options.model === 'b' ? '' : 'Hello'; } });
  assert.equal(report.rows[0].errorCategory, 'rate_limit');
  assert.equal(report.rows[1].status, 'error');
  assert.equal(report.rows[2].status, 'ok');
  assert.equal(report.summary[0].failureRate, 1);
  assert.equal(report.summary[0].successfulLatency.meanMs, null);
  assert.equal(report.summary[0].failedAttemptLatency.meanMs, 5);
  assert.ok(report.comparisons.every(c => c.completePairs === 0 && c.excludedBlocks === 1));
});

test('percentiles use interpolation and standard deviation uses n-1', () => {
  const stats = distribution([40, 10, 30, 20]);
  assert.equal(stats.meanMs, 25);
  assert.equal(stats.p50Ms, 25);
  assert.equal(stats.p95Ms, 38.5);
  assert.equal(stats.sdMs, Math.sqrt(500 / 3));
  assert.equal(distribution([]).p99Ms, null);
  assert.equal(distribution([3]).sdMs, null);
  assert.throws(() => distribution([NaN]));
});

test('invalid sampling plans fail before any calls', () => {
  for (const override of [{ repeats: 0 }, { repeats: 1.5 }, { warmups: -1 }, { delayMs: NaN }, { delayMs: 60001 }]) {
    assert.throws(() => validateLatencyConfig({ models, scenarios, ...override }));
  }
  validateLatencyConfig({ models, scenarios, repeats: 100 });
});

test('CSV escapes quotes/newlines/formulas and keeps signed numeric comparisons numeric', () => {
  const csv = toCsv([{ text: '=HYPERLINK("x")\nhello', delta: -10, absent: null }], ['text', 'delta', 'absent']);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")\nhello"'));
  assert.ok(csv.includes(',"-10",""'));
});

test('checkpoint errors stop the experiment and duplicate paired rows are rejected', async () => {
  let calls = 0;
  await assert.rejects(runLatencyEvaluation({ models, scenarios, generate: async () => { calls++; return 'Hello'; },
    onRow: async () => { throw new Error('disk full'); } }), /disk full/);
  assert.equal(calls, 1);
  const row = { phase: 'measurement', scenarioId: 'x', repeat: 0, modelId: 'a', status: 'ok', latencyMs: 1 };
  assert.throws(() => pairedLatency([row, row], models), /Duplicate/);
});
