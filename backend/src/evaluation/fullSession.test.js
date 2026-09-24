import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSessionLlm, getSessionLlm } from '../services/llmContext.js';
import { generateResponse } from '../services/llmService.js';
import { chooseFacilitator, createEvaluationAssignment } from './liveConfig.js';
import { judgeFullSession, buildReviewSections, critiqueFailure } from './sessionJudge.js';
import { replaySession } from './sessionReplay.js';
import { RUBRIC } from './runner.js';
import { respondToSessionTurn, endSessionAndQueueEvaluation } from '../services/sessionOrchestratorService.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import Message from '../models/Message.js';
import { EvaluationTurn, SessionEvaluation } from '../models/Evaluation.js';
import { processEvaluationJob } from './sessionJobs.js';
import { updateSession } from '../controllers/sessionController.js';

const roster = [{ id: 'a', provider: 'groq', model: 'model-a' }, { id: 'b', provider: 'groq', model: 'model-b' }];
const verdict = JSON.stringify({ scores: Object.fromEntries(Object.keys(RUBRIC).map(k => [k, { score: 4, evidence: 'Turn 1' }])), criticalFailures: [] });

test('concurrent sessions retain their model overrides and restore the default context', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    await new Promise(resolve => setTimeout(resolve, body.model === 'model-a' ? 5 : 1));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: body.model } }] });
  });
  const traces = [[], []];
  const responses = await Promise.all(roster.map((model, i) =>
    withSessionLlm(model, traces[i], () => generateResponse([{ role: 'user', content: 'Hello' }], { provider: 'openai', model: 'wrong' }))));
  assert.deepEqual(responses, ['model-a', 'model-b']);
  assert.deepEqual(traces.map(trace => trace[0].model), ['model-a', 'model-b']);
  assert.equal(getSessionLlm(), undefined);
});

test('rotation wraps per sequence, manual selection stays fixed, and disabled servers reject opt-in', async () => {
  assert.deepEqual([1, 2, 3, 4].map(n => chooseFacilitator(roster, 'rotate', n).id), ['a', 'b', 'a', 'b']);
  assert.equal(chooseFacilitator(roster, 'b', 99).id, 'b');
  assert.throws(() => chooseFacilitator(roster, 'missing'), /Unknown/);
  const prior = process.env.LLM_EVALUATION_ENABLED;
  process.env.LLM_EVALUATION_ENABLED = 'false';
  try { await assert.rejects(createEvaluationAssignment('user', 'rotate'), /disabled/); }
  finally { if (prior === undefined) delete process.env.LLM_EVALUATION_ENABLED; else process.env.LLM_EVALUATION_ENABLED = prior; }
});

test('full-session critics see final transcript and progression, never raw output or facilitator identity', async () => {
  const seen = [];
  const report = await judgeFullSession({
    assignment: { facilitator: roster[0], critics: [roster[0], roster[1]] },
    script: [{ id: 'welcome', prompt: 'How are you?' }],
    naturalCompletion: false,
    turns: [{ input: 'Hello', deliveredText: 'Welcome.', step: { forcedProgress: true }, calls: [{ status: 'error', output: 'raw private' }, { kind: 'fallback' }] }],
    generate: async (messages, options) => { seen.push({ messages, options }); return verdict; },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].options.model, 'model-b');
  assert.ok(!seen[0].messages[1].content.includes('model-a'));
  assert.ok(!seen[0].messages[1].content.includes('raw private'));
  assert.equal(report.naturalCompletion, false);
  assert.equal(report.failedModelCalls, 1);
  assert.equal(report.recordedFallbacks, 1);
  assert.equal(report.forcedProgressCount, 1);
});

test('session judges reject overlong evidence rather than silently truncating it', async () => {
  await assert.rejects(judgeFullSession({
    turns: [{ deliveredText: 'x'.repeat(180001) }], assignment: { facilitator: roster[0], critics: [] }, script: [],
  }), /no partial transcript/);
});

