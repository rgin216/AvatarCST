import test from 'node:test';
import assert from 'node:assert/strict';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { getMessages, getPipelineInfo, respondAudioToSession, updateSession } from './sessionController.js';

const makeRes = () => {
  const res = { statusCode: 200, body: undefined, headers: {}, chunks: [], headersSent: false, writableEnded: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; res.headersSent = true; res.writableEnded = true; return res; };
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  res.write = (chunk) => { res.chunks.push(chunk); res.headersSent = true; return true; };
  res.end = () => { res.writableEnded = true; };
  return res;
};

const mockClosedSession = (t) => {
  const session = { _id: '64b000000000000000000001', userId: '64b000000000000000000002', status: 'completed', pipelineMode: 'free' };
  const query = (value) => ({ select() { return this; }, lean: async () => value });
  t.mock.method(Session, 'findById', () => query(session));
  t.mock.method(Session, 'findOneAndUpdate', async () => null);
  t.mock.method(User, 'findById', () => query({ settings: { language: 'en' } }));
  return session;
};

test('streamed audio turns send the transcript first and report later failures in-band', async (t) => {
  const session = mockClosedSession(t);
  const res = makeRes();
  await respondAudioToSession({ params: { id: session._id }, query: { stream: 'transcript' }, body: {} }, res,
    () => assert.fail('a streamed failure must not reach the JSON error handler'));
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'], /application\/x-ndjson/);
  const lines = res.chunks.join('').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines[0], { type: 'transcript', transcript: '' });
  assert.equal(lines[1].type, 'error');
  assert.equal(lines[1].status, 409);
  assert.equal(res.writableEnded, true);
});

test('audio turns without the stream flag keep the JSON error contract', async (t) => {
  const session = mockClosedSession(t);
  const res = makeRes();
  let forwarded;
  await respondAudioToSession({ params: { id: session._id }, query: {}, body: {} }, res, (error) => { forwarded = error; });
  assert.equal(forwarded.status, 409);
  assert.equal(res.chunks.length, 0);
});

test('developer skip maps a deck slide to its first script step', async (t) => {
  t.mock.method(Session, 'findById', () => ({ lean: async () => ({ scriptId: 'cst_current_affairs' }) }));
  let update;
  t.mock.method(Session, 'findByIdAndUpdate', async (_id, value) => {
    update = value;
    return { scriptStepIndex: value.$set.scriptStepIndex };
  });
  const res = makeRes();
  await updateSession({ params: { id: 'session' }, body: { skipToDeckSlide: 17 } }, res, (error) => { assert.ifError(error); });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update, { $set: { scriptStepIndex: 16, scriptStepTurnIndex: 0, scriptStepRetryCount: 0,
    'interactionState.devSkipPending': true } });
});

test('developer skip rejects deck slides absent from the session', async (t) => {
  t.mock.method(Session, 'findById', () => ({ lean: async () => ({ scriptId: 'cst_current_affairs' }) }));
  t.mock.method(Session, 'findByIdAndUpdate', async () => { throw new Error('must not update'); });
  const res = makeRes();
  await updateSession({ params: { id: 'session' }, body: { skipToDeckSlide: 999 } }, res, (error) => { assert.ifError(error); });
  assert.equal(res.statusCode, 400);
});

test('session transcripts are served only in development', async (t) => {
  const originalEnv = process.env.NODE_ENV;
  t.after(() => {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });
  const transcript = [{ role: 'user', content: 'Hello' }];
  const find = t.mock.method(Message, 'find', () => ({ sort: async () => transcript }));

  for (const env of ['production', undefined]) {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    const res = makeRes();
    await getMessages({ params: { id: 'session' } }, res, assert.ifError);
    assert.equal(res.statusCode, 403);
    const info = makeRes();
    getPipelineInfo({}, info);
    assert.equal(info.body.transcriptsAvailable, false);
  }
  assert.equal(find.mock.callCount(), 0, 'production must not read the transcript at all');

  process.env.NODE_ENV = 'development';
  const res = makeRes();
  await getMessages({ params: { id: 'session' } }, res, assert.ifError);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, transcript);
  const info = makeRes();
  getPipelineInfo({}, info);
  assert.equal(info.body.transcriptsAvailable, true);
});
