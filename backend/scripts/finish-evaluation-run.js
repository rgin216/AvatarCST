// Complete an already-running rotation experiment, then collect paced latency.
import { readFile, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { summarize, RUBRIC } from '../src/evaluation/runner.js';
import { validateCompletedRun } from '../src/evaluation/publication.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rotation = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
await mkdir(out, { recursive: true });
const log = resolve(out, 'workflow.log');
async function record(message) {
  const line = new Date().toISOString() + ' ' + message;
  console.log(line);
  await appendFile(log, line + '\n');
}
let report;
let lastCheckpointCount = 0;
const deadline = Date.now() + 6 * 60 * 60 * 1000;
await record('Waiting for full rotation report: ' + rotation);
while (!report) {
  try { report = JSON.parse(await readFile(rotation, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    if (Date.now() > deadline) throw new Error('Rotation report did not complete within six hours; checkpoints remain saved');
    try {
      const manifest = JSON.parse(await readFile(resolve(dirname(rotation), 'manifest.json'), 'utf8'));
      const checkpoint = await readFile(resolve(dirname(rotation), 'rows.jsonl'), 'utf8');
      const rows = checkpoint.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (rows.length > lastCheckpointCount) {
        const interimPath = resolve(out, 'interim-rotation.json');
        await writeFile(interimPath, JSON.stringify({ models: manifest.models, rows, rubric: RUBRIC,
          summary: summarize(rows, manifest.models), requestPolicy: manifest.requestPolicy, complete: false,
          plannedRows: manifest.models.length * manifest.scenarios.length * manifest.repeats }, null, 2));
        const interim = await command(['scripts/summarize-evaluation.js', '--report', interimPath, '--out', out]);
        if (interim.code !== 0) throw new Error('Interim report generation failed');
        lastCheckpointCount = rows.length;
        await record(`Interim evaluation updated: ${rows.length} facilitator rows.`);
      }
    } catch (checkpointError) {
      if (checkpointError.code !== 'ENOENT' && !(checkpointError instanceof SyntaxError)) throw checkpointError;
    }
    await new Promise(r => setTimeout(r, 15000));
  }
}
const manifest = JSON.parse(await readFile(resolve(dirname(rotation), 'manifest.json'), 'utf8'));
validateCompletedRun(manifest, report);
await record(`Rotation complete: ${report.rows.length} rows. Starting separate latency benchmark.`);
function command(args) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, windowsHide: true });
    let output = '';
    let writes = Promise.resolve();
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      const text = chunk.toString();
      output += text;
      writes = writes.then(() => appendFile(log, text));
    });
    child.on('error', reject);
    child.on('close', async code => {
      try { await writes; resolveCommand({ code, output }); } catch (error) { reject(error); }
    });
  });
}
const dailyExhausted = report.rows.some(row => [row.error, ...row.judgments.map(j => j.error)].some(error => error && /(?:tokens|requests) per day|daily.*(?:limit|quota)|\bTPD\b|\bRPD\b/i.test(error)));
let latencyPath;
let latencyExitCode;
if (dailyExhausted) await record('Daily quota exhaustion recorded; separate latency test skipped.');
else {
  const modelPath = resolve(out, 'latency-models.json');
  const scenarioPath = resolve(out, 'latency-scenarios.json');
  await writeFile(modelPath, JSON.stringify(manifest.models));
  await writeFile(scenarioPath, JSON.stringify(manifest.scenarios));
  const result = await command(['scripts/evaluate-latency.js', '--models', modelPath, '--scenarios', scenarioPath, '--live', '--repeats', '1', '--warmups', '1', '--delay-ms', '30000', '--stop-on-quota', '--label', 'rotation-follow-up', '--out', resolve(out, 'latency')]);
  latencyExitCode = result.code;
  const match = /Saving results to (.+)/.exec(result.output);
  if (match) {
    const candidate = resolve(match[1].trim(), 'report.json');
    try { JSON.parse(await readFile(candidate, 'utf8')); latencyPath = candidate; } catch {}
  }
  await record(`Latency command completed with exit code ${result.code}; report ${latencyPath || 'unavailable'}.`);
}
const args = ['scripts/summarize-evaluation.js', '--report', rotation, '--out', out];
if (latencyPath) args.push('--latency', latencyPath);
const summary = await command(args);
if (summary.code !== 0) throw new Error('Evaluation report generation failed; inspect workflow.log');
await writeFile(resolve(out, 'completion.json'), JSON.stringify({ completedAt: new Date().toISOString(), rotation, latencyPath: latencyPath ?? null, latencyExitCode: latencyExitCode ?? null, dailyExhausted, report: resolve(out, 'evaluation.md') }, null, 2));
await record('Evaluation ready: ' + resolve(out, 'evaluation.md'));
