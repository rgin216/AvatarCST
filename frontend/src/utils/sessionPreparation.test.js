import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPreparation } from './sessionPreparation.js';

const preparation = { message: 'For today’s session you will need a pen and some paper.' };

test('preparation shows once, before a fresh session that needs it', () => {
  assert.equal(shouldShowPreparation({ status: 'active', preparation }, false), true);
  assert.equal(shouldShowPreparation({ status: 'active', preparation }, true), false);
  assert.equal(shouldShowPreparation({ status: 'active' }, false), false);
});

test('preparation is skipped when resuming a session already under way', () => {
  assert.equal(shouldShowPreparation({ status: 'active', preparation, scriptStepIndex: 4 }, false), false);
  assert.equal(shouldShowPreparation({ status: 'ended', preparation }, false), false);
});
