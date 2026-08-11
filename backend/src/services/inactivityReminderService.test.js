import test from 'node:test';
import assert from 'node:assert/strict';
import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import {
  buildInactivityReminderText,
  getSessionInactivityReminder,
  registerSessionActivity,
} from './sessionOrchestratorService.js';

test('builds an encouraging reminder that repeats the question and permits uncertainty', () => {
  const reminder = buildInactivityReminderText('What was your favourite childhood game?');

  assert.match(reminder, /there is no rush/i);
  assert.match(reminder, /What was your favourite childhood game\?/);
  assert.match(reminder, /say or type, "I don't know\."/i);
});

test('rejects a duplicate or superseded inactivity reminder revision', async () => {
  const originalFindOneAndUpdate = Session.findOneAndUpdate;
  const originalFindById = Session.findById;
  let claimFilter;

  Session.findOneAndUpdate = async (filter) => {
    claimFilter = filter;
    return null;
  };
  Session.findById = () => ({
    select: () => ({
      lean: async () => ({
        status: 'active',
        activityRevision: 8,
        lastReminderRevision: 7,
      }),
    }),
  });

  try {
    await assert.rejects(
      getSessionInactivityReminder('session-id', 7),
      (error) => error.status === 409 && /no longer current/i.test(error.message)
    );
    assert.equal(claimFilter.activityRevision, 7);
    assert.deepEqual(claimFilter.lastReminderRevision, { $ne: 7 });
  } finally {
    Session.findOneAndUpdate = originalFindOneAndUpdate;
    Session.findById = originalFindById;
  }
});

test('serializes concurrent activity before rejecting a stale reminder', async () => {
  const originalFindOneAndUpdate = Session.findOneAndUpdate;
  const originalFindById = Session.findById;
  const originalCreate = Message.create;
  let releaseActivity;
  let activityStarted;
  let currentRevision = 7;
  let messageCreateCount = 0;
  const activityGate = new Promise((resolve) => { releaseActivity = resolve; });
  const activityStart = new Promise((resolve) => { activityStarted = resolve; });

  Session.findOneAndUpdate = async (filter, update) => {
    if (update.$inc?.activityRevision) {
      activityStarted();
      await activityGate;
      currentRevision += 1;
      return { _id: 'session-id', status: 'active', activityRevision: currentRevision };
    }
    return filter.activityRevision === currentRevision ? {} : null;
  };
  Session.findById = () => ({
    select: () => ({
      lean: async () => ({
        status: 'active',
        activityRevision: currentRevision,
        lastReminderRevision: 6,
      }),
    }),
  });
  Message.create = async () => {
    messageCreateCount += 1;
  };

  try {
    const activityPromise = registerSessionActivity('session-id');
    await activityStart;
    const reminderPromise = getSessionInactivityReminder('session-id', 7);
    releaseActivity();

    await activityPromise;
    await assert.rejects(
      reminderPromise,
      (error) => error.status === 409 && /no longer current/i.test(error.message)
    );
    assert.equal(messageCreateCount, 0);
  } finally {
    Session.findOneAndUpdate = originalFindOneAndUpdate;
    Session.findById = originalFindById;
    Message.create = originalCreate;
  }
});

test('rolls back a failed reminder write so the same revision can retry', async () => {
  const originals = {
    findOneAndUpdate: Session.findOneAndUpdate,
    updateOne: Session.updateOne,
    userFindById: User.findById,
    memoryFindOne: Memory.findOne,
    messageFind: Message.find,
    messageCreate: Message.create,
  };
  let lastReminderRevision = 6;
  let createAttempts = 0;
  const claimedSession = () => ({
    _id: 'session-id',
    userId: 'user-id',
    status: 'active',
    pipelineMode: 'local-scripted',
    activityRevision: 7,
    lastReminderRevision,
    scriptId: 'cst_childhood',
    scriptStepIndex: 0,
    scriptStepTurnIndex: 1,
    interactionState: {},
  });

  Session.findOneAndUpdate = async (filter) => {
    if (filter.activityRevision !== 7 || lastReminderRevision === 7) return null;
    const previous = claimedSession();
    lastReminderRevision = 7;
    return previous;
  };
  Session.updateOne = async (filter, update) => {
    assert.equal(filter.activityRevision, 7);
    assert.equal(filter.lastReminderRevision, 7);
    lastReminderRevision = update.$set.lastReminderRevision;
  };
  User.findById = () => ({ lean: async () => ({ firstName: 'Pat' }) });
  Memory.findOne = () => ({ lean: async () => ({ entries: [] }) });
  Message.find = () => ({
    sort: () => ({
      limit: () => ({ lean: async () => [] }),
    }),
  });
  Message.create = async (message) => {
    createAttempts += 1;
    if (createAttempts === 1) throw new Error('write failed');
    return message;
  };

  try {
    await assert.rejects(getSessionInactivityReminder('session-id', 7), /write failed/);
    assert.equal(lastReminderRevision, 6);

    const retry = await getSessionInactivityReminder('session-id', 7);
    assert.equal(createAttempts, 2);
    assert.equal(lastReminderRevision, 7);
    assert.match(retry.assistantText, /there is no rush/i);
  } finally {
    Session.findOneAndUpdate = originals.findOneAndUpdate;
    Session.updateOne = originals.updateOne;
    User.findById = originals.userFindById;
    Memory.findOne = originals.memoryFindOne;
    Message.find = originals.messageFind;
    Message.create = originals.messageCreate;
  }
});
