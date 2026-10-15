import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { distribution, toCsv } from '../src/evaluation/latency.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2] || !process.argv[3]) throw new Error('Required: deployment-target.json NEW_OUTPUT_DIRECTORY (live synthetic benchmark)');
const identity = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
const out = resolve(process.argv[3]);
const api = identity.api;
const target = new URL(api);
if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Expected a public HTTPS API URL without credentials');
const origin = target.origin;
const fixtures = JSON.parse(await readFile(resolve(root, 'evaluation/audio/manifest.json'), 'utf8'));
await mkdir(dirname(out), { recursive: true });
await mkdir(out, { recursive: false });
const rows = [];
const sessions = [];
const configurations = [
  { avatarMode: 'female', lipSyncMode: 'rhubarb' },
  { avatarMode: 'male', lipSyncMode: 'rhubarb' },
];
const repeats = 3;
const plannedWarmups = repeats * configurations.length;
const plannedMeasurements = plannedWarmups * fixtures.fixtures.length;
const plannedTurns = plannedWarmups + plannedMeasurements;
const pipeline = await json('/sessions/pipeline');
async function json(path, body) {
  const response = await fetch(api + path, { method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}
let stoppedReason = null;
outer: for (let repeat = 0; repeat < repeats; repeat++) {
  // Counterbalance configuration order across fresh, isolated users/sessions.
  const ordered = repeat % 2 ? [...configurations].reverse() : configurations;
  for (const config of ordered) {
    const user = await json('/users', { name: 'Synthetic voice evaluation ' + randomUUID(), preferredName: 'Alex', role: 'patient',
      settings: { avatarMode: config.avatarMode, language: 'en' } });
    const session = await json('/sessions', { userId: user._id, title: 'Synthetic voice latency ' + new Date().toISOString(),
      scriptId: 'cst_intro_reminiscence', pipelineMode: 'openai-fast-scripted', evaluationSelection: 'off' });
    sessions.push({ userId: user._id, sessionId: session._id, repeat, ...config });
    for (let index = -1; index < fixtures.fixtures.length; index++) {
      const row = { repeat, sessionId: session._id, phase: index < 0 ? 'warmup' : 'measurement', inputIndex: index,
        startedAt: new Date().toISOString(), ...config, status: 'ok' };
      const start = performance.now();
      let turn;
      try {
        if (index < 0) turn = await json(`/sessions/${session._id}/respond`, { content: '', ...config });
        else {
          const fixture = fixtures.fixtures[index];
          const bytes = await readFile(resolve(root, 'evaluation/audio', fixture.file));
          if (createHash('sha256').update(bytes).digest('hex') !== fixture.sha256) throw new Error('Audio fixture hash mismatch');
          row.fixture = fixture.file; row.inputDurationSeconds = fixture.durationSeconds; row.expectedTranscript = fixture.text;
          const body = new FormData();
          body.append('audio', new Blob([bytes], { type: 'audio/wav' }), fixture.file);
          for (const [key, value] of Object.entries(config)) body.append(key, value);
          const response = await fetch(`${api}/sessions/${session._id}/respond-audio`, { method: 'POST', body, signal: AbortSignal.timeout(120000) });
          row.httpStatus = response.status;
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          turn = await response.json();
        }
        row.requestMs = performance.now() - start;
        if (!turn.assistantText?.trim()) throw new Error('No assistant response');
        row.transcript = turn.transcript ?? null;
        row.assistantText = turn.assistantText;
        row.pipelineMode = turn.pipelineMode;
        row.turnId = turn.turnId ?? null;
        row.audioStatus = turn.audioStatus ?? null;
        row.serverTimings = turn.timings ?? null;
        const segments = turn.avatar?.audio?.segments ?? (turn.avatar?.audio?.url ? [{ url: turn.avatar.audio.url, rhubarbJson: turn.avatar.lipsync?.rhubarbJson }] : []);
        row.audioSegments = segments.filter(s => s.url).length;
        row.lipSyncSegments = segments.filter(s => s.rhubarbJson?.mouthCues?.length).length;
        if (!row.audioSegments || row.audioStatus === 'error') throw new Error('Missing or failed synthesized audio');
        if (row.lipSyncSegments !== row.audioSegments) throw new Error('Missing Rhubarb mouth cues');
        row.audioDelivery = [];
        for (const segment of segments.filter(s => s.url)) {
          const url = new URL(segment.url, origin);
          if (url.origin !== origin) throw new Error('Unexpected audio origin');
          const audioStart = performance.now();
          const audio = await fetch(url, { signal: AbortSignal.timeout(30000) });
          if (!audio.ok) throw new Error(`Audio HTTP ${audio.status}`);
          const bytes = await audio.arrayBuffer();
          if (!bytes.byteLength) throw new Error('Empty audio delivery');
          row.audioDelivery.push({ bytes: bytes.byteLength, downloadMs: performance.now() - audioStart });
        }
      } catch (error) {
        row.status = 'error'; row.error = error.message;
        row.requestMs ??= performance.now() - start;
        stoppedReason = error.message;
      }
      rows.push(row);
      await appendFile(resolve(out, 'deployed-voice-rows.jsonl'), JSON.stringify(row) + '\n');
      console.log(`${rows.length}/${plannedTurns} ${row.phase} ${row.avatarMode}: ${row.status} ${Math.round(row.requestMs)}ms`);
      if (row.status === 'error') break outer;
      if (turn.sessionCompleteAfterResponse) { stoppedReason = 'Session completed before fixture sequence ended'; break outer; }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
const summary = configurations.map(config => {
  const own = rows.filter(r => r.phase === 'measurement' && r.avatarMode === config.avatarMode);
  const successful = own.filter(r => r.status === 'ok');
  return { ...config, attempts: own.length, successes: successful.length, failures: own.length - successful.length,
    requestLatency: distribution(successful.map(r => r.requestMs)),
    stages: Object.fromEntries(['sttMs', 'orchestratorMs', 'audioMs', 'ttsMs', 'rhubarbMs', 'totalMs'].map(key =>
      [key, distribution(successful.filter(r => Number.isFinite(r.serverTimings?.[key])).map(r => r.serverTimings[key]))])) };
});
const report = { scope: 'deployed-uploaded-audio-to-API-response-and-audio-delivery', startedAt: rows[0]?.startedAt,
  completedAt: new Date().toISOString(), api, pipeline, fixtures, sessions, plannedMeasurements, plannedWarmups,
  complete: rows.length === plannedTurns && !stoppedReason, stoppedReason, summary, rows,
  caveats: ['No browser playing-event or acoustic/lip-frame onset measurement.', 'Uploaded synthetic speech excludes microphone recording and finalisation.',
    'Fresh synthetic users and sessions; each fixed fixture advances conversation state.', 'Service cache/prefetch effects are retained, not disabled.',
    'Accumulated TTS/Rhubarb service durations may overlap and must not be summed as wall time.', 'Only three repetitions per configuration; descriptive pilot, not a comprehensive latency study.',
    'Deployed build revision not verified; pipeline response and turn compatibility fields retained.'] };
await writeFile(resolve(out, 'deployed-summary.json'), JSON.stringify(report, null, 2));
await writeFile(resolve(out, 'deployed-voice-samples.csv'), toCsv(rows.map(r => ({ ...r, ...r.serverTimings })),
  ['repeat', 'sessionId', 'phase', 'fixture', 'inputDurationSeconds', 'avatarMode', 'lipSyncMode', 'status', 'requestMs', 'sttMs', 'orchestratorMs', 'audioMs', 'ttsMs', 'rhubarbMs', 'totalMs', 'audioStatus', 'audioSegments', 'lipSyncSegments', 'error']));
console.log(JSON.stringify(summary, null, 2));
if (stoppedReason) process.exitCode = 1;
