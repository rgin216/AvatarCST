// Summarises evaluate-stt.js runs for reporting: WER with speaker-bootstrap 95% CIs per provider and group,
// error types and severity, per-speaker spread, failures, prompt leaks, latency, and paired comparisons.
// Usage: node scripts/analyze-stt.js --runs <beforeRunId>,<afterRunId>
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { bootstrapWer } from '../src/evaluation/wer.js';

const execFileAsync = promisify(execFile);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEAK = /do not|latin letters|translate|strong accent|speaking english/i;
const GROUPS = {
  All: () => true,
  Control: row => row.group === 'Control',
  ProbableAD: row => row.group === 'ProbableAD',
  'All impaired': row => row.group !== 'Control',
};

const pct = value => (value === null || Number.isNaN(value) ? '-' : (100 * value).toFixed(1) + '%');
const ci = c => `${pct(c.estimate)} [${pct(c.low)}, ${pct(c.high)}]`;
const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
const clipKey = row => `${row.provider}|${row.transcript}|${row.clip}`;

function bySpeaker(rows, errorsKey = 'errors', wordsKey = 'referenceWords') {
  const speakers = new Map();
  for (const row of rows) {
    const s = speakers.get(row.transcript) ?? { errors: 0, words: 0 };
    s.errors += row[errorsKey];
    s.words += row[wordsKey];
    speakers.set(row.transcript, s);
  }
  return [...speakers.values()];
}

function summarize(rows) {
  const ok = rows.filter(row => row.status === 'ok');
  const failed = rows.filter(row => row.status !== 'ok');
  const sum = key => ok.reduce((total, row) => total + row[key], 0);
  const errors = sum('errors');
  const speakers = bySpeaker(ok);
  const speakerWers = speakers.map(s => s.errors / s.words).sort((a, b) => a - b);
  const latencies = ok.map(row => row.latencyMs).sort((a, b) => a - b);
  return {
    clips: rows.length, scored: ok.length, speakers: speakers.length,
    failed: Object.fromEntries(Object.entries(Object.groupBy(failed, row => /English/.test(row.error) ? 'notEnglish' : /timeout/i.test(row.error) ? 'timeout' : 'other'))
      .map(([kind, list]) => [kind, list.length])),
    wer: bootstrapWer(speakers),
    verbatimWer: sum('verbatimErrors') / sum('verbatimReferenceWords'),
    errorTypes: { substitutions: sum('substitutions') / errors, deletions: sum('deletions') / errors, insertions: sum('insertions') / errors },
    severity: {
      perfect: ok.filter(row => row.wer === 0).length,
      minor: ok.filter(row => row.wer > 0 && row.wer <= 0.25).length,
      major: ok.filter(row => row.wer > 0.25 && row.wer < 0.75).length,
      meaningLost: ok.filter(row => row.wer >= 0.75).length,
    },
    promptLeaks: ok.filter(row => LEAK.test(row.hypothesis)).length,
    emptyOutputs: ok.filter(row => !row.hypothesis?.trim()).length,
    speakerWer: { min: speakerWers[0], q1: quantile(speakerWers, 0.25), median: quantile(speakerWers, 0.5), q3: quantile(speakerWers, 0.75), max: speakerWers.at(-1) },
    latencyMs: { median: quantile(latencies, 0.5), p90: quantile(latencies, 0.9) },
  };
}

// Mean loudness (RMS dB) of each clip in the original, un-normalised audio. Cached because it takes a minute.
async function clipLoudness(rows, dataDir, cachePath) {
  let cache = {};
  try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch {}
  for (const row of rows) {
    const key = `${row.transcript}|${row.clip}`;
    if (key in cache) continue;
    const audio = resolve(dataDir, row.transcript.replace(/\.cha$/, '.wav'));
    const { stderr } = await execFileAsync(ffmpegPath, ['-hide_banner', '-ss', String(row.startMs / 1000),
      '-t', String((row.endMs - row.startMs) / 1000), '-i', audio, '-af', 'volumedetect', '-f', 'null', '-']);
    cache[key] = Number(stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1] ?? -91);
  }
  await writeFile(cachePath, JSON.stringify(cache));
  return cache;
}

