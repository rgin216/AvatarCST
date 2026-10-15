import { readFile, readdir, mkdir, writeFile, appendFile, rm, mkdtemp } from 'node:fs/promises';
import { resolve, dirname, basename, extname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import dotenv from 'dotenv';
import ffmpegPath from 'ffmpeg-static';
import { parseCha, cleanChatUtterance, normalizeWords, wordErrorRate, summarizeWer } from '../src/evaluation/wer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg']);
// The English instruction prompt sttService sent before it was removed, for --prompt legacy baselines.
const LEGACY_PROMPT = 'The speaker is speaking English, possibly with a strong accent. Transcribe the speech in English using Latin letters. Do not translate it into another language. Do not invent words for silence or unclear audio.';
const SAMPLE_COLUMNS = ['provider', 'model', 'group', 'transcript', 'clip', 'startMs', 'endMs', 'status', 'latencyMs',
  'referenceWords', 'errors', 'substitutions', 'deletions', 'insertions', 'wer', 'verbatimReferenceWords', 'verbatimErrors',
  'verbatimWer', 'reference', 'hypothesis', 'error'];
const SUMMARY_COLUMNS = ['key', 'clips', 'referenceWords', 'errors', 'substitutions', 'deletions', 'insertions', 'wer',
  'verbatimReferenceWords', 'verbatimErrors', 'verbatimWer', 'medianLatencyMs'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

// Falls back to the folder name (Pitt uses Control/ and Dementia/) when @ID has no group.
function groupFor(ids, speaker, chaPath) {
  if (ids[speaker]?.group) return ids[speaker].group;
  const folder = chaPath.split(/[\\/]/).find(part => /^(control|dementia)$/i.test(part));
  return folder ?? 'unknown';
}

const sleep = ms => new Promise(done => setTimeout(done, ms));
const execFileAsync = promisify(execFile);

try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean', default: false },
    data: { type: 'string', default: resolve(root, 'evaluation/dementiabank') },
    providers: { type: 'string', default: 'groq' },
    speaker: { type: 'string', default: 'PAR' },
    'min-ms': { type: 'string', default: '800' },
    'max-ms': { type: 'string', default: '25000' },
    'min-words': { type: 'string', default: '1' },
    'delay-ms': { type: 'string', default: '3000' },
    prompt: { type: 'string' },
    normalize: { type: 'boolean', default: false },
    limit: { type: 'string' },
    out: { type: 'string', default: resolve(root, 'evaluation/results') },
    label: { type: 'string', default: '' },
  } });
  dotenv.config({ path: resolve(root, '.env'), quiet: true });

  const providers = values.providers.split(',').map(p => p.trim()).filter(Boolean);
  for (const provider of providers) {
    if (!['groq', 'openai'].includes(provider)) throw new Error(`Unknown provider "${provider}" (use groq and/or openai)`);
  }
  const minMs = Number(values['min-ms']), maxMs = Number(values['max-ms']), minWords = Number(values['min-words']);
  const delayMs = Number(values['delay-ms']);
  const dataDir = resolve(values.data);
  // Omitted: the app's current behaviour. "legacy": the removed instruction prompt. Anything else is sent as-is.
  const prompt = values.prompt === 'legacy' ? LEGACY_PROMPT : values.prompt;

  const files = await walk(dataDir).catch(() => {
    throw new Error(`No data folder at ${dataDir}. Put the DementiaBank .cha transcripts and audio there, or pass --data <folder>.`);
  });
  const audioFiles = files.filter(f => AUDIO_EXTENSIONS.has(extname(f).toLowerCase()));
  // Audio must sit next to its transcript: Pitt reuses names like 001-0 across groups and tasks.
  const audioByPath = new Map(audioFiles.map(f => [join(dirname(f), basename(f, extname(f))).toLowerCase(), f]));
  const chaFiles = files.filter(f => extname(f).toLowerCase() === '.cha');

  const clips = [];
  const skipped = { noAudio: 0, noTimestamp: 0, tooShort: 0, tooLong: 0, tooFewWords: 0 };
  for (const chaPath of chaFiles) {
    const name = basename(chaPath, '.cha');
    const audioPath = audioByPath.get(join(dirname(chaPath), name).toLowerCase());
    const { ids, utterances } = parseCha(await readFile(chaPath, 'utf8'));
    for (const [index, utterance] of utterances.entries()) {
      if (utterance.speaker !== values.speaker) continue;
      if (!audioPath) { skipped.noAudio++; continue; }
      if (utterance.startMs === null) { skipped.noTimestamp++; continue; }
      const durationMs = utterance.endMs - utterance.startMs;
      if (durationMs < minMs) { skipped.tooShort++; continue; }
      if (durationMs > maxMs) { skipped.tooLong++; continue; }
      const reference = cleanChatUtterance(utterance.raw);
      if (normalizeWords(reference).length < minWords) { skipped.tooFewWords++; continue; }
      clips.push({
        transcript: relative(dataDir, chaPath), clip: index, audioPath, group: groupFor(ids, values.speaker, chaPath),
        startMs: utterance.startMs, endMs: utterance.endMs, reference,
        verbatimReference: cleanChatUtterance(utterance.raw, { mode: 'verbatim' }),
      });
    }
  }
  // Round-robin across groups, and across recordings within a group, so a --limit sample
  // covers many speakers instead of the first recording of the first group.
  const roundRobin = lists => {
    const out = [];
    for (let i = 0; lists.some(list => i < list.length); i++) for (const list of lists) if (i < list.length) out.push(list[i]);
    return out;
  };
  const interleaved = roundRobin(Object.values(Object.groupBy(clips, clip => clip.group))
    .map(groupClips => roundRobin(Object.values(Object.groupBy(groupClips, clip => clip.transcript)))));
  const selected = values.limit === undefined ? interleaved : interleaved.slice(0, Number(values.limit));
  const groups = {};
  for (const clip of selected) groups[clip.group] = (groups[clip.group] ?? 0) + 1;
  const recordingsByGroup = Object.fromEntries(Object.entries(Object.groupBy(selected, clip => clip.group))
    .map(([group, groupClips]) => [group, new Set(groupClips.map(clip => clip.transcript)).size]));

  console.log(JSON.stringify({
    mode: values.live ? 'live' : 'dry-run', dataDir, providers, speaker: values.speaker,
    prompt: values.prompt ?? 'app default', normalize: values.normalize,
    transcripts: chaFiles.length, audioFiles: audioFiles.length, clips: selected.length, clipsByGroup: groups,
    recordingsByGroup, skipped,
    requests: selected.length * providers.length, delayMs,
    note: 'Live runs upload participant audio clips to the selected STT providers and incur API usage.',
  }, null, 2));

  if (values.live && selected.length) {
    const { transcribeAudio } = await import('../src/services/sttService.js');
    const { toCsv } = await import('../src/evaluation/latency.js');
    const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-stt-' + randomUUID().slice(0, 8);
    const out = resolve(values.out, runId);
    await mkdir(out, { recursive: true });
    const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
    const models = {
      groq: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo',
      openai: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    };
    const manifest = { schemaVersion: 1, runId, scope: 'stt-wer', label: values.label, startedAt: new Date().toISOString(),
      revision: git(['rev-parse', 'HEAD']), workingTreeStatus: git(['status', '--short']),
      providers, models: Object.fromEntries(providers.map(p => [p, models[p]])), speaker: values.speaker,
      prompt: prompt ?? null, normalize: values.normalize,
      minMs, maxMs, minWords, delayMs, clips: selected.length, clipsByGroup: groups, recordingsByGroup, skipped,
      scoring: 'Corpus WER = (S + D + I) / reference words. "wer" references keep spoken repeats and self-corrections but drop fillers (uh, um) and word fragments; "verbatimWer" also keeps fillers and fragments, on both sides. Both expand contractions and casual spellings (gonna, outta) before scoring.',
    };
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Saving results to ' + out);

    const clipDir = await mkdtemp(join(tmpdir(), 'avatarcst-stt-'));
    const rows = [];
    try {
      for (const [n, clip] of selected.entries()) {
        const clipPath = join(clipDir, 'clip.wav');
        await execFileAsync(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(clip.startMs / 1000),
          '-t', String((clip.endMs - clip.startMs) / 1000), '-i', clip.audioPath,
          // Archival tapes are far quieter than a browser mic with auto gain; loudnorm brings speech to a typical level.
          ...(values.normalize ? ['-af', 'loudnorm=I=-20:TP=-2'] : []), '-ac', '1', '-ar', '16000', clipPath]);
        for (const provider of providers) {
          const row = { provider, model: models[provider], group: clip.group, transcript: clip.transcript, clip: clip.clip,
            startMs: clip.startMs, endMs: clip.endMs, reference: clip.reference };
          const started = performance.now();
          try {
            const hypothesis = await transcribeAudio(clipPath, 'clip.wav', { provider, prompt });
            row.latencyMs = Math.round(performance.now() - started);
            const clean = wordErrorRate(normalizeWords(clip.reference), normalizeWords(hypothesis));
            const verbatim = wordErrorRate(normalizeWords(clip.verbatimReference, { dropFillers: false }),
              normalizeWords(hypothesis, { dropFillers: false }));
            Object.assign(row, { status: 'ok', hypothesis, ...clean, verbatimReferenceWords: verbatim.referenceWords,
              verbatimErrors: verbatim.errors, verbatimWer: verbatim.wer });
          } catch (error) {
            Object.assign(row, { status: 'error', latencyMs: Math.round(performance.now() - started), error: error.message });
          }
          rows.push(row);
          await appendFile(resolve(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
          console.log(`[${n + 1}/${selected.length}] ${provider} ${clip.transcript}#${clip.clip}: `
            + (row.status === 'ok' ? `WER ${(row.wer * 100).toFixed(1)}%` : row.error));
          if (delayMs) await sleep(delayMs);
        }
      }
    } finally {
      await rm(clipDir, { recursive: true, force: true });
    }

    const summary = [
      ...summarizeWer(rows, row => row.provider),
      ...summarizeWer(rows, row => `${row.provider} / ${row.group}`),
    ];
    await writeFile(resolve(out, 'samples.csv'), toCsv(rows, SAMPLE_COLUMNS));
    await writeFile(resolve(out, 'summary.csv'), toCsv(summary, SUMMARY_COLUMNS));
    await writeFile(resolve(out, 'report.json'), JSON.stringify({ summary }, null, 2));
    manifest.completedAt = new Date().toISOString();
    manifest.status = rows.some(row => row.status === 'error') ? 'completed_with_errors' : 'completed';
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.table(summary.map(s => ({ key: s.key, clips: s.clips, wer: s.wer?.toFixed(3), verbatimWer: s.verbatimWer?.toFixed(3),
      medianLatencyMs: s.medianLatencyMs })));
    if (manifest.status === 'completed_with_errors') process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
