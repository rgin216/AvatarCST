import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { validateCompletedRun } from '../src/evaluation/publication.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'llm-run': { type: 'string' }, api: { type: 'string' }, date: { type: 'string' },
} });
if (!values['llm-run'] || !values.api || !/^\d{4}-\d{2}-\d{2}$/.test(values.date ?? '')) {
  throw new Error('Required: --llm-run directory --api https://BACKEND/api --date YYYY-MM-DD');
}
const llmRun = resolve(root, values['llm-run']);
const staging = resolve(root, 'evaluation/results', `current-${values.date}`);
const published = resolve(root, 'evaluation/published', values.date);
if (!llmRun.startsWith(staging + sep)) throw new Error('LLM run must be within the dated staging directory');
const api = new URL(values.api);
if (api.protocol !== 'https:' || api.username || api.password) throw new Error('Expected a public HTTPS API URL without credentials');
await mkdir(staging, { recursive: true });
const statusPath = resolve(staging, 'workflow-status.json');
const state = { startedAt: new Date().toISOString(), phase: 'waiting-for-llm', date: values.date, api: api.href, llmRun: relative(root, llmRun), stages: [] };
async function status(phase) {
  state.phase = phase;
  await writeFile(statusPath, JSON.stringify(state, null, 2));
  console.log(new Date().toISOString(), phase);
}
async function command(args) {
  console.log('node', args.join(' '));
  return new Promise((resolveCommand, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error(`Child terminated: ${signal}`)) : resolveCommand(code));
  });
}
async function findRun(parent) {
  const entries = await readdir(parent, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  if (dirs.length !== 1) throw new Error(`Expected one result directory in ${relative(root, parent)}`);
  return resolve(parent, dirs[0].name);
}
try {
  await status('waiting-for-llm');
  const deadline = Date.now() + 6 * 60 * 60 * 1000;
  let llm;
  while (!llm) {
    try { llm = JSON.parse(await readFile(resolve(llmRun, 'report.json'), 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      if (Date.now() > deadline) throw new Error('LLM report did not finish within six hours; checkpoints preserved');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
  const llmManifest = JSON.parse(await readFile(resolve(llmRun, 'manifest.json'), 'utf8'));
  validateCompletedRun(llmManifest, llm);
  state.stages.push({ name: 'llm', attempts: llm.rows.length, generationFailures: llm.rows.filter(r => r.status === 'error').length,
    critiqueFailures: llm.rows.flatMap(r => r.judgments).filter(j => j.status === 'error').length });

  await status('text-latency');
  const latencyParent = resolve(staging, 'text-latency');
  const modelPath = resolve(staging, 'latency-models.json');
  const scenarioPath = resolve(staging, 'latency-scenarios.json');
  await writeFile(modelPath, JSON.stringify(llmManifest.models));
  await writeFile(scenarioPath, JSON.stringify(llmManifest.scenarios));
  const latencyExit = await command(['scripts/evaluate-latency.js', '--models', modelPath, '--scenarios', scenarioPath, '--live',
    '--repeats', '1', '--warmups', '1', '--delay-ms', '15000', '--stop-on-quota',
    '--label', `rotation-${values.date}-local-client`, '--out', latencyParent]);
  const latencyRun = await findRun(latencyParent);
  const latency = JSON.parse(await readFile(resolve(latencyRun, 'report.json'), 'utf8'));
  state.stages.push({ name: 'text-latency', exitCode: latencyExit, complete: latency.complete, attempts: latency.rows.length });

  await status('deployed-speech-latency');
  const deployedDir = resolve(staging, 'deployed');
  const target = resolve(staging, 'deployment-target.json');
  await writeFile(target, JSON.stringify({ api: values.api }));
  const deployedExit = await command(['scripts/collect-deployed-voice-latency.js', target, deployedDir]);
  const deployed = JSON.parse(await readFile(resolve(deployedDir, 'deployed-summary.json'), 'utf8'));
  state.stages.push({ name: 'deployed-speech-latency', exitCode: deployedExit, complete: deployed.complete, attempts: deployed.rows.length });

  await status('publishing-repo-results');
  const exportExit = await command(['scripts/publish-evaluation.js', '--llm-run', llmRun,
    '--latency-run', latencyRun, '--deployed-run', deployedDir, '--date', values.date]);
  if (exportExit !== 0) throw new Error('Offline result export failed');
  state.completedAt = new Date().toISOString();
  state.phase = state.stages.some(s => s.generationFailures || s.critiqueFailures || s.exitCode || s.complete === false)
    ? 'completed-with-failures' : 'completed';
  await writeFile(statusPath, JSON.stringify(state, null, 2));
  console.log('Published results:', published, state.phase);
} catch (error) {
  state.error = error.message;
  await status('failed');
  console.error(error.message);
  process.exitCode = 1;
}
