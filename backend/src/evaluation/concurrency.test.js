import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCriteria, estimateSpeechMs, highestPassingLevel, nextContent, parseLevels, parseRange, runStage, runVirtualUser,
  summarizeStage, validateConcurrencyPlan,
} from './concurrency.js';
import { recordLlmFallback, trackLlmFallbacks, withSessionLlm } from '../services/llmContext.js';

const apiUrl = 'http://localhost:5000/api';
const user = { userId: 'user-1' };
const inputs = { welcome: ['I feel fine.'], song: ['Moon River.', 'The first one.'] };
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

// Serves session creation, a scripted list of turns, and audio downloads, recording every request.
function fakeServer(turns) {
  const requests = [];
  let turnIndex = 0;
  const fetchImpl = async (url, options = {}) => {
    const path = String(url);
    requests.push({ path, body: options.body ? JSON.parse(options.body) : null });
    if (path.endsWith('/sessions')) return json(201, { _id: 'session-1' });
    if (path.endsWith('/respond')) {
      const next = turns[turnIndex++];
      return typeof next === 'number' ? json(next, { error: 'failed' }) : json(201, next);
    }
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(10) };
  };
  return { fetchImpl, requests, posted: () => requests.filter(r => r.path.endsWith('/respond')).map(r => r.body.content) };
}

const turn = (extra = {}) => ({ assistantText: 'Hello there', timings: { totalMs: 40, llmFallbacks: 0 },
  avatar: { audio: { segments: [{ url: '/generated-audio/a.mp3' }, { url: '/generated-audio/b.mp3' }] } }, ...extra });

test('virtual user answers per slide and completes media slides like the browser', async () => {
  const slide = id => ({ slide: { id } });
  // The song question needs a follow-up, then a media slide, then a slide with no prepared replies.
  const server = fakeServer([turn(slide('welcome')), turn(slide('song')), turn(slide('song')),
    turn({ slide: { id: 'play', interaction: { type: 'spotifySong' } } }), turn(slide('other')),
    turn({ sessionCompleteAfterResponse: true })]);
  const rows = [];
  const pauses = [];
  const outcome = await runVirtualUser({ apiUrl: apiUrl + '/', user, vu: 0, stage: 1, inputs, think: { min: 100, max: 100 },
    listen: false, fetchImpl: server.fetchImpl, sleep: async ms => { pauses.push(ms); }, onRow: async row => { rows.push(row); } });

  assert.deepEqual(server.posted(), ['', 'I feel fine.', 'Moon River.', 'The first one.', '[[music-complete]]', "I'm happy to keep going."]);
  assert.equal(outcome.outcome, 'completed');
  assert.deepEqual(rows.map(r => r.kind), ['create-session', 'turn', 'turn', 'turn', 'turn', 'turn', 'turn']);
  assert.deepEqual(rows.filter(r => r.kind === 'turn').map(r => r.contentKind), ['opening', 'reply', 'reply', 'reply', 'control', 'reply']);
  assert.equal(rows[1].audioSegments, 2);
  assert.equal(rows[1].audioBytes, 20);
  assert.ok(server.requests.some(r => r.path === 'http://localhost:5000/generated-audio/a.mp3'));
  assert.deepEqual(pauses, [100, 100, 100, 100, 100]);
  assert.equal(server.requests[0].body.scriptId, 'cst_intro_reminiscence');
});

test('virtual user never sends another turn after a failed one', async () => {
  const server = fakeServer([turn(), 503, turn()]);
  const rows = [];
  const outcome = await runVirtualUser({ apiUrl, user, vu: 0, stage: 1, inputs, listen: false, downloadAudio: false,
    fetchImpl: server.fetchImpl, sleep: async () => {}, onRow: async row => { rows.push(row); } });
  assert.equal(outcome.outcome, 'error');
  assert.equal(server.posted().length, 2);
  assert.equal(rows.at(-1).httpStatus, 503);
  assert.equal(rows.at(-1).errorCategory, 'http');
});

test('virtual user gives up when one slide keeps repeating', async () => {
  const server = fakeServer(Array.from({ length: 10 }, () => turn({ slide: { id: 'song' } })));
  const outcome = await runVirtualUser({ apiUrl, user, vu: 0, stage: 1, inputs, maxTurnsPerSlide: 3, listen: false,
    downloadAudio: false, fetchImpl: server.fetchImpl, sleep: async () => {} });
  assert.deepEqual([outcome.outcome, outcome.turns, outcome.slideId], ['stuck', 4, 'song']);
});

test('virtual user stops at the turn cap and waits for estimated speech before thinking', async () => {
  const server = fakeServer([turn(), turn(), turn()]);
  const pauses = [];
  const outcome = await runVirtualUser({ apiUrl, user, vu: 0, stage: 1, inputs, maxTurns: 2, downloadAudio: false,
    think: { min: 0, max: 0 }, fetchImpl: server.fetchImpl, sleep: async ms => { pauses.push(ms); } });
  assert.equal(outcome.outcome, 'max-turns');
  assert.deepEqual(pauses, [estimateSpeechMs('Hello there'), estimateSpeechMs('Hello there')]);
  assert.equal(estimateSpeechMs('one two three four five'), 2000);
});

