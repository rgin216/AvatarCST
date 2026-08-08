import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInactivityReminderText } from './sessionOrchestratorService.js';

test('builds an encouraging reminder that repeats the question and permits uncertainty', () => {
  const reminder = buildInactivityReminderText('What was your favourite childhood game?');

  assert.match(reminder, /there is no rush/i);
  assert.match(reminder, /What was your favourite childhood game\?/);
  assert.match(reminder, /say or type, "I don't know\."/i);
});
