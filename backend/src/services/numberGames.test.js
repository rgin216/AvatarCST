import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getScript, getScriptStep } from './cstScriptService.js';
import {
  buildTopicSessionSummary,
  evaluateNamedInstrumentSlots,
  evaluateTriviaAnswer,
  matchTriviaChoiceRounds,
  respondToSessionTurn,
} from './sessionOrchestratorService.js';
import { guessedNumbers, jarRevealReply } from './numberGamesScript.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import Message from '../models/Message.js';

const script = getScript('cst_number_games');
const find = (suffix) => script.find((step) => step.id === `number_games_${suffix}`);

test('Session 13 script lines up with its markdown sections and exported slides', () => {
  assert.equal(script.length, 35);
  const md = readFileSync(new URL('../../context/vCST_Session13_AI_Script.md', import.meta.url), 'utf8');
  const sections = md.split(/\r?\n---\r?\n/).map((s) => s.trim()).filter(Boolean);
  assert.equal(sections.length, script.length + 1);

  // Check-in shares slide 2 with the theme song, and several steps share a
  // content slide, but every slide 1-28 is used and none is skipped.
  assert.deepEqual([...new Set(script.map((step) => step.deckSlide))], Array.from({ length: 28 }, (_, i) => i + 1));
  for (const [index, step] of script.entries()) {
    assert.equal(getScriptStep('cst_number_games', index).step.slideFolder, 'session13');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session13/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`, import.meta.url)), step.id);
    for (const id of [...Object.values(step.seasonBranches || {}), ...(step.nextStepId ? [step.nextStepId] : [])]) {
      assert.ok(script.some((candidate) => candidate.id === id), id);
    }
  }
  assert.match(script[0].reply({ name: 'Test' }), /thirteenth session/);
  assert.match(script.at(-1).reply({ name: 'Test' }), /Word Games/);
});

test('calendar numbers accept digits, words, and both Christmas numbers', () => {
  const cases = [
    ['calendar_valentines', 'fourteen', 'correct'],
    ['calendar_valentines', 'the 14th of February', 'correct'],
    ['calendar_valentines', '4', 'incorrect'],
    ['calendar_waitangi', 'the sixth', 'correct'],
    ['calendar_waitangi', '16', 'incorrect'],
    ['calendar_christmas', 'twenty-five', 'correct'],
    ['calendar_christmas', '12', 'correct'],
    ['calendar_christmas', 'December', 'correct'],
    ['calendar_christmas', '24', 'incorrect'],
    ['calendar_christmas', 'I would like to pass', 'unsure'],
  ];
  for (const [suffix, content, outcome] of cases) {
    assert.equal(evaluateTriviaAnswer({ step: find(suffix), content }).outcome, outcome, `${suffix}: ${content}`);
  }
  assert.match(evaluateTriviaAnswer({ step: find('calendar_christmas'), content: '12' }).response, /25 and 12 both fit/);
});

test('Found in Fours resolves spoken answers to the right tap-to-choose round', () => {
  const step = find('fours');
  assert.equal(step.interaction.type, 'triviaChoice');
  const resolve = (content, answered = []) =>
    matchTriviaChoiceRounds(content, step, answered).map(({ roundIndex, option }) => [roundIndex, option.id]);

  // "four" is in the clover button's label, but must not answer that round.
  assert.deepEqual(resolve('four stars'), [[1, 'a']]);
  assert.deepEqual(resolve('the clover, stripes, and the beach boys'), [[0, 'a'], [1, 'c'], [2, 'c']]);
  assert.deepEqual(resolve('the beetles'), [[2, 'a']]);
  assert.deepEqual(resolve('Ringo was in it'), [[2, 'a']]);
  assert.deepEqual(resolve('a rose', [0]), []);
});

test('fill-in-the-number judges each card against the part of the answer that names it', () => {
  const step = find('fill_in');
  const outOfOrder = evaluateNamedInstrumentSlots({ step, content: '15 and 4', slotIndices: [0, 3] });
  assert.deepEqual(outOfOrder.outcomes.map((o) => o.outcome), ['correct', 'correct']);
  const swapped = evaluateNamedInstrumentSlots({ step, content: 'tyres 3, tricycle 4', slotIndices: [0, 1] });
  assert.deepEqual(swapped.outcomes.map((o) => o.outcome), ['incorrect', 'incorrect']);
  assert.match(swapped.response, /A car has 4 tyres\. A tricycle has 3 wheels\./);
});

test('jar guesses reveal the answer and credit a close or hedged guess', () => {
  assert.deepEqual(guessedNumbers('maybe twenty-one, or 17'), [21, 17]);
  assert.match(jarRevealReply({ answer: 7, noun: 'lollies', previousAnswer: 'seven' }), /^You got it!/);
  assert.match(jarRevealReply({ answer: 7, noun: 'lollies', previousAnswer: '6 or 7' }), /^You got it!/);
  assert.match(jarRevealReply({ answer: 17, noun: 'chocolates', previousAnswer: 'eighteen' }), /^So close! .* one fewer than your guess/);
  const unsure = jarRevealReply({ answer: 17, noun: 'chocolates', hiddenNote: 'Some were hiding.', previousAnswer: 'no idea' });
  assert.equal(unsure, 'There are 17 chocolates in the jar. Some were hiding.');
});

test('the recap names the Session 13 activities', () => {
  const recap = buildTopicSessionSummary([
    { stepId: 'number_games_calendar_christmas', answer: '25' },
    { stepId: 'number_games_lucky_number', answer: 'Seven, it was my house number.' },
    { stepId: 'number_games_guess_lollies', answer: 'eight' },
  ]);
  assert.match(recap, /number trivia/);
  assert.match(recap, /lucky numbers/);
  assert.match(recap, /lollies were in a jar/);
});

test('session turns fill number cards, reveal jar answers, and move past trivia', async (t) => {
  const session = {
    _id: 'number-games-test', userId: 'test', status: 'active', pipelineMode: 'free', scriptId: 'cst_number_games',
    scriptStepIndex: 0, scriptStepTurnIndex: 1, scriptStepRetryCount: 0, activityRevision: 1,
    interactionState: { sessionAnswers: [] }, save: async () => session,
  };
  const at = (suffix, interactionState = { sessionAnswers: [] }) => {
    Object.assign(session, { scriptStepIndex: script.indexOf(find(suffix)), scriptStepTurnIndex: 1, scriptStepRetryCount: 0, interactionState });
  };
  t.mock.method(Session, 'findOneAndUpdate', async () => session);
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ _id: 'test', name: 'Test' }) }));
  t.mock.method(Memory, 'findOne', () => ({ lean: async () => ({ entries: [] }) }));
  t.mock.method(Message, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [{ role: 'assistant', content: 'Have a go.' }] }));
  t.mock.method(Message, 'create', async (value) => ({ _id: 'message', ...value }));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Lovely.' } }] }) }));

  at('fill_in');
  let response = await respondToSessionTurn({ sessionId: session._id, content: '15 for the rugby' });
  assert.equal(response.slide.id, find('fill_in').id);
  assert.deepEqual(response.namingSlots.filled, [false, false, false, true]);
  assert.equal(response.namingSlots.revealed[3], '15');
  assert.match(response.assistantText, /And what about tyres on a car, wheels on a tricycle, and the unlucky number\?/);

  // A number inside an answer about one card cannot also claim the card whose
  // answer it is (3 is the tricycle's answer).
  response = await respondToSessionTurn({ sessionId: session._id, content: 'my old car has 3 tyres' });
  assert.deepEqual(response.namingSlots.filled, [true, false, false, true]);
  // Talking again about an answered card names no empty card.
  response = await respondToSessionTurn({ sessionId: session._id, content: 'that car of mine had 3' });
  assert.deepEqual(response.namingSlots.filled, [true, false, false, true]);

  // A bare wrong number is still an attempt at the next card.
  response = await respondToSessionTurn({ sessionId: session._id, content: '12' });
  assert.deepEqual(response.namingSlots.filled, [true, true, false, true]);
  assert.match(response.assistantText, /And which number is unlucky\?$/);

  response = await respondToSessionTurn({ sessionId: session._id, content: '13' });
  assert.equal(response.slide.id, find('rugby_memory').id);

  at('guess_lollies');
  response = await respondToSessionTurn({ sessionId: session._id, content: 'I think six' });
  assert.equal(response.slide.id, find('guess_lollies_reveal').id);
  assert.match(response.assistantText, /^So close! There are 7 lollies in the jar\./);

  at('calendar_christmas');
  response = await respondToSessionTurn({ sessionId: session._id, content: 'twenty five' });
  assert.equal(response.slide.id, find('christmas_memory').id);
  assert.match(response.assistantText, /Christmas Day is the 25th of December/);
  assert.match(response.assistantText, /What was Christmas like in your house/);
});
