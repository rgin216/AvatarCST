import test from 'node:test';
import assert from 'node:assert/strict';

import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { hashPassword } from '../services/passwordService.js';
import {
  completeLandingTour, login, register, updateUserSettings, verifyUserPassword,
} from './userController.js';

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

const fail = (err) => { if (err) throw err; };

test('register stores hashes, never plain passwords, and hides them from the response', async (t) => {
  let created;
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(User, 'create', async (data) => { created = data; return new User(data); });
  t.mock.method(Memory, 'create', async () => ({}));

  const res = makeRes();
  await register({ body: { name: ' Margaret ', username: ' MargaretT ', password: 'garden' } }, res, fail);

  assert.equal(res.statusCode, 201);
  assert.equal(created.name, 'Margaret');
  assert.equal(created.username, 'margarett');
  assert.match(created.passwordHash, /^scrypt\$/);
  const json = JSON.parse(JSON.stringify(res.body));
  assert.equal(json.user.passwordHash, undefined);
});

test('register rejects taken or malformed usernames, missing names and short passwords', async (t) => {
  t.mock.method(User, 'create', async () => { throw new Error('should not be called'); });
  const findOne = t.mock.method(User, 'findOne', async () => null);

  for (const body of [
    { name: 'Margaret', username: 'margaret', password: 'abc' },
    { name: '', username: 'margaret', password: 'garden' },
    { name: 'Margaret', username: 'mt', password: 'garden' },
    { name: 'Margaret', username: 'margaret t', password: 'garden' },
  ]) {
    const res = makeRes();
    await register({ body }, res, fail);
    assert.equal(res.statusCode, 400);
  }

  findOne.mock.mockImplementation(async () => ({ _id: 'existing' }));
  const taken = makeRes();
  await register({ body: { name: 'Margaret', username: 'margaret', password: 'garden' } }, taken, fail);
  assert.equal(taken.statusCode, 409);
});

test('login accepts the right password and rejects a wrong one or unknown username', async (t) => {
  const passwordHash = await hashPassword('garden');
  const findOne = t.mock.method(User, 'findOne', async () => ({ _id: 'u1', name: 'Margaret', passwordHash }));

  const ok = makeRes();
  await login({ body: { username: 'Margaret', password: 'garden' } }, ok, fail);
  assert.equal(ok.statusCode, 200);

  const wrong = makeRes();
  await login({ body: { username: 'margaret', password: 'nope' } }, wrong, fail);
  assert.equal(wrong.statusCode, 401);

  findOne.mock.mockImplementation(async () => null);
  const unknown = makeRes();
  await login({ body: { username: 'nobody', password: 'garden' } }, unknown, fail);
  assert.equal(unknown.statusCode, 401);
});

test('login matches the username, or the name for legacy accounts, with regex escaped', async (t) => {
  let filter;
  t.mock.method(User, 'findOne', async (f) => { filter = f; return null; });
  await login({ body: { username: 'A.*', password: 'garden' } }, makeRes(), fail);
  const [byUsername, byLegacyName] = filter.$or;
  assert.deepEqual(byUsername, { username: 'a.*' });
  assert.equal(byLegacyName.username, null);
  assert.equal(byLegacyName.name.$regex.test('anything'), false);
  assert.equal(byLegacyName.name.$regex.test('A.*'), true);
});

test('login lets a legacy name-only account claim its first password', async (t) => {
  t.mock.method(User, 'findOne', async () => ({ _id: 'legacy', name: 'Harry' }));
  let filter, update;
  t.mock.method(User, 'updateOne', async (f, u) => { filter = f; update = u; return { modifiedCount: 1 }; });

  const res = makeRes();
  await login({ body: { username: 'Harry', password: 'garden' } }, res, fail);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { _id: 'legacy', passwordHash: null });
  assert.match(update.$set.passwordHash, /^scrypt\$/);
});

const leanUser = (value) => () => ({ lean: async () => value });

test('verifyUserPassword re-checks the sign-in password', async (t) => {
  const findById = t.mock.method(User, 'findById', leanUser({ _id: 'u1', passwordHash: await hashPassword('garden') }));

  const ok = makeRes();
  ok.end = () => ok;
  await verifyUserPassword({ params: { id: 'u1' }, body: { password: 'garden' } }, ok, fail);
  assert.equal(ok.statusCode, 204);

  const wrong = makeRes();
  await verifyUserPassword({ params: { id: 'u1' }, body: { password: 'nope' } }, wrong, fail);
  assert.equal(wrong.statusCode, 401);

  findById.mock.mockImplementation(leanUser(null));
  const missing = makeRes();
  await verifyUserPassword({ params: { id: 'missing' }, body: { password: 'garden' } }, missing, fail);
  assert.equal(missing.statusCode, 404);
});