test('long reviews include every turn, bound requests, pace calls and synthesize separately', async () => {
  const requests = [], pauses = [];
  const turns = Array.from({ length: 12 }, (_, index) => ({ input: `Answer ${index}`, deliveredText: 'Evidence '.repeat(210), step: { id: 'welcome', index: 0 } }));
  const report = await judgeFullSession({ turns, script: [{ id: 'welcome', index: 0, prompt: 'Welcome' }],
    assignment: { facilitator: roster[0], critics: [roster[1]] }, naturalCompletion: true,
    generate: async messages => { requests.push(JSON.parse(messages[1].content)); return verdict; },
    pause: async ms => { pauses.push(ms); },
  });
  assert.equal(report.reviewMethod, 'section-synthesis');
  assert.ok(report.sectionCount > 1);
  assert.deepEqual(requests.filter(r => r.turns).flatMap(r => r.turns.map(t => t.turn)), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.ok(requests.every(r => Buffer.byteLength(JSON.stringify(r)) < 10200));
  assert.equal(pauses.length, requests.length - 1);
  assert.ok(pauses.every(ms => ms === 61000));
  assert.equal(report.judgments[0].status, 'ok');
  assert.ok(report.judgments[0].synthesis.length);
});

test('a failed section never becomes a successful full-session score', async () => {
  let calls = 0;
  const report = await judgeFullSession({
    turns: Array.from({ length: 8 }, () => ({ deliveredText: 'a'.repeat(2500) })), script: [],
    assignment: { facilitator: roster[0], critics: [roster[1]] }, pause: async () => {},
    generate: async () => { if (++calls === 2) throw new Error('Groq error 429: quota'); return verdict; },
  });
  assert.equal(report.judgments[0].status, 'error');
  assert.equal(report.judgments[0].result, undefined);
  assert.equal(report.judgments[0].sections.length, 1);
  assert.equal(report.judgments[0].failure.code, 'rate_limit');
});

test('section limits count UTF-8 bytes and refuse oversized individual evidence', () => {
  assert.throws(() => buildReviewSections([{ assistant: '界'.repeat(4000) }], [], false), /no partial transcript/);
  assert.equal(critiqueFailure(new Error('Groq error 413: private provider detail')).code, 'request_too_large');
  assert.ok(!critiqueFailure(new Error('Groq error 413: private provider detail')).message.includes('private'));
});

test('invalid critique format gets one paced retry and retains its invalid output', async () => {
  let calls = 0;
  const pauses = [];
  const report = await judgeFullSession({ turns: [{ deliveredText: 'Welcome.' }], script: [],
    assignment: { facilitator: roster[0], critics: [roster[1]] }, pause: async ms => pauses.push(ms),
    generate: async () => ++calls === 1 ? '{"scores":{}}' : verdict,
  });
  assert.equal(calls, 2);
  assert.deepEqual(pauses, [61000]);
  assert.equal(report.judgments[0].status, 'ok');
  assert.equal(report.judgments[0].invalidAttempts.length, 1);
  let invalidCalls = 0;
  const failed = await judgeFullSession({ turns: [{ deliveredText: 'Welcome.' }], script: [],
    assignment: { facilitator: roster[0], critics: [roster[1]] }, pause: async () => {},
    generate: async () => { invalidCalls++; return '{}'; },
  });
  assert.equal(invalidCalls, 2);
  assert.equal(failed.judgments[0].status, 'error');
  assert.equal(failed.judgments[0].invalidAttempts.length, 2);
});

test('real orchestrator replays every Session 1 step and captures delivered turns with pinned model', async t => {
  const scenario = JSON.parse(await readFile(new URL('../../evaluation/session-scenarios.json', import.meta.url), 'utf8'))[0];
  const transcript = [], captured = [], jobs = [], requests = [];
  const session = { _id: 'session', userId: 'user', status: 'active', pipelineMode: 'free', scriptId: scenario.scriptId,
    scriptStepIndex: 0, scriptStepTurnIndex: 0, scriptStepRetryCount: 0, activityRevision: 0, interactionState: {},
    evaluation: { facilitator: roster[1], critics: [roster[0]] }, save: async () => session };
  t.mock.method(Session, 'findOneAndUpdate', async () => { session.activityRevision++; return session; });
  t.mock.method(Session, 'findById', () => ({ lean: async () => session }));
  t.mock.method(Session, 'updateOne', async (_, update) => { Object.assign(session, update.$set); });
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ name: 'Alex' }) }));
  t.mock.method(User, 'findByIdAndUpdate', async () => ({}));
  t.mock.method(Memory, 'findOne', () => Object.assign(Promise.resolve(null), { lean: async () => null }));
  t.mock.method(Memory, 'findOneAndUpdate', () => ({ lean: async () => ({ entries: [] }) }));
  t.mock.method(Message, 'find', () => ({
    sort() { return this; }, limit() { return this; },
    lean: async () => transcript.slice(-20).reverse(),
  }));
  t.mock.method(Message, 'create', async message => { const doc = { ...message, _id: String(transcript.length) }; transcript.push(doc); return doc; });
  t.mock.method(EvaluationTurn, 'create', async row => { captured.push(row); return row; });
  t.mock.method(SessionEvaluation, 'updateOne', async (...args) => { jobs.push(args); return {}; });
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const system = body.messages[0].content;
    const content = system.includes('# Decision Rules')
      ? JSON.stringify({ answered: true, response: 'Sharing ideas can be enjoyable.', followUp: null })
      : system.includes('Create a brief, warm recap') ? 'Today, you shared your interests and ideas.' : 'Thank you for sharing that.';
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });
  });
  const result = await replaySession({ sessionId: 'session', scenario, loadSession: async () => session, respond: respondToSessionTurn });
  assert.equal(result.naturalCompletion, true);
  assert.equal(new Set(result.turns.map(turn => turn.scriptStep.id)).size, 8);
  assert.equal(captured.length, result.turns.length);
  assert.deepEqual(captured.map(row => row.deliveredText), result.turns.map(turn => turn.assistantText));
  assert.ok(requests.length > 0 && requests.every(request => request.model === 'model-b'));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0][1].$setOnInsert.naturalCompletion, true);
});

