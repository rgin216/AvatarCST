import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runEvaluation, parseJudgment, validateInputs, RUBRIC } from './runner.js';

const models = ['a', 'b', 'c'].map(id => ({ id, provider: 'groq', model: id }));
const scenarios = JSON.parse(await readFile(new URL('../../evaluation/scenarios.json', import.meta.url), 'utf8')).slice(0, 2);
const verdict = JSON.stringify({ scores: Object.fromEntries(Object.keys(RUBRIC).map(k => [k, { score: 4, evidence: 'A concrete acknowledgement.' }])), criticalFailures: [] });

test('rotates all facilitators, uses identical contexts and blinds independent critics', async () => {
  const generationCalls = [], judgeCalls = [];
  const report = await runEvaluation({ models, scenarios, generate: async (messages, options) => {
    (options.json ? judgeCalls : generationCalls).push({ messages, options });
    return options.json ? verdict : 'A concrete acknowledgement.';
  } });
  assert.equal(report.rows.length, 6);
  assert.equal(judgeCalls.length, 12);
  assert.deepEqual(generationCalls.map(c => c.options.model), ['a', 'b', 'c', 'b', 'c', 'a']);
  assert.equal(new Set(report.rows.slice(0, 3).map(r => r.promptHash)).size, 1);
  for (const row of report.rows) assert.ok(row.judgments.every(j => j.judge !== row.facilitator));
  const payload = JSON.parse(judgeCalls[0].messages[1].content);
  assert.equal(payload.facilitator, undefined);
  assert.equal(payload.judgments, undefined);
  assert.ok(payload.facilitatorInstructions.includes(scenarios[0].context.slide.prompt));
  assert.equal(report.summary[0].byJudge.b.count, 2);
  assert.equal(report.summary[0].localCheckFailures, 0);
});

test('generation failure skips critics without replacing output with a hidden fallback', async () => {
  let judgeCalls = 0;
  const report = await runEvaluation({ models, scenarios: scenarios.slice(0, 1), generate: async (_, options) => {
    if (options.json) { judgeCalls++; return verdict; }
    if (options.model === 'a') throw new Error('timeout');
    return 'Thank you.';
  } });
  assert.equal(judgeCalls, 4);
  assert.equal(report.rows[0].status, 'error');
  assert.equal(report.rows[0].responsePreview, undefined);
  assert.equal(report.summary[0].generationFailures, 1);
  assert.equal(report.summary[0].byJudge.b.means.grounding, null);
});

test('invalid judge outputs remain failures and do not enter score averages', async () => {
  const report = await runEvaluation({ models, scenarios: scenarios.slice(0, 1), generate: async (_, options) =>
    options.json ? (options.model === 'b' ? '{"scores":{}}' : verdict) : 'Thank you.' });
  assert.equal(report.summary[0].failedJudgments, 1);
  assert.equal(report.summary[0].byJudge.b.count, 0);
  assert.equal(report.summary[0].byJudge.c.means.respect, 4);
});

test('validates scores, evidence and critical failure structure', () => {
  assert.throws(() => parseJudgment('not json'));
  const data = JSON.parse(verdict);
  data.scores.grounding.score = 6;
  assert.throws(() => parseJudgment(JSON.stringify(data)), /grounding/);
  data.scores.grounding.score = 4;
  data.criticalFailures = ['unsafe'];
  assert.throws(() => parseJudgment(JSON.stringify(data)), /critical/);
});

test('rejects aliases of the same underlying model and invalid runs', () => {
  assert.throws(() => validateInputs([models[0], { ...models[0], id: 'alias' }], scenarios, 1), /duplicate/);
  assert.throws(() => validateInputs(models, scenarios, 0), /Repeats/);
  assert.throws(() => validateInputs(models, [scenarios[0], scenarios[0]], 1), /duplicate/);
});

test('flags critical failures separately and checkpoints every response', async () => {
  const critical = JSON.parse(verdict);
  critical.criticalFailures = [{ reason: 'Invented family', evidence: 'Your son' }];
  const saved = [];
  const report = await runEvaluation({ models, scenarios: scenarios.slice(0, 1), onRow: async r => saved.push(r.id),
    generate: async (_, options) => options.json ? JSON.stringify(critical) : 'Your son enjoys gardening.' });
  assert.equal(saved.length, 3);
  assert.equal(report.summary[0].criticalFlaggedResponses, 1);
});

test('repetitions preserve pairing and local word/question checks', async () => {
  const report = await runEvaluation({ models, scenarios: scenarios.slice(0, 1), repeats: 2,
    generate: async (_, options) => options.json ? verdict : 'Would you tell me more?' });
  assert.equal(report.rows.length, 6);
  assert.ok(report.rows.every(r => !r.checks.noQuestion));
  assert.equal(report.summary[0].byJudge.b.count, 2);
  assert.equal(report.summary[0].localCheckFailures, 2);
});
