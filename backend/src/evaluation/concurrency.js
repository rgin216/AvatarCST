import { distribution } from './latency.js';

export const LOAD_TEST_SCRIPT_ID = 'cst_intro_reminiscence';
export const MAX_LEVEL = 200;
// Real users have different names, and Session 1 speaks the name, so name lines are not all one cached TTS entry.
const NAMES = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Robin', 'Avery', 'Quinn', 'Rowan',
  'Margaret', 'Peter', 'Helen', 'George', 'Ruth', 'Frank', 'Joan', 'Arthur', 'Mary', 'Walter', 'Betty', 'Harold', 'Dorothy',
  'Ernest', 'Irene', 'Stanley', 'Edith', 'Leonard', 'Agnes', 'Raymond', 'Shirley', 'Norman', 'Gloria', 'Douglas', 'Maureen',
  'Kevin', 'Brenda', 'Colin', 'Pauline', 'Graham', 'Janet', 'Trevor', 'Lorraine', 'Malcolm', 'Wendy', 'Keith', 'Sandra', 'Neil'];
// Slide interactions the browser completes on the patient's behalf, with the event it posts.
const CONTROL_EVENTS = { autoAdvance: '[[auto-advance]]', spotifySong: '[[music-complete]]', youtubeShort: '[[video-complete]]' };
const FALLBACK_REPLY = "I'm happy to keep going.";
// A follow-up or retry can keep one slide open for a few turns; beyond this the virtual user is stuck.
export const MAX_TURNS_PER_SLIDE = 6;
const SPEECH_WORDS_PER_SECOND = 2.5;

export const nameForUser = index => NAMES[index % NAMES.length];

export function parseLevels(text) {
  const levels = String(text).split(',').map(part => Number(part.trim()));
  if (!levels.length || levels.some(level => !Number.isInteger(level) || level < 1 || level > MAX_LEVEL)) {
    throw new Error(`Levels must be comma-separated integers 1–${MAX_LEVEL}`);
  }
  return [...new Set(levels)].sort((a, b) => a - b);
}

export function parseRange(text) {
  const match = /^(\d+)(?:-(\d+))?$/u.exec(String(text).trim());
  if (!match) throw new Error('Ranges must look like 2000-6000 or 0');
  const min = Number(match[1]), max = Number(match[2] ?? match[1]);
  if (max < min || max > 600000) throw new Error('Range maximum must be ≥ minimum and ≤ 600000');
  return { min, max };
}

