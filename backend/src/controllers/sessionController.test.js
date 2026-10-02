import test from 'node:test';
import assert from 'node:assert/strict';
import Session from '../models/Session.js';
import { updateSession } from './sessionController.js';

const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

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
