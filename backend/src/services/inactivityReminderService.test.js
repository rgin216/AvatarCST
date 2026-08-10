import test from 'node:test';
import assert from 'node:assert/strict';
import Session from '../models/Session.js';
import {
  buildInactivityReminderText,
  getSessionInactivityReminder,
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
