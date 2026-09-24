import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Memory from '../models/Memory.js';
import { getSessionAccess, unlockAfterIntroduction, INTRO_SCRIPT_ID } from './sessionAccessService.js';
import { createSession, updateSession } from '../controllers/sessionController.js';
import { createUser, findOrCreateByName } from '../controllers/userController.js';

const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
const next = error => { if (error) throw error; };

test('new accounts need the introduction; legacy and completed accounts retain access', async t => {
  let user = { introductionRequired: true };
  t.mock.method(User, 'findById', () => ({ lean: async () => user }));
  assert.equal((await getSessionAccess('user')).introductionRequired, true);
  user = { introductionRequired: true, introductionCompletedAt: new Date() };
  assert.equal((await getSessionAccess('user')).introductionRequired, false);
  user = {};
  assert.equal((await getSessionAccess('user')).introductionRequired, false);
  user = null;
  await assert.rejects(getSessionAccess('missing'), { status: 404 });
});

test('session creation blocks other scripts until natural introduction completion', async t => {
  const user = { introductionRequired: true };
  const created = [];
  t.mock.method(User, 'findById', () => ({ lean: async () => user }));
  t.mock.method(Session, 'create', async data => { created.push(data); return data; });
  const blocked = response();
  await createSession({ body: { userId: 'user', scriptId: 'another-session', unlocksSessions: false } }, blocked, next);
  assert.equal(blocked.statusCode, 403);
  assert.equal(created.length, 0);
  const intro = response();
  await createSession({ body: { userId: 'user', unlocksSessions: false } }, intro, next);
  assert.equal(intro.statusCode, 201);
  assert.equal(intro.body.scriptId, INTRO_SCRIPT_ID);
  assert.equal(intro.body.unlocksSessions, true);
  user.introductionCompletedAt = new Date();
  const unlocked = response();
  await createSession({ body: { userId: 'user', scriptId: 'another-session' } }, unlocked, next);
  assert.equal(unlocked.statusCode, 201);
  assert.equal(unlocked.body.unlocksSessions, false);
});

test('early endings and unrelated sessions do not unlock; scripted completion records user-scoped access', async t => {
  const writes = [];
  t.mock.method(Session, 'updateOne', async (...args) => writes.push(['session', ...args]));
  t.mock.method(User, 'updateOne', async (...args) => writes.push(['user', ...args]));
  const session = { _id: 'intro', userId: 'owner', scriptId: INTRO_SCRIPT_ID, unlocksSessions: true, status: 'completed' };
  await unlockAfterIntroduction(session, { sessionCompleteAfterResponse: false });
  await unlockAfterIntroduction({ ...session, scriptId: 'other' }, { sessionCompleteAfterResponse: true });
  assert.equal(writes.length, 0);
  await unlockAfterIntroduction(session, { sessionCompleteAfterResponse: true });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1][1], { _id: 'owner', introductionCompletedAt: null });
  assert.ok(writes[1][2].$set.introductionCompletedAt instanceof Date);
});

test('registration cannot forge an unlocked profile in either account creation path', async t => {
  const created = [];
  t.mock.method(User, 'create', async data => { created.push(data); return { ...data, _id: 'new' }; });
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(Memory, 'create', async () => ({}));
  await createUser({ body: { name: 'New user', introductionRequired: false, introductionCompletedAt: new Date() } }, response(), next);
  await findOrCreateByName({ params: { name: 'Another user' } }, response(), next);
  assert.ok(created.every(user => user.introductionRequired === true && !user.introductionCompletedAt));
});

test('introduction progression and completion markers cannot be patched to bypass the prerequisite', async t => {
  t.mock.method(Session, 'findById', () => ({ lean: async () => ({ unlocksSessions: true }) }));
  t.mock.method(Session, 'findByIdAndUpdate', async () => { throw new Error('Must not write'); });
  for (const body of [{ scriptStepIndex: 7 }, { unlocksSessions: false }, { scriptCompletedAt: new Date() }]) {
    const res = response();
    await updateSession({ params: { id: 'intro' }, body }, res, next);
    assert.equal(res.statusCode, 'scriptStepIndex' in body ? 409 : 400);
  }
});