test('replay turn limits remain incomplete, never successful completion', async () => {
  const result = await replaySession({ sessionId: 'session', maxTurns: 1,
    scenario: { answers: { welcome_opening: ['Hello'] } }, loadSession: async () => ({ scriptId: 'cst_intro_reminiscence' }),
    respond: async () => ({ assistantText: 'Welcome', sessionCompleteAfterResponse: false }),
  });
  assert.equal(result.naturalCompletion, false);
  assert.equal(result.stopReason, 'turn-limit');
});

test('end requests serialize before queuing a frozen session for review', async t => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(Session, 'findByIdAndUpdate', async () => {
    events.push('end');
    if (events.length === 1) await gate;
    return { _id: 'serialized-end', evaluation: {} };
  });
  t.mock.method(Session, 'findById', () => ({ lean: async () => ({ evaluation: { facilitator: roster[0] } }) }));
  t.mock.method(SessionEvaluation, 'updateOne', async () => { events.push('queue'); });
  const first = endSessionAndQueueEvaluation('serialized-end');
  const second = endSessionAndQueueEvaluation('serialized-end');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['end']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['end', 'queue', 'end', 'queue']);
});

test('assignment cannot be changed through the generic session patch endpoint', async () => {
  for (const body of [{ evaluation: {} }, { 'evaluation.facilitator': 'other' }, { $set: { evaluation: {} } }]) {
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    await updateSession({ params: { id: 'x' }, body }, res, error => { throw error; });
    assert.equal(status, 400);
  }
});

test('worker refuses to score missing captures and uses a token-bound lease update', async t => {
  const updates = [];
  t.mock.method(SessionEvaluation, 'findOneAndUpdate', async () => ({ _id: 'job', sessionId: 'session', attempts: 1 }));
  t.mock.method(Session, 'findById', () => ({ lean: async () => ({ evaluation: { captureError: true } }) }));
  t.mock.method(SessionEvaluation, 'updateOne', async (filter, update) => { updates.push({ filter, update }); });
  assert.equal(await processEvaluationJob(), true);
  assert.equal(updates[0].update.$set.status, 'failed');
  assert.match(updates[0].update.$set.error, /partial record/);
  assert.ok(updates[0].filter.leaseToken);
});
