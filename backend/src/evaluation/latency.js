import { createHash, randomUUID } from 'node:crypto';
import { generateResponse } from '../services/llmService.js';
import { buildCstAdaptiveResponseInstructions } from '../services/promptService.js';
import { validateInputs } from './runner.js';

export const LATENCY_SCOPE = 'adaptive-acknowledgement-client-completion';

export function validateLatencyConfig({ models, scenarios, repeats = 10, warmups = 1, delayMs = 0 }) {
  // Reuse fixture/model validation, but allow larger latency sampling plans.
  validateInputs(models, scenarios, 1);
  for (const [key, value, min, max] of [
    ['repeats', repeats, 1, 1000], ['warmups', warmups, 0, 100], ['delayMs', delayMs, 0, 60000],
  ]) if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer ${min}–${max}`);
}

// Linear interpolation at (n - 1) * p, including singleton/empty samples.
export function distribution(values) {
  if (values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid latency sample');
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return { n: 0, meanMs: null, sdMs: null, minMs: null, p50Ms: null, p90Ms: null, p95Ms: null, p99Ms: null, maxMs: null };
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const quantile = p => {
    const index = (n - 1) * p, lower = Math.floor(index);
    return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
  };
  return { n, meanMs: mean, sdMs: n > 1 ? Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)) : null,
    minMs: sorted[0], p50Ms: quantile(.5), p90Ms: quantile(.9), p95Ms: quantile(.95), p99Ms: quantile(.99), maxMs: sorted[n - 1] };
}

export function summarizeLatency(rows, models) {
  const measured = rows.filter(row => row.phase === 'measurement');
  const summarize = own => ({ attempts: own.length, successes: own.filter(r => r.status === 'ok').length,
    failures: own.filter(r => r.status === 'error').length,
    failureRate: own.length ? own.filter(r => r.status === 'error').length / own.length : null,
    successfulLatency: distribution(own.filter(r => r.status === 'ok').map(r => r.latencyMs)),
    failedAttemptLatency: distribution(own.filter(r => r.status === 'error').map(r => r.latencyMs)) });
  return models.map(model => {
    const own = measured.filter(r => r.modelId === model.id);
    return { modelId: model.id, ...summarize(own), byScenario: Object.fromEntries(
      [...new Set(own.map(r => r.scenarioId))].map(id => [id, summarize(own.filter(r => r.scenarioId === id))])) };
  });
}

export function pairedLatency(rows, models) {
  const blocks = new Map();
  for (const row of rows.filter(r => r.phase === 'measurement')) {
    const key = JSON.stringify([row.scenarioId, row.repeat]);
    if (!blocks.has(key)) blocks.set(key, new Map());
    if (blocks.get(key).has(row.modelId)) throw new Error('Duplicate model in measurement block');
    blocks.get(key).set(row.modelId, row);
  }
  return models.flatMap((a, index) => models.slice(index + 1).map(b => {
    const pairs = [...blocks.values()].map(block => [block.get(a.id), block.get(b.id)])
      .filter(([left, right]) => left?.status === 'ok' && right?.status === 'ok');
    const deltas = pairs.map(([left, right]) => left.latencyMs - right.latencyMs);
    return { modelA: a.id, modelB: b.id, completePairs: pairs.length, excludedBlocks: blocks.size - pairs.length,
      meanDeltaMs: deltas.length ? deltas.reduce((x, y) => x + y, 0) / deltas.length : null,
      aFasterPairs: deltas.filter(d => d < 0).length, ties: deltas.filter(d => d === 0).length,
      pairs: pairs.map(([left, right]) => ({ scenarioId: left.scenarioId, repeat: left.repeat, deltaMs: left.latencyMs - right.latencyMs })) };
  }));
}

export async function runLatencyEvaluation({ models, scenarios, repeats = 10, warmups = 1, delayMs = 0,
  generate = generateResponse, now = () => performance.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  onRow = async () => {} }) {
  validateLatencyConfig({ models, scenarios, repeats, warmups, delayMs });
  const prepared = scenarios.map(s => ({ ...s, prompt: buildCstAdaptiveResponseInstructions(s.context) }));
  const rows = [];
  let sequence = 0;
  async function measure(scenario, model, phase, repeat, order) {
    if (sequence && delayMs) await sleep(delayMs);
    const row = { id: randomUUID(), sequence: sequence++, phase, repeat, order, scenarioId: scenario.id,
      modelId: model.id, provider: model.provider, model: model.model, startedAt: new Date().toISOString(),
      promptHash: createHash('sha256').update(scenario.prompt).digest('hex'), status: 'ok' };
    const start = now();
    try {
      const output = await generate([{ role: 'system', content: scenario.prompt }, { role: 'user', content: scenario.input }],
        { provider: model.provider, model: model.model, temperature: .4, maxTokens: 256 });
      if (typeof output !== 'string' || !output.trim()) throw new Error('Empty generation');
      row.output = output;
      row.outputCharacters = output.length;
      row.outputWords = output.trim().split(/\s+/u).length;
    } catch (error) {
      row.status = 'error'; row.error = error.message;
      row.errorCategory = /429|rate.limit|quota/i.test(error.message) ? 'rate_limit'
        : /timeout|timed out|abort/i.test(error.message) ? 'timeout' : 'generation_error';
    } finally { row.latencyMs = now() - start; }
    rows.push(row);
    await onRow(row);
  }
  // Warm each model before measured blocks, retaining every warm-up failure.
  for (let repeat = 0; repeat < warmups; repeat++) {
    for (const [order, model] of models.entries()) await measure(prepared[0], model, 'warmup', repeat, order);
  }
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const [index, scenario] of prepared.entries()) {
      const offset = (index + repeat) % models.length;
      const ordered = [...models.slice(offset), ...models.slice(0, offset)];
      for (const [order, model] of ordered.entries()) await measure(scenario, model, 'measurement', repeat, order);
    }
  }
  return { schemaVersion: 1, scope: LATENCY_SCOPE, models, repeats, warmups, delayMs,
    preparedScenarios: prepared, rows, summary: summarizeLatency(rows, models), comparisons: pairedLatency(rows, models) };
}

export function toCsv(records, columns) {
  const escape = value => {
    let text = value === null || value === undefined ? '' : String(value);
    // Prevent spreadsheet formula evaluation of provider/scenario/output fields.
    if (typeof value === 'string' && /^[\s]*[=+\-@]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [columns.map(escape).join(','), ...records.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n') + '\r\n';
}

export const SAMPLE_COLUMNS = ['id', 'sequence', 'phase', 'repeat', 'order', 'scenarioId', 'modelId', 'provider', 'model',
  'startedAt', 'promptHash', 'status', 'latencyMs', 'outputCharacters', 'outputWords', 'errorCategory', 'error'];

export function summaryRecords(summary) {
  return summary.flatMap(item => [
    { modelId: item.modelId, scenarioId: 'ALL', ...item },
    ...Object.entries(item.byScenario).map(([scenarioId, stats]) => ({ modelId: item.modelId, scenarioId, ...stats })),
  ].map(item => ({ modelId: item.modelId, scenarioId: item.scenarioId, attempts: item.attempts,
    failures: item.failures, failureRate: item.failureRate, ...item.successfulLatency })));
}
export const SUMMARY_COLUMNS = ['modelId', 'scenarioId', 'attempts', 'failures', 'failureRate', 'n', 'meanMs', 'sdMs',
  'minMs', 'p50Ms', 'p90Ms', 'p95Ms', 'p99Ms', 'maxMs'];
