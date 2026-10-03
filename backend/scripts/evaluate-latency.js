import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { platform, arch, cpus } from 'node:os';
import dotenv from 'dotenv';
import { assertProviderCredentials } from '../src/services/llmProviders.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean', default: false },
    models: { type: 'string', default: resolve(root, 'evaluation/models.json') },
    scenarios: { type: 'string', default: resolve(root, 'evaluation/scenarios.json') },
    repeats: { type: 'string', default: '10' }, warmups: { type: 'string', default: '1' },
    'delay-ms': { type: 'string', default: '1000' }, limit: { type: 'string' },
    out: { type: 'string', default: resolve(root, 'evaluation/results') },
    label: { type: 'string', default: '' },
  } });
  dotenv.config({ path: resolve(root, '.env'), quiet: true });
  const { validateLatencyConfig, runLatencyEvaluation, LATENCY_SCOPE, toCsv, SAMPLE_COLUMNS,
    summaryRecords, SUMMARY_COLUMNS } = await import('../src/evaluation/latency.js');
  const models = JSON.parse(await readFile(resolve(values.models), 'utf8'));
  let scenarios = JSON.parse(await readFile(resolve(values.scenarios), 'utf8'));
  if (values.limit !== undefined) {
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
    scenarios = scenarios.slice(0, limit);
  }
  const config = { models, scenarios, repeats: Number(values.repeats), warmups: Number(values.warmups), delayMs: Number(values['delay-ms']) };
  validateLatencyConfig(config);
  console.log(JSON.stringify({ mode: values.live ? 'live' : 'dry-run', scope: LATENCY_SCOPE,
    measuredCalls: models.length * scenarios.length * config.repeats,
    warmupCalls: models.length * config.warmups, delayMs: config.delayMs,
    note: 'Sequential completion timing; internal adapter retries included. Live runs incur API usage.' }, null, 2));
  if (values.live) {
    assertProviderCredentials(models);
    const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-latency-' + randomUUID().slice(0, 8);
    const out = resolve(values.out, runId);
    await mkdir(out, { recursive: true });
    const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
    const manifest = { schemaVersion: 1, runId, scope: LATENCY_SCOPE, label: values.label, startedAt: new Date().toISOString(),
      revision: git(['rev-parse', 'HEAD']), workingTreeStatus: git(['status', '--short']),
      runtime: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
      ...config, fixtureHash: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex'),
      sourceHash: createHash('sha256').update(await readFile(new URL('../src/evaluation/latency.js', import.meta.url)))
        .update(await readFile(new URL('../src/services/llmService.js', import.meta.url)))
        .update(await readFile(new URL('../src/services/promptService.js', import.meta.url)))
        .update(await readFile(new URL('../src/services/anthropicService.js', import.meta.url))).digest('hex'),
      requestOptions: { temperature: .4, maxTokens: 256 },
      timing: 'Monotonic client wall time around generateResponse, including parsing, cleanup and internal retries; excludes pacing and disk writes.',
    };
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Saving results to ' + out);
    const report = await runLatencyEvaluation({ ...config, onRow: async row => {
      await appendFile(resolve(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
      console.log(`${row.phase} ${row.scenarioId} / ${row.modelId}: ${row.status} (${row.latencyMs.toFixed(1)} ms)`);
    } });
    await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
    await writeFile(resolve(out, 'samples.csv'), toCsv(report.rows, SAMPLE_COLUMNS));
    await writeFile(resolve(out, 'summary.csv'), toCsv(summaryRecords(report.summary), SUMMARY_COLUMNS));
    await writeFile(resolve(out, 'paired-comparisons.csv'), toCsv(report.comparisons.flatMap(comparison => comparison.pairs.map(pair => ({
      modelA: comparison.modelA, modelB: comparison.modelB, ...pair,
    }))), ['modelA', 'modelB', 'scenarioId', 'repeat', 'deltaMs']));
    manifest.completedAt = new Date().toISOString();
    manifest.status = report.rows.some(row => row.status === 'error') ? 'completed_with_errors' : 'completed';
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(report.summary, null, 2));
    if (manifest.status === 'completed_with_errors') process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
