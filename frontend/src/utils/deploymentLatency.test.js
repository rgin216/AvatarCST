import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatencyCapture, latencyCsv } from './deploymentLatency.js';

test('opt-in capture joins server timings to browser playing without mixing clocks', () => {
  let clock = 0;
  const capture = createLatencyCapture({ now: () => clock, id: () => 'client-id' });
  assert.equal(capture.begin({}), null); capture.enable(true);
  capture.recordingStopped(); clock = 250;
  const row = capture.begin({ inputMode: 'audio', sessionId: 'session' });
  clock = 1250; capture.response(row, { turnId: 'server-id', timings: { totalMs: 900 }, avatar: { audio: { url: '/audio' } } });
  clock = 1450; capture.playing(); clock = 1600; capture.playing(); capture.finished();
  const saved = capture.snapshot()[0];
  assert.equal(saved.requestMs, 1000); assert.equal(saved.responseToPlayingMs, 200);
  assert.equal(saved.requestToPlayingMs, 1200); assert.equal(saved.stopToPlayingMs, 1450);
  assert.equal(saved.playbackStatus, 'completed'); assert.equal(saved.serverTimings.totalMs, 900);
  assert.equal(saved.requestStart, undefined);
});
test('blocked autoplay remains flagged after manual playback; failures do not acquire onset', () => {
  const capture = createLatencyCapture({ now: () => 10, id: () => 'id' }); capture.enable(true);
  const row = capture.begin({ inputMode: 'text' });
  capture.response(row, { avatar: { audio: { url: '/a' } } }); capture.blocked(); capture.playing();
  assert.equal(capture.snapshot()[0].autoplayBlocked, true);
  const failed = capture.begin({}); capture.failed(failed, 500); capture.playing();
  assert.equal(capture.snapshot()[1].requestToPlayingMs, null);
  assert.equal(capture.snapshot()[1].httpStatus, 500);
});
test('missing audio and clear are explicit; CSV preserves numeric durations and escapes strings', () => {
  const capture = createLatencyCapture(); capture.enable(true);
  const row = capture.begin({}); capture.response(row, {}); capture.playing();
  assert.equal(capture.snapshot()[0].playbackStatus, 'missing_audio');
  assert.equal(capture.snapshot()[0].requestToPlayingMs, null);
  assert.ok(latencyCsv([{ id: '=formula', requestMs: 12, serverTimings: { totalMs: 10 } }]).includes('"\'=formula"'));
  capture.clear(); assert.deepEqual(capture.snapshot(), []);
});
