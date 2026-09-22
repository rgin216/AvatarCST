import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidWord, scoreGuess, wordHint } from './wordGuess.js';

test('accepts dictionary words and rejects made-up guesses', () => {
  assert.equal(isValidWord('plant'), true);
  assert.equal(isValidWord('APPLE'), true);
  assert.equal(isValidWord('aaaaa'), false);
  assert.equal(isValidWord('qzxjk'), false);
});

test('scores exact, misplaced, absent, and repeated letters', () => {
  assert.deepEqual(scoreGuess('PLANT', 'PLANT'), Array(5).fill('green'));
  assert.deepEqual(scoreGuess('APPLE', 'PLANT'), ['yellow', 'yellow', 'grey', 'yellow', 'grey']);
  assert.deepEqual(scoreGuess('ALLEY', 'APPLE'), ['green', 'yellow', 'grey', 'yellow', 'grey']);
  assert.deepEqual(scoreGuess('plant', 'plant'), Array(5).fill('green'));
});

test('hint gives one correctly placed letter and one genuinely misplaced letter', () => {
  const solution = 'PLANT';
  const { green, yellow } = wordHint(solution);
  assert.equal(solution[green.position - 1], green.letter);
  assert.ok(solution.includes(yellow.letter));
  assert.notEqual(solution[yellow.excludedPosition - 1], yellow.letter);
});
