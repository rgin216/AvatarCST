import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { clearSpeechCache, getOrCreateSpeech, prefetchSpeech, speechCacheKey } from './speechCacheService.js';

const makeAudioFile = async () => {
  const filePath = path.join(os.tmpdir(), `speech-cache-${process.hrtime.bigint()}.mp3`);
  await fs.promises.writeFile(filePath, 'audio');
  return filePath;
};

test.beforeEach(() => clearSpeechCache());

test('cache keys depend on every speech option', () => {
  assert.equal(speechCacheKey({ text: 'Hello', voice: 'a' }), speechCacheKey({ text: 'Hello', voice: 'a' }));
  assert.notEqual(speechCacheKey({ text: 'Hello', voice: 'a' }), speechCacheKey({ text: 'Hello', voice: 'b' }));
});

test('a prefetch and the turn that needs it share one synthesis', async () => {
  const audioOutputPath = await makeAudioFile();
  let calls = 0;
  const create = async () => { calls += 1; return { audioOutputPath, audioUrl: '/a.mp3' }; };
  prefetchSpeech('key', create);
  const first = await getOrCreateSpeech('key', create);
  const second = await getOrCreateSpeech('key', create);
  assert.equal(calls, 1);
  assert.equal(first, second);
});

test('a failed prefetch does not fail the turn', async () => {
  const audioOutputPath = await makeAudioFile();
  prefetchSpeech('key', async () => { throw new Error('TTS down'); });
  const audio = await getOrCreateSpeech('key', async () => ({ audioOutputPath, audioUrl: '/b.mp3' }));
  assert.equal(audio.audioUrl, '/b.mp3');
});

test('incomplete results are returned but not reused', async () => {
  const audioOutputPath = await makeAudioFile();
  let calls = 0;
  const create = async () => { calls += 1; return { audioOutputPath, rhubarbJson: calls > 1 ? {} : null }; };
  const isComplete = (audio) => Boolean(audio.rhubarbJson);
  assert.equal((await getOrCreateSpeech('key', create, { isComplete })).rhubarbJson, null);
  assert.deepEqual((await getOrCreateSpeech('key', create, { isComplete })).rhubarbJson, {});
  await getOrCreateSpeech('key', create, { isComplete });
  assert.equal(calls, 2);
});

test('a stalled synthesis times out and the next request retries', async () => {
  const audioOutputPath = await makeAudioFile();
  await assert.rejects(getOrCreateSpeech('key', () => new Promise(() => {}), { timeoutMs: 20 }), /timed out/);
  const audio = await getOrCreateSpeech('key', async () => ({ audioOutputPath, audioUrl: '/c.mp3' }));
  assert.equal(audio.audioUrl, '/c.mp3');
});

test('a cached entry whose audio file was removed is synthesized again', async () => {
  const audioOutputPath = await makeAudioFile();
  let calls = 0;
  const create = async () => { calls += 1; return { audioOutputPath }; };
  await getOrCreateSpeech('key', create);
  await fs.promises.unlink(audioOutputPath);
  await getOrCreateSpeech('key', create);
  assert.equal(calls, 2);
});
