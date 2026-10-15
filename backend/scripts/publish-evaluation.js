// Offline repository export only: never makes provider or deployment requests.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { portableArtifact, validateCompletedRun } from '../src/evaluation/publication.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'llm-run': { type: 'string' }, 'deployed-run': { type: 'string' },
  'latency-run': { type: 'string' }, date: { type: 'string' }, out: { type: 'string' },
} });
try {
  if (!values['llm-run'] || !/^\d{4}-\d{2}-\d{2}$/.test(values.date ?? '')) {
    throw new Error('Required: --llm-run directory --date YYYY-MM-DD; optional --deployed-run and --latency-run');
  }
  const llmDir = resolve(values['llm-run']);
  const manifest = JSON.parse(await readFile(resolve(llmDir, 'manifest.json'), 'utf8'));
  const report = JSON.parse(await readFile(resolve(llmDir, 'report.json'), 'utf8'));
  validateCompletedRun(manifest, report);
  const out = resolve(values.out ?? resolve(root, 'evaluation/published', values.date));
  const secrets = Object.entries(dotenv.parse(await readFile(resolve(root, '.env'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''; throw error;
  }))).filter(([key, value]) => /KEY|TOKEN|PASSWORD|SECRET/i.test(key) && value.length >= 8).map(([, value]) => value);
  const files = new Map();
  async function collect(dir, names, prefix = '') {
    for (const name of names) {
      const text = await readFile(resolve(dir, name), 'utf8');
      files.set(prefix + name, portableArtifact(text, root, secrets));
    }
  }
  await collect(llmDir, ['manifest.json', 'report.json', 'rows.jsonl', 'human-review.json', 'disagreements.json'], 'llm/');
  let deployed;
  if (values['deployed-run']) {
    const dir = resolve(values['deployed-run']);
    deployed = JSON.parse(await readFile(resolve(dir, 'deployed-summary.json'), 'utf8'));
    await collect(dir, ['deployed-summary.json', 'deployed-voice-rows.jsonl', 'deployed-voice-samples.csv']);
  }
  let latency;
  if (values['latency-run']) {
    const dir = resolve(values['latency-run']);
    latency = JSON.parse(await readFile(resolve(dir, 'report.json'), 'utf8'));
    if (JSON.stringify(latency.models) !== JSON.stringify(report.models)) throw new Error('Latency roster differs from LLM roster');
    await collect(dir, ['manifest.json', 'report.json', 'rows.jsonl', 'samples.csv', 'summary.csv', 'paired-comparisons.csv'], 'text-latency/');
  }
  // Validate and scan inputs before creating the destination; never overwrite a collection.
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out, { recursive: false });
  for (const [name, text] of files) {
    await mkdir(dirname(resolve(out, name)), { recursive: true });
    await writeFile(resolve(out, name), text);
  }
  execFileSync(process.execPath, ['scripts/summarize-evaluation.js', '--report', resolve(out, 'llm/report.json'),
    '--out', out, ...(latency ? ['--latency', resolve(out, 'text-latency/report.json')] : [])], { cwd: root, stdio: 'inherit', windowsHide: true });
  const generationFailures = report.rows.filter(r => r.status === 'error').length;
  const critiqueFailures = report.rows.flatMap(r => r.judgments).filter(j => j.status === 'error').length;
  const collection = { date: values.date, exportedAt: new Date().toISOString(),
    models: report.models, scenarios: manifest.scenarios.length, repeats: manifest.repeats,
    llm: { attempts: report.rows.length, generationFailures, critiqueFailures, revision: manifest.revision,
      workingTreeStatus: manifest.workingTreeStatus ?? null, sourceHash: manifest.sourceHash ?? null,
      provenance: 'HEAD alone does not establish exact working-tree contents. Saved prompts and raw responses are the experiment evidence.' },
    deployed: deployed ? { complete: deployed.complete, attempts: deployed.rows.length, stoppedReason: deployed.stoppedReason } : null,
    separateTextLatency: latency ? { complete: latency.complete, attempts: latency.rows.length } : null };
  await writeFile(resolve(out, 'collection.json'), JSON.stringify(collection, null, 2));
  await writeFile(resolve(out, 'README.md'), `# Evaluation collection — ${values.date}\n\n` +
    `Completed LLM plan: ${manifest.scenarios.length} scenarios × ${report.models.length} models × ${manifest.repeats} repetition(s). ` +
    `${generationFailures} generation failures; ${critiqueFailures} failed critiques.\n\n` +
    `Models: ${report.models.map(m => m.id).join(', ')}. Read [evaluation.md](evaluation.md) for scores separated by critic and generation latency.\n\n` +
    '- `llm/`: manifest, raw responses/critiques, checkpoints, disagreements, and anonymous human-review sheet.\n' +
    '- `judge-scores.csv` and `failures.csv`: derived score and failure tables.\n' +
    (deployed ? `- [Deployed speech latency](deployed-voice-evaluation.md): ${deployed.rows.filter(r => r.phase === 'measurement').length} measured turns and ${deployed.rows.filter(r => r.phase === 'warmup').length} warmups. Complete: ${deployed.complete}. Raw JSON/JSONL and CSV included.\n` : '') +
    (latency ? '- `text-latency/`: separate generation benchmark.\n' : '- No separate text-only latency benchmark was collected; generation times above come from the quality run.\n') +
    '\nAll inputs are synthetic. Cache/prefetch effects remain enabled in the deployed pilot. Service durations can overlap; API completion excludes microphone capture and browser playback/rendering onset. Missing service timings on cached paths are excluded, not zero-filled.\n\n' +
    'The manifest records HEAD; older runs do not capture working-tree status or source hashes, so HEAD alone does not identify the exact evaluated source. Saved prompts document the evaluated configuration. Deployed build revision was not independently verified. Automated scores require independent human calibration; these results do not establish clinical effectiveness. Keep disagreements and model scores hidden from reviewers until they score `llm/human-review.json`.\n\n' +
    'This collection was exported offline with `scripts/publish-evaluation.js`; export made no API calls. `checksums.json` hashes the portable exported artifacts. Runtime originals remain under ignored `evaluation/results/`.\n');
  // Generated summaries also include source paths; make the whole collection portable.
  const checksums = {};
  async function finalize(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { await finalize(path); continue; }
      const text = portableArtifact(await readFile(path, 'utf8'), root, secrets);
      await writeFile(path, text);
      checksums[relative(out, path).replaceAll('\\', '/')] = createHash('sha256').update(text).digest('hex');
    }
  }
  await finalize(out);
  await writeFile(resolve(out, 'checksums.json'), JSON.stringify(checksums, null, 2));
  console.log('Exported collection: ' + out);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
