import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  live: { type: 'boolean', default: false },
  models: { type: 'string', default: resolve(root, 'evaluation/models.json') },
  scenarios: { type: 'string', default: resolve(root, 'evaluation/scenarios.json') },
  repeats: { type: 'string', default: '1' },
  limit: { type: 'string' },
  out: { type: 'string', default: resolve(root, 'evaluation/results') },
} });
try {
  dotenv.config({ path: resolve(root, '.env'), quiet: true });
  const { runEvaluation, validateInputs, RUBRIC } = await import('../src/evaluation/runner.js');
  const models = JSON.parse(await readFile(values.models, 'utf8'));
  let scenarios = JSON.parse(await readFile(values.scenarios, 'utf8'));
  if (values.limit !== undefined) {
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Limit must be a positive integer');
    scenarios = scenarios.slice(0, limit);
  }
  const repeats = Number(values.repeats);
  validateInputs(models, scenarios, repeats);
  const generations = models.length * scenarios.length * repeats;
  console.log(JSON.stringify({ mode: values.live ? 'live' : 'dry-run', models, scenarios: scenarios.length, repeats,
    generationCalls: generations, judgeCalls: generations * (models.length - 1),
    note: 'Generation truncation may cause one additional API call. Live calls incur provider usage.' }, null, 2));
  if (values.live) {
    for (const provider of new Set(models.map(m => m.provider))) {
      if (!process.env[provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY']) throw new Error('Missing API key for ' + provider);
    }
    const out = resolve(values.out, new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
    await mkdir(out, { recursive: true });
    let revision = 'unknown';
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify({
      startedAt: new Date().toISOString(), revision, models, scenarios, repeats,
      fixtureHash: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex'),
    }, null, 2));
    console.log('Saving results to ' + out);
    const result = await runEvaluation({ models, scenarios, repeats, onRow: async row => {
      await appendFile(resolve(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
      console.log(row.scenario + ' / ' + row.facilitator + ': ' + row.status);
    } });
    await writeFile(resolve(out, 'report.json'), JSON.stringify(result, null, 2));
    // Blinded rows contain neither model IDs nor automated scores.
    const review = result.rows.filter(r => r.status === 'ok').map(r => ({
      id: r.id, scenario: r.scenario, input: r.input, context: r.context,
      acknowledgement: r.acknowledgement, responsePreview: r.responsePreview,
      humanScores: Object.fromEntries(Object.keys(RUBRIC).map(k => [k, null])),
      criticalFailures: [], notes: '',
    })).sort((a, b) => a.id.localeCompare(b.id));
    await writeFile(resolve(out, 'human-review.json'), JSON.stringify(review, null, 2));
    const failed = result.rows.some(r => r.status === 'error' || r.judgments.some(j => j.status === 'error'));
    console.log(JSON.stringify(result.summary, null, 2));
    if (failed) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
