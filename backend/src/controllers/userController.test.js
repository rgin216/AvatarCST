import test from 'node:test';
import assert from 'node:assert/strict';

import User from '../models/User.js';
import { completeLandingTour, updateUserSettings } from './userController.js';

const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

test('updateUserSettings rejects a PATCH with a missing request body', async (t) => {
  let updateCalled = false;
  t.mock.method(User, 'findByIdAndUpdate', async () => { updateCalled = true; return null; });

  const req = { params: { id: 'abc123' }, body: undefined };
  const res = makeRes();
  let nextErr;

  await updateUserSettings(req, res, (err) => { nextErr = err; });

  assert.equal(nextErr, undefined, 'should not forward an error to next()');
  assert.equal(res.statusCode, 400);
  assert.equal(updateCalled, false, 'should not touch the database for an empty PATCH');
});

test('updateUserSettings rejects a PATCH with no supported setting', async (t) => {
  t.mock.method(User, 'findByIdAndUpdate', async () => { throw new Error('should not be called'); });

  const req = { params: { id: 'abc123' }, body: { nickname: 'Meg' } };
  const res = makeRes();

  await updateUserSettings(req, res, (err) => { assert.ifError(err); });

  assert.equal(res.statusCode, 400);
});

test('updateUserSettings still applies a valid settings update', async (t) => {
  let receivedUpdate;
  const updatedUser = { _id: 'abc123', settings: { language: 'fr' } };
  t.mock.method(User, 'findByIdAndUpdate', async (_id, doc) => { receivedUpdate = doc; return updatedUser; });

  const req = { params: { id: 'abc123' }, body: { language: 'fr' } };
  const res = makeRes();

  await updateUserSettings(req, res, (err) => { assert.ifError(err); });

  assert.deepEqual(receivedUpdate, { $set: { 'settings.language': 'fr' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, updatedUser);
});

test('updateUserSettings applies a speech rate update', async (t) => {
  let receivedUpdate;
  t.mock.method(User, 'findByIdAndUpdate', async (_id, doc) => { receivedUpdate = doc; return { _id: 'abc123' }; });

  const req = { params: { id: 'abc123' }, body: { speechRate: 0.85 } };
  const res = makeRes();

  await updateUserSettings(req, res, (err) => { assert.ifError(err); });

  assert.deepEqual(receivedUpdate, { $set: { 'settings.speechRate': 0.85 } });
  assert.equal(res.statusCode, 200);
});

const leanQuery = (value) => ({ select: () => ({ lean: async () => value }) });

test('completeLandingTour records only the first completion', async (t) => {
  t.mock.method(User, 'findById', () => leanQuery({ _id: 'abc123' }));
  let filter, update;
  t.mock.method(User, 'updateOne', async (f, u) => { filter = f; update = u; });

  const res = makeRes();
  res.end = () => res;
  await completeLandingTour({ params: { id: 'abc123' } }, res, (err) => { assert.ifError(err); });

  assert.equal(res.statusCode, 204);
  assert.deepEqual(filter, { _id: 'abc123', landingTourCompletedAt: null });
  assert.ok(update.$set.landingTourCompletedAt instanceof Date);
});

test('completeLandingTour returns 404 for an unknown user', async (t) => {
  t.mock.method(User, 'findById', () => leanQuery(null));
  t.mock.method(User, 'updateOne', async () => { throw new Error('should not be called'); });

  const res = makeRes();
  await completeLandingTour({ params: { id: 'missing' } }, res, (err) => { assert.ifError(err); });

  assert.equal(res.statusCode, 404);
});

test('updateUserSettings returns 404 when the user does not exist', async (t) => {
  t.mock.method(User, 'findByIdAndUpdate', async () => null);

  const req = { params: { id: 'missing' }, body: { avatarMode: 'female' } };
  const res = makeRes();

  await updateUserSettings(req, res, (err) => { assert.ifError(err); });

  assert.equal(res.statusCode, 404);
});