test('stage runs every user concurrently, staggers starts and tracks peak in-flight requests', async () => {
  const sleeps = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let waiting = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/sessions')) {
      // Hold every session creation open until all three are in flight.
      if (++waiting === 3) release();
      await gate;
      return json(201, { _id: 'session' });
    }
    return json(201, turn({ sessionCompleteAfterResponse: true }));
  };
  const result = await runStage({ apiUrl, users: [user, user, user], stage: 3, rampMs: 1000, inputs, downloadAudio: false,
    fetchImpl, sleep: async ms => { sleeps.push(ms); } });
  assert.deepEqual(result.outcomes.map(o => o.outcome), ['completed', 'completed', 'completed']);
  assert.deepEqual(sleeps, [500, 1000]);
  assert.equal(result.peakInFlight, 3);
});

test('stage summary separates failures, degraded turns and missing audio', () => {
  const ok = (requestMs, extra = {}) => ({ kind: 'turn', status: 'ok', httpStatus: 201, requestMs, inFlightAtStart: 1,
    audioSegments: 1, serverTimings: { totalMs: requestMs - 10, llmFallbacks: 0, speechCacheHits: 1 }, ...extra });
  const rows = [
    { kind: 'create-session', status: 'ok', httpStatus: 201, requestMs: 5, inFlightAtStart: 1 },
    ok(100), ok(200, { serverTimings: { totalMs: 190, llmFallbacks: 2 } }), ok(300, { audioSegments: 0 }),
    { kind: 'turn', status: 'error', httpStatus: 500, errorCategory: 'http', requestMs: 50, inFlightAtStart: 3 },
    { kind: 'turn', status: 'error', errorCategory: 'timeout', requestMs: 120000, inFlightAtStart: 3 },
  ];
  const summary = summarizeStage({ concurrency: 2, rows, wallMs: 60000, peakInFlight: 3,
    outcomes: [{ outcome: 'completed' }, { outcome: 'error' }, { outcome: 'stuck', slideId: 'song' }] });
  assert.equal(summary.turnsAttempted, 5);
  assert.equal(summary.errorRate, 2 / 5);
  assert.equal(summary.timeouts, 1);
  assert.deepEqual(summary.httpStatus, { 201: 4, 500: 1 });
  assert.equal(summary.degradedTurns, 1);
  assert.equal(summary.missingAudio, 1);
  assert.equal(summary.throughputTurnsPerMin, 3);
  assert.equal(summary.requestLatency.n, 3);
  assert.equal(summary.speechCacheHits, 2);
  assert.equal(summary.completedUsers, 1);
  assert.equal(summary.failedUsers, 1);
  assert.deepEqual(summary.stuckSlides, ['song']);

  const legacy = summarizeStage({ concurrency: 1, rows: [ok(100, { serverTimings: { totalMs: 90 } })], wallMs: 1000,
    peakInFlight: 1, outcomes: [{ outcome: 'completed' }] });
  assert.equal(legacy.degradedTurns, null);
});

test('criteria fail on empty stages, and the passing level stops at the first failure', () => {
  const stage = (concurrency, p95Ms, errorRate) => ({ concurrency, errorRate, degradedRate: 0, requestLatency: { p95Ms } });
  assert.equal(checkCriteria(stage(1, null, null), { p95Ms: 5000 }).passed, false);
  assert.equal(checkCriteria(stage(1, 4000, 0), { p95Ms: 5000, maxErrorRate: 0.01 }).passed, true);
  assert.equal(checkCriteria(stage(1, 6000, 0), {}).checked, false);
  const stages = [[1, 3000], [2, 4000], [4, 9000], [8, 4000]].map(([c, p]) => {
    const s = stage(c, p, 0); return { ...s, criteria: checkCriteria(s, { p95Ms: 5000 }) };
  });
  assert.equal(highestPassingLevel(stages), 2);
});

test('parsers and plan validation reject unsafe input', () => {
  assert.deepEqual(parseLevels('4, 1,2,2'), [1, 2, 4]);
  assert.deepEqual(parseRange('2000-6000'), { min: 2000, max: 6000 });
  assert.deepEqual(parseRange('0'), { min: 0, max: 0 });
  for (const bad of ['0', '1,x', '201']) assert.throws(() => parseLevels(bad));
  for (const bad of ['6000-2000', 'abc', '-5']) assert.throws(() => parseRange(bad));
  const plan = { apiUrl, levels: [1], inputs, maxTurns: 40, timeoutMs: 120000, rampMs: 0, cooldownMs: 0, stopErrorRate: 0.5 };
  assert.doesNotThrow(() => validateConcurrencyPlan(plan));
  for (const invalid of [{ apiUrl: 'file:///tmp' }, { apiUrl: 'https://u:p@example.com/api' }, { inputs: {} },
    { inputs: ['positional'] }, { inputs: { welcome: [] } },
    { maxTurns: 0 }, { stopErrorRate: 0 }]) {
    assert.throws(() => validateConcurrencyPlan({ ...plan, ...invalid }));
  }
  assert.deepEqual(nextContent({ slide: { interaction: { type: 'autoAdvance' } } }, inputs, {}),
    { content: '[[auto-advance]]', contentKind: 'control' });
});

test('fallback tracking counts per request, including inside evaluated sessions', async () => {
  const counter = { count: 0 };
  const calls = [];
  await trackLlmFallbacks(counter, async () => {
    recordLlmFallback('plain');
    await withSessionLlm({ provider: 'x', model: 'y' }, calls, async () => { recordLlmFallback('evaluated'); });
  });
  recordLlmFallback('outside any request');
  assert.equal(counter.count, 2);
  assert.deepEqual(calls, [{ kind: 'fallback', reason: 'evaluated' }]);
});
