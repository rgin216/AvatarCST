import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, passwordProblem, verifyPassword } from './passwordService.js';

test('hashPassword salts each hash and verifyPassword accepts only the original', async () => {
  const first = await hashPassword('roses');
  const second = await hashPassword('roses');
  assert.notEqual(first, second);
  assert.ok(!first.includes('roses'));
  assert.equal(await verifyPassword('roses', first), true);
  assert.equal(await verifyPassword('Roses', first), false);
});

test('verifyPassword rejects missing or malformed input without throwing', async () => {
  const stored = await hashPassword('roses');
  assert.equal(await verifyPassword(undefined, stored), false);
  assert.equal(await verifyPassword('roses', undefined), false);
  assert.equal(await verifyPassword('roses', 'plain-text'), false);
});

test('passwordProblem enforces a short minimum length', () => {
  assert.match(passwordProblem('abc'), /at least 4/);
  assert.match(passwordProblem(undefined), /at least 4/);
  assert.equal(passwordProblem('abcd'), null);
});
