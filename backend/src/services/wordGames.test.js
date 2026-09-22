import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getScript, getScriptStep } from './cstScriptService.js';
import { buildTopicSessionSummary, evaluateTriviaAnswer, respondToSessionTurn } from './sessionOrchestratorService.js';
import { hasCompletedPronunciation } from './wordGamesService.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import Message from '../models/Message.js';

const script = getScript('cst_word_games');
const find = suffix => script.find(s => s.id === `word_games_${suffix}`);

test('Session 14 deck, media, opening branches and closing are complete', () => {
  assert.match(script[0].reply({ name: 'Test' }), /Session 14/);
  assert.equal(find('pronunciation').deckSlide, 16);
  assert.equal(script.filter(s => s.trivia).length, 14);
  assert.equal(script.filter(s => s.wordAssociation).length, 9);
  assert.equal(script.filter(s => s.rhymeWord).length, 5);
  for (const [index, step] of script.entries()) {
    assert.equal(getScriptStep('cst_word_games', index).step.slideFolder, 'session14');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session14/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`, import.meta.url)));
    for (const id of [...Object.values(step.seasonBranches || {}), ...(step.nextStepId ? [step.nextStepId] : [])]) assert.ok(script.some(s => s.id === id), id);
  }
  for (const clip of find('pronunciation').interaction.clips) assert.ok(existsSync(new URL(`../../../frontend/public${clip.src}`, import.meta.url)));
  assert.match(script.at(-1).reply({ name: 'Test' }), /Pub Quiz/);
});

test('brain teasers accept requested variants and vary feedback across all questions', () => {
  for (const [slide, content] of [[22, "Don't count on it"], [22, 'dont count on it'], [23, 'Quit horsing around'], [23, "don't horse around"], [29, 'settle the score'], [31, 'time to kill']]) {
    assert.equal(evaluateTriviaAnswer({ step: find(`teaser_${slide}`), content }).outcome, 'correct', content);
  }
  assert.equal(evaluateTriviaAnswer({ step: find('teaser_26'), content: 'It is not big mouth' }).outcome, 'incorrect');
  const questions = script.filter(s => s.trivia);
  const answers = [];
  const positive = [], negative = [], unsure = [];
  for (const step of questions) {
    positive.push(evaluateTriviaAnswer({ step, content: step.trivia.answer, answers }).response);
    negative.push(evaluateTriviaAnswer({ step, content: 'a different guess', answers }).response.split('.')[0]);
    unsure.push(evaluateTriviaAnswer({ step, content: 'I am not sure', answers }).response.split('.')[0]);
    answers.push({ stepId: step.id, answer: step.trivia.answer });
  }
  assert.match(positive[2], /3 in a row/);
  assert.equal(new Set(negative).size, 14);
  assert.equal(new Set(unsure).size, 14);
  answers.at(-1).answer = 'a different guess';
  assert.doesNotMatch(evaluateTriviaAnswer({ step: questions[0], content: questions[0].trivia.answer, answers }).response, /in a row/);
  assert.match(evaluateTriviaAnswer({ step: questions[0], content: questions[0].trivia.answer, answers }).response, /solved so many/);
});

test('pronunciation completion requires every distinct clip', () => {
  const step = find('pronunciation');
  const ids = step.interaction.clips.map(c => c.id);
  assert.equal(hasCompletedPronunciation(step, 'ready'), false);
  assert.equal(hasCompletedPronunciation(step, `[[pronunciation-complete:${ids.slice(1).join(',')}]]`), false);
  assert.equal(hasCompletedPronunciation(step, `[[pronunciation-complete:${Array(6).fill(ids[0]).join(',')}]]`), false);
  assert.equal(hasCompletedPronunciation(step, `[[pronunciation-complete:${ids.join(',')}]]`), true);
});

test('recap includes the word activities actually attempted', () => {
  const recap = buildTopicSessionSummary([
    { stepId: 'word_games_teaser_18', answer: 'wish upon a star' },
    { stepId: 'word_games_association_salt', answer: 'pepper' },
    { stepId: 'word_games_rhyme_sun', answer: 'fun and run' },
  ]);
  assert.match(recap, /brain teasers/);
  assert.match(recap, /words that go together/);
  assert.match(recap, /words that rhyme/);
  assert.doesNotMatch(recap, /five-letter/);
});

test('session handler blocks premature pronunciation progress and advances completed activities once', async t => {
  const session = { _id: 'word-game-test', userId: 'test', status: 'active', pipelineMode: 'free', scriptId: 'cst_word_games', scriptStepIndex: script.indexOf(find('pronunciation')), scriptStepTurnIndex: 1, scriptStepRetryCount: 0, activityRevision: 1, interactionState: { sessionAnswers: [] }, save: async () => session };
  t.mock.method(Session, 'findOneAndUpdate', async () => session);
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ _id: 'test', name: 'Test' }) }));
  t.mock.method(Memory, 'findOne', () => ({ lean: async () => ({ entries: [] }) }));
  t.mock.method(Message, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [{ role: 'assistant', content: 'Try this activity.' }] }));
  t.mock.method(Message, 'create', async value => ({ _id: 'message', ...value }));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"answered":true,"response":"A lovely connection.","followUp":null}' } }] }) }));
  for (let i = 0; i < 4; i++) await assert.rejects(respondToSessionTurn({ sessionId: session._id, content: 'ready' }), { status: 409 });
  assert.equal(session.scriptStepIndex, script.indexOf(find('pronunciation')));
  const completion = `[[pronunciation-complete:${find('pronunciation').interaction.clips.map(c => c.id).join(',')}]]`;
  await respondToSessionTurn({ sessionId: session._id, content: completion });
  assert.equal(session.scriptStepIndex, script.indexOf(find('example')));
  for (const [suffix, content, next] of [['teaser_23', 'quit horsing around', 'teaser_24'], ['teaser_31', 'time to kill', 'association_salt'], ['association_salt', 'pepper', 'association_knife'], ['rhyme_bread', 'head', 'five_letter']]) {
    session.scriptStepIndex = script.indexOf(find(suffix)); session.scriptStepTurnIndex = 1;
    const response = await respondToSessionTurn({ sessionId: session._id, content });
    assert.equal(response.slide.id, find(next).id);
  }
});
