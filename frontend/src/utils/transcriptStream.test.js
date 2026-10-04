import test from 'node:test';
import assert from 'node:assert/strict';
import { readStreamedTranscript, transformTranscriptStreamResponse } from './transcriptStream.js';

const streamHeaders = { 'content-type': 'application/x-ndjson; charset=utf-8' };
const line = (value) => `${JSON.stringify(value)}\n`;

test('reads the transcript only once its line is complete', () => {
  const transcriptLine = line({ type: 'transcript', transcript: 'I grew up by the sea.' });
  assert.equal(readStreamedTranscript(''), null);
  assert.equal(readStreamedTranscript(transcriptLine.slice(0, 20)), null);
  assert.equal(readStreamedTranscript(transcriptLine), 'I grew up by the sea.');
  assert.equal(readStreamedTranscript(transcriptLine + '{"type":"tu'), 'I grew up by the sea.');
  assert.equal(readStreamedTranscript(undefined), null);
});

test('returns the turn from a complete stream', () => {
  const body = line({ type: 'transcript', transcript: 'Hello' }) + line({ type: 'turn', turn: { turnId: 't1', transcript: 'Hello' } });
  assert.deepEqual(transformTranscriptStreamResponse(body, streamHeaders, 201), { turnId: 't1', transcript: 'Hello' });
});

test('in-band errors and truncated streams reject with a status', () => {
  const config = { latencyRow: 'row' };
  const failed = line({ type: 'transcript', transcript: 'Hello' }) + line({ type: 'error', status: 409, error: 'Session completed' });
  assert.throws(() => transformTranscriptStreamResponse.call(config, failed, streamHeaders, 201),
    (error) => error.message === 'Session completed' && error.response.status === 409 && error.config === config);
  assert.throws(() => transformTranscriptStreamResponse(line({ type: 'transcript', transcript: 'Hello' }), streamHeaders, 201),
    (error) => error.response.status === 201);
});

test('ordinary JSON responses parse as before', () => {
  const jsonHeaders = { get: (name) => (name === 'content-type' ? 'application/json; charset=utf-8' : null) };
  assert.deepEqual(transformTranscriptStreamResponse('{"turnId":"t2"}', jsonHeaders, 201), { turnId: 't2' });
  assert.deepEqual(transformTranscriptStreamResponse('{"error":"Session not found"}', jsonHeaders, 404), { error: 'Session not found' });
  assert.equal(transformTranscriptStreamResponse('', jsonHeaders, 500), '');
});