export function validateConcurrencyPlan({ apiUrl, levels, inputs, maxTurns, timeoutMs, rampMs, cooldownMs, stopErrorRate }) {
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) API base URL without credentials, query or fragment');
  if (!Array.isArray(levels) || !levels.length) throw new Error('At least one concurrency level is required');
  const lists = inputs && typeof inputs === 'object' && !Array.isArray(inputs) ? Object.values(inputs) : [];
  if (!lists.length || lists.some(list => !Array.isArray(list) || !list.length || list.some(input => typeof input !== 'string' || !input.trim()))) {
    throw new Error('Inputs must be a JSON object mapping slide IDs to nonempty arrays of synthetic response strings');
  }
  for (const [name, value, min, max] of [['maxTurns', maxTurns, 1, 200], ['timeoutMs', timeoutMs, 1000, 300000],
    ['rampMs', rampMs, 0, 600000], ['cooldownMs', cooldownMs, 0, 600000]]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}–${max}`);
  }
  if (!(stopErrorRate > 0 && stopErrorRate <= 1)) throw new Error('stopErrorRate must be in (0, 1]');
}

// Mirrors the browser: complete media/auto slides with their event, otherwise send the next reply for the
// slide now showing. Keying by slide keeps a retried or follow-up question from shifting later answers.
export function nextContent(turn, inputs, repliesBySlide) {
  const event = CONTROL_EVENTS[turn?.slide?.interaction?.type];
  if (event) return { content: event, contentKind: 'control' };
  const slideId = turn?.slide?.id;
  const count = repliesBySlide[slideId] || 0;
  repliesBySlide[slideId] = count + 1;
  return { content: inputs[slideId]?.[count] ?? FALLBACK_REPLY, contentKind: 'reply' };
}

export const estimateSpeechMs = text =>
  Math.round((String(text || '').trim().split(/\s+/u).filter(Boolean).length / SPEECH_WORDS_PER_SECOND) * 1000);

const segmentUrls = turn => (Array.isArray(turn?.avatar?.audio?.segments)
  ? turn.avatar.audio.segments.map(segment => segment?.url).filter(Boolean)
  : [turn?.avatar?.audio?.url].filter(Boolean));

async function postJson(fetchImpl, url, body, timeoutMs) {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => null);
  return { response, data };
}

const errorCategory = error => (error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout'
  : error?.httpStatus ? 'http' : error?.invalid ? 'invalid-response' : 'network');

const trimSlash = url => url.replace(/\/$/u, '');

export async function registerLoadTestUser({ apiUrl, username, name, password, fetchImpl = fetch, timeoutMs = 120000 }) {
  const { response, data } = await postJson(fetchImpl, `${trimSlash(apiUrl)}/users/register`, { username, name, password }, timeoutMs);
  if (!response.ok || !data?.user?._id) throw new Error(`Registering ${username} failed with HTTP ${response.status}`);
  return { userId: data.user._id, username, name };
}

export async function runVirtualUser({ apiUrl, user, vu, stage, inputs, maxTurns = 40, maxTurnsPerSlide = MAX_TURNS_PER_SLIDE, timeoutMs = 120000,
  think = { min: 0, max: 0 }, listen = true, downloadAudio = true, avatarMode = 'male', lipSyncMode = 'rhubarb',
  pipelineMode, fetchImpl = fetch, now = () => performance.now(), sleep = ms => new Promise(r => setTimeout(r, ms)),
  random = Math.random, stageStart = now(), inFlight = { current: 0, peak: 0 }, onRow = async () => {} }) {
  const origin = new URL(apiUrl).origin;
  apiUrl = trimSlash(apiUrl);
  const base = { stage, vu, userId: user.userId };
  let sequence = 0;
  const timed = async (row, operation) => {
    row.startedAt = new Date().toISOString(); row.startOffsetMs = now() - stageStart;
    row.inFlightAtStart = ++inFlight.current; inFlight.peak = Math.max(inFlight.peak, inFlight.current);
    const start = now();
    try { return await operation(); }
    catch (error) { row.status = 'error'; row.errorCategory = errorCategory(error); row.error = error.message; return null; }
    finally { row.requestMs = now() - start; inFlight.current -= 1; }
  };

  const createRow = { ...base, kind: 'create-session', sequence: sequence++, status: 'ok' };
  const session = await timed(createRow, async () => {
    const { response, data } = await postJson(fetchImpl, `${apiUrl}/sessions`, { userId: user.userId,
      title: 'Load test', scriptId: LOAD_TEST_SCRIPT_ID, ...(pipelineMode && { pipelineMode }) }, timeoutMs);
    createRow.httpStatus = response.status;
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { httpStatus: response.status });
    if (!data?._id) throw Object.assign(new Error('Invalid session response'), { invalid: true });
    return data;
  });
  await onRow(createRow);
  if (!session) return { vu, outcome: 'error', turns: 0 };

  let next = { content: '', contentKind: 'opening' };
  const repliesBySlide = {};
  let slideRun = { slideId: undefined, turns: 0 };
  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex++) {
    const row = { ...base, kind: 'turn', sessionId: session._id, sequence: sequence++, turnIndex,
      contentKind: next.contentKind, status: 'ok' };
    const turn = await timed(row, async () => {
      const { response, data } = await postJson(fetchImpl, `${apiUrl}/sessions/${session._id}/respond`,
        { content: next.content, avatarMode, lipSyncMode }, timeoutMs);
      row.httpStatus = response.status;
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { httpStatus: response.status });
      if (typeof data?.assistantText !== 'string' || !data.assistantText.trim()) throw Object.assign(new Error('Invalid turn response'), { invalid: true });
      return data;
    });
    if (turn) {
      Object.assign(row, { turnId: turn.turnId || null, pipelineMode: turn.pipelineMode || null, slideId: turn.slide?.id || null,
        serverTimings: turn.timings || null, audioStatus: turn.audioStatus || null });
      const urls = segmentUrls(turn);
      row.audioSegments = urls.length;
      if (downloadAudio && urls.length) {
        const start = now();
        try {
          const sizes = await Promise.all(urls.map(async url => {
            const response = await fetchImpl(new URL(url, origin), { signal: AbortSignal.timeout(timeoutMs) });
            if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
            return (await response.arrayBuffer()).byteLength;
          }));
          row.audioBytes = sizes.reduce((a, b) => a + b, 0);
        } catch (error) { row.audioFetchError = error.message; }
        finally { row.audioFetchMs = now() - start; }
      }
    }
    await onRow(row);
    // A timed-out write may still be executing, so never send another turn to that session.
    if (!turn) return { vu, outcome: 'error', turns: turnIndex + 1, sessionId: session._id };
    if (turn.sessionCompleteAfterResponse || turn.sessionStatus === 'completed') {
      return { vu, outcome: 'completed', turns: turnIndex + 1, sessionId: session._id };
    }
    const slideId = turn.slide?.id;
    slideRun = slideRun.slideId === slideId ? { slideId, turns: slideRun.turns + 1 } : { slideId, turns: 1 };
    if (slideRun.turns > maxTurnsPerSlide) return { vu, outcome: 'stuck', turns: turnIndex + 1, sessionId: session._id, slideId };
    next = nextContent(turn, inputs, repliesBySlide);
    const pause = (listen ? estimateSpeechMs(turn.assistantText) : 0) + think.min + Math.round(random() * (think.max - think.min));
    if (pause) await sleep(pause);
  }
  return { vu, outcome: 'max-turns', turns: maxTurns, sessionId: session._id };
}

// Starts `users.length` virtual users spread evenly across rampMs and waits for every one to finish.
export async function runStage({ users, stage, rampMs = 0, now = () => performance.now(),
  sleep = ms => new Promise(r => setTimeout(r, ms)), ...options }) {
  const stageStart = now();
  const inFlight = { current: 0, peak: 0 };
  const gap = users.length > 1 ? rampMs / (users.length - 1) : 0;
  const outcomes = await Promise.all(users.map(async (user, vu) => {
    if (vu && gap) await sleep(Math.round(vu * gap));
    return runVirtualUser({ ...options, user, vu, stage, now, sleep, stageStart, inFlight });
  }));
  return { outcomes, wallMs: now() - stageStart, peakInFlight: inFlight.peak };
}

const finite = values => values.filter(Number.isFinite);
const timingDistribution = (rows, key) => distribution(finite(rows.map(row => row.serverTimings?.[key])));

export function summarizeStage({ concurrency, rows, outcomes, wallMs, peakInFlight }) {
  const turns = rows.filter(row => row.kind === 'turn');
  const ok = turns.filter(row => row.status === 'ok');
  const failed = turns.filter(row => row.status === 'error');
  const degraded = ok.filter(row => row.serverTimings?.llmFallbacks > 0);
  const httpStatus = {};
  for (const row of rows) if (row.httpStatus) httpStatus[row.httpStatus] = (httpStatus[row.httpStatus] || 0) + 1;
  const count = outcome => outcomes.filter(o => o.outcome === outcome).length;
  const reportsFallbacks = ok.some(row => Number.isFinite(row.serverTimings?.llmFallbacks));
  return {
    concurrency, users: outcomes.length, completedUsers: count('completed'), failedUsers: count('error'),
    stuckUsers: count('stuck'), stuckSlides: outcomes.filter(o => o.outcome === 'stuck').map(o => o.slideId), maxTurnUsers: count('max-turns'),
    wallMs, peakInFlight,
    meanInFlightAtStart: turns.length ? turns.reduce((sum, row) => sum + row.inFlightAtStart, 0) / turns.length : null,
    turnsAttempted: turns.length, turnsOk: ok.length, turnsFailed: failed.length,
    errorRate: turns.length ? failed.length / turns.length : null,
    timeouts: failed.filter(row => row.errorCategory === 'timeout').length,
    httpStatus,
    // Null when the server predates fallback reporting, so absence is not mistaken for zero.
    degradedTurns: reportsFallbacks ? degraded.length : null,
    degradedRate: reportsFallbacks && ok.length ? degraded.length / ok.length : null,
    missingAudio: ok.filter(row => !row.audioSegments || row.audioStatus === 'error').length,
    audioFetchFailures: ok.filter(row => row.audioFetchError).length,
    speechCacheHits: ok.reduce((sum, row) => sum + (row.serverTimings?.speechCacheHits || 0), 0),
    throughputTurnsPerMin: wallMs > 0 ? ok.length / (wallMs / 60000) : null,
    createSessionLatency: distribution(rows.filter(r => r.kind === 'create-session' && r.status === 'ok').map(r => r.requestMs)),
    requestLatency: distribution(ok.map(row => row.requestMs)),
    serverTotal: timingDistribution(ok, 'totalMs'),
    orchestrator: timingDistribution(ok, 'orchestratorMs'),
    audioWait: timingDistribution(ok, 'audioMs'),
    audioDownload: distribution(finite(ok.filter(row => !row.audioFetchError).map(row => row.audioFetchMs))),
  };
}

// Pass/fail against criteria the experimenter states up front; unset criteria are not checked.
export function checkCriteria(summary, { p95Ms, maxErrorRate, maxDegradedRate } = {}) {
  const failures = [];
  // A stage with no successful turns or no turns at all fails rather than passing on null comparisons.
  const p95 = summary.requestLatency.p95Ms;
  if (Number.isFinite(p95Ms) && (p95 === null || p95 > p95Ms)) failures.push(p95 === null ? 'no successful turns' : `p95 ${Math.round(p95)} ms > ${p95Ms} ms`);
  if (Number.isFinite(maxErrorRate) && (summary.errorRate === null || summary.errorRate > maxErrorRate)) failures.push(`error rate ${summary.errorRate} > ${maxErrorRate}`);
  if (Number.isFinite(maxDegradedRate) && summary.degradedRate !== null && summary.degradedRate > maxDegradedRate) failures.push(`degraded rate ${summary.degradedRate} > ${maxDegradedRate}`);
  return { checked: [p95Ms, maxErrorRate, maxDegradedRate].some(Number.isFinite), passed: !failures.length, failures };
}

// Highest level such that it and every lower measured level passed the stated criteria.
export function highestPassingLevel(stages) {
  let highest = null;
  for (const stage of [...stages].sort((a, b) => a.concurrency - b.concurrency)) {
    if (!stage.criteria?.passed) break;
    highest = stage.concurrency;
  }
  return highest;
}
