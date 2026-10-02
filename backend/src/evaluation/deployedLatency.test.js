import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeployedLatency, validateDeploymentPlan } from './deployedLatency.js';
import { timeAsync } from '../services/turnTiming.js';

const plan = { apiUrl: 'https://backend.example/api', sessionId: '1234567890abcdef12345678', inputs: ['Hello', 'Gardening'] };
test('deployed runner times body completion, excludes pacing and checkpoint work', async () => {
  let clock = 0;
  const requests = [];
  const rows = await runDeployedLatency({ ...plan, now: () => clock, sleep: async () => { clock += 1000; },
    onRow: async () => { clock += 500; }, fetchImpl: async (url, options) => {
      requests.push({ url, options }); clock += 20;
      return { ok: true, status: 201, json: async () => { clock += 30; return { assistantText: 'Hello', turnId: 'server-id',
        timings: { totalMs: 40 }, avatar: { audio: { segments: [{ url: '/audio.mp3' }] } } }; } };
    } });
  assert.deepEqual(rows.map(r => r.requestMs), [50, 50]);
  assert.equal(rows[0].turnId, 'server-id'); assert.equal(rows[0].audioSegments, 1);
  assert.equal(requests[0].url, `${plan.apiUrl}/sessions/${plan.sessionId}/respond`);
  assert.equal(JSON.parse(requests[0].options.body).content, 'Hello');
  assert.equal(rows[0].assistantText, undefined);
});
test('stops after HTTP errors, timeout ambiguity, or session completion', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 503 }), async () => { throw new Error('timeout'); },
    async () => ({ ok: true, status: 201, json: async () => ({ assistantText: 'Goodbye', sessionCompleteAfterResponse: true }) })]) {
    const rows = await runDeployedLatency({ ...plan, fetchImpl });
    assert.equal(rows.length, 1);
  }
});
test('invalid deployment plans reject before writes', () => {
  for (const invalid of [{ apiUrl: 'file:///tmp' }, { apiUrl: 'https://user:secret@example.com/api' },
    { sessionId: 'unknown' }, { inputs: [] }, { repeats: 0 }, { timeoutMs: 1 }]) {
    assert.throws(() => validateDeploymentPlan({ ...plan, ...invalid }));
  }
});
test('speech stage durations accumulate across segments, including failures', async () => {
  let clock = 0; const timings = {};
  await timeAsync('ttsMs', async () => { clock += 15; }, timings, () => clock);
  await timeAsync('ttsMs', async () => { clock += 25; }, timings, () => clock);
  await assert.rejects(timeAsync('ttsMs', async () => { clock += 10; throw new Error('TTS'); }, timings, () => clock));
  assert.equal(timings.ttsMs, 50);
});