// Spearman rank correlation.
function spearman(xs, ys) {
  const rank = values => {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = Array(values.length);
    order.forEach(([, i], r) => { ranks[i] = r; });
    return ranks;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mean = (n - 1) / 2;
  const cov = rx.reduce((s, r, i) => s + (r - mean) * (ry[i] - mean), 0);
  const sd = Math.sqrt(rx.reduce((s, r) => s + (r - mean) ** 2, 0) * ry.reduce((s, r) => s + (r - mean) ** 2, 0));
  return cov / sd;
}

// Paired by speaker over clips scored in both conditions; estimate is WER(B) - WER(A).
function pairedDifference(rowsA, rowsB) {
  const okB = new Map(rowsB.filter(row => row.status === 'ok').map(row => [`${row.transcript}|${row.clip}`, row]));
  const speakers = new Map();
  for (const a of rowsA) {
    const b = okB.get(`${a.transcript}|${a.clip}`);
    if (a.status !== 'ok' || !b) continue;
    const s = speakers.get(a.transcript) ?? { errors: 0, words: 0, errorsB: 0, wordsB: 0 };
    s.errors += a.errors; s.words += a.referenceWords; s.errorsB += b.errors; s.wordsB += b.referenceWords;
    speakers.set(a.transcript, s);
  }
  return speakers.size ? { speakers: speakers.size, ...bootstrapWer([...speakers.values()]) } : null;
}

try {
  const { values } = parseArgs({ options: {
    runs: { type: 'string' },
    results: { type: 'string', default: resolve(root, 'evaluation/results') },
    data: { type: 'string', default: resolve(root, 'evaluation/dementiabank') },
  } });
  if (!values.runs) throw new Error('Pass --runs <runId>[,<runId>...] (folders under evaluation/results)');

  const runs = [];
  for (const id of values.runs.split(',').map(s => s.trim())) {
    const dir = resolve(values.results, id);
    const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
    const rows = (await readFile(resolve(dir, 'rows.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    runs.push({ id, label: manifest.label || id, manifest, rows });
  }

  const analysis = { generatedAt: new Date().toISOString(), runs: runs.map(({ id, label, manifest }) => ({ id, label,
    prompt: manifest.prompt ? 'legacy instruction prompt' : 'none', normalize: manifest.normalize, models: manifest.models,
    revision: manifest.revision })), summaries: [], paired: [] };

  const lines = ['# STT WER analysis', '', `Runs: ${runs.map(run => `${run.label} (${run.id})`).join(', ')}`, '',
    '| Run | Provider | Group | Speakers | Clips scored | Failed | WER [95% CI] | Verbatim WER | Perfect | Meaning lost | Prompt leaks | Median latency |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const run of runs) {
    for (const provider of Object.keys(run.manifest.models)) {
      for (const [group, include] of Object.entries(GROUPS)) {
        const rows = run.rows.filter(row => row.provider === provider && include(row));
        if (!rows.length) continue;
        const s = summarize(rows);
        analysis.summaries.push({ run: run.label, provider, group, ...s });
        const failed = Object.values(s.failed).reduce((a, b) => a + b, 0);
        lines.push(`| ${run.label} | ${provider} | ${group} | ${s.speakers} | ${s.scored} | ${failed} | ${ci(s.wer)} | ${pct(s.verbatimWer)} | `
          + `${pct(s.severity.perfect / s.scored)} | ${pct(s.severity.meaningLost / s.scored)} | ${s.promptLeaks} | ${s.latencyMs.median} ms |`);
      }
    }
  }

  lines.push('', '## Paired comparisons (same speakers and clips; difference = second - first)', '',
    '| Comparison | Group | Speakers | WER difference [95% CI] |', '|---|---|---|---|');
  const addPaired = (name, group, rowsA, rowsB) => {
    const include = GROUPS[group];
    const d = pairedDifference(rowsA.filter(include), rowsB.filter(include));
    if (!d) return;
    analysis.paired.push({ comparison: name, group, ...d });
    lines.push(`| ${name} | ${group} | ${d.speakers} | ${ci(d)} |`);
  };
  const providers = Object.keys(runs[0].manifest.models);
  for (let i = 1; i < runs.length; i++) {
    for (const provider of providers) {
      for (const group of ['All', 'Control', 'All impaired']) {
        addPaired(`${provider}: ${runs[0].label} -> ${runs[i].label}`, group,
          runs[0].rows.filter(row => row.provider === provider), runs[i].rows.filter(row => row.provider === provider));
      }
    }
  }
  const last = runs.at(-1);
  if (['groq', 'openai'].every(provider => provider in last.manifest.models)) {
    for (const group of ['All', 'Control', 'All impaired']) {
      addPaired(`${last.label}: groq -> openai`, group,
        last.rows.filter(row => row.provider === 'groq'), last.rows.filter(row => row.provider === 'openai'));
    }
  }

  lines.push('', '## Error types, severity and speaker spread', '',
    '| Run | Provider | Group | Subs / Dels / Ins (share of errors) | Perfect / minor / major / lost clips | Speaker WER min / median / max | Failed | p90 latency |',
    '|---|---|---|---|---|---|---|---|');
  for (const s of analysis.summaries.filter(s => s.group !== 'All impaired')) {
    const t = s.errorTypes, v = s.severity, w = s.speakerWer;
    lines.push(`| ${s.run} | ${s.provider} | ${s.group} | ${pct(t.substitutions)} / ${pct(t.deletions)} / ${pct(t.insertions)} | `
      + `${v.perfect} / ${v.minor} / ${v.major} / ${v.meaningLost} | ${pct(w.min)} / ${pct(w.median)} / ${pct(w.max)} | `
      + `${JSON.stringify(s.failed)} | ${s.latencyMs.p90} ms |`);
  }

  const out = resolve(values.results, `analysis-${runs.map(run => run.label).join('-vs-')}`);
  await mkdir(out, { recursive: true });

  // Recording quality: split clips into thirds by original loudness, and correlate loudness with WER per recording.
  const loudness = await clipLoudness(runs[0].rows, resolve(values.data), resolve(out, 'clip-loudness.json'));
  const levels = Object.values(loudness).sort((a, b) => a - b);
  const cuts = [quantile(levels, 1 / 3), quantile(levels, 2 / 3)];
  const tierOf = row => {
    const db = loudness[`${row.transcript}|${row.clip}`];
    return db < cuts[0] ? 'Quietest third' : db < cuts[1] ? 'Middle third' : 'Loudest third';
  };
  analysis.loudness = { tierCutsDb: cuts, tiers: [], correlation: [] };
  lines.push('', `## WER by recording loudness (clip mean volume; thirds split at ${cuts[0].toFixed(1)} and ${cuts[1].toFixed(1)} dB)`, '',
    '| Run | Provider | Loudness | Clips scored | WER [95% CI] | Meaning lost |', '|---|---|---|---|---|---|');
  for (const run of runs) {
    for (const provider of Object.keys(run.manifest.models)) {
      for (const tier of ['Quietest third', 'Middle third', 'Loudest third']) {
        const s = summarize(run.rows.filter(row => row.provider === provider && tierOf(row) === tier));
        analysis.loudness.tiers.push({ run: run.label, provider, tier, ...s });
        lines.push(`| ${run.label} | ${provider} | ${tier} | ${s.scored} | ${ci(s.wer)} | ${pct(s.severity.meaningLost / s.scored)} |`);
      }
    }
  }
  lines.push('', '| Run | Provider | Spearman correlation, recording loudness vs recording WER (n recordings) |', '|---|---|---|');
  for (const run of runs) {
    for (const provider of Object.keys(run.manifest.models)) {
      const recordings = Object.values(Object.groupBy(run.rows.filter(row => row.provider === provider && row.status === 'ok'), row => row.transcript));
      const db = recordings.map(clips => clips.reduce((s, row) => s + loudness[`${row.transcript}|${row.clip}`], 0) / clips.length);
      const wer = recordings.map(clips => clips.reduce((s, row) => s + row.errors, 0) / clips.reduce((s, row) => s + row.referenceWords, 0));
      const rho = spearman(db, wer);
      analysis.loudness.correlation.push({ run: run.label, provider, recordings: recordings.length, spearman: rho });
      lines.push(`| ${run.label} | ${provider} | ${rho.toFixed(2)} (${recordings.length}) |`);
    }
  }

  await writeFile(resolve(out, 'analysis.json'), JSON.stringify(analysis, null, 2));
  await writeFile(resolve(out, 'analysis.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\nSaved to ${out}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
