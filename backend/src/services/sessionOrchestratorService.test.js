import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionSummary,
  buildNewsElaboration,
  canRequestAdaptiveFollowUp,
  isMusicCompletionAnswer,
  isNewsElaborationRequest,
  isVideoCompletionAnswer,
  parseAdaptiveTurn,
  toSecondPersonSummaryClause,
} from './sessionOrchestratorService.js';
import { buildCstAdaptiveTurnInstructions } from './promptService.js';
import { getScriptStep, renderScriptFollowUp } from './cstScriptService.js';

test('recognises button, typed, and spoken music completion answers', () => {
  for (const answer of [
    '[[music-complete]]',
    'Done',
    'I am finished',
    'done listening',
    'skip',
    'no thanks',
    'ready to continue',
  ]) {
    assert.equal(isMusicCompletionAnswer(answer), true, answer);
  }

  assert.equal(isMusicCompletionAnswer('I like this song'), false);
});

test('recognises button, typed, and spoken video completion answers', () => {
  for (const answer of [
    '[[video-complete]]',
    'Done',
    'I am finished',
    'skip',
    'no thanks',
  ]) {
    assert.equal(isVideoCompletionAnswer(answer), true, answer);
  }

  assert.equal(isVideoCompletionAnswer('This exercise is gentle'), false);
});

test('recognises requests for more news and elaborates only from vetted details', () => {
  assert.equal(isNewsElaborationRequest('Can you tell me more?'), true);
  assert.equal(isNewsElaborationRequest('That sounds nice'), false);

  assert.equal(
    buildNewsElaboration({
      status: 'available',
      article: {
        title: 'Community celebrates conservation milestone',
        description: 'Volunteers welcomed native birds back.',
        content: 'The sanctuary recorded its highest number of returning birds this year.',
      },
    }),
    'The report adds: The sanctuary recorded its highest number of returning birds this year.'
  );
  assert.match(buildNewsElaboration({ status: 'unavailable' }), /do not have a vetted story/i);
});

test('keeps the music and summary as separate one-minute turns', () => {
  const { step } = getScriptStep('cst_childhood', 18);
  const summary = renderScriptFollowUp(step, 0, {
    sessionSummary: 'Today, you remembered Sunday lunches with your family.',
  });

  assert.equal(step.turns, 2);
  assert.equal(step.interaction.playbackSeconds, 60);
  assert.doesNotMatch(step.reply({ themeSong: null }), /Today, you/);
  assert.match(summary, /Sunday lunches/);
  assert.match(summary, /like to remember/);
});

test('converts first-person answers into clean second-person clauses', () => {
  assert.equal(
    toSecondPersonSummaryClause('I loved accounting because I was good at numbers.'),
    'you loved accounting because you were good at numbers'
  );
  assert.equal(
    toSecondPersonSummaryClause('I was a checkout operator at Woolworths.'),
    'you were a checkout operator at Woolworths'
  );
});

test('builds a natural summary without embedding first-person answers', () => {
  const summary = buildSessionSummary([
    {
      stepId: 'childhood_parents',
      answer: 'Their names were John and Mary.',
    },
    {
      stepId: 'childhood_siblings',
      answer: 'I have one sister.',
    },
    {
      stepId: 'childhood_school',
      answer: 'I loved accounting because I was good at numbers.',
    },
    {
      stepId: 'childhood_first_job',
      answer: 'I was a checkout operator at a supermarket called Woolworths.',
    },
    {
      stepId: 'childhood_modern_family',
      answer: 'I think families have become more flexible.',
    },
    {
      stepId: 'childhood_spin_question',
      answer: 'I studied as a software engineer and now work at Deloitte.',
    },
  ]);

  assert.equal(
    summary,
    "Today, you shared your parents' names, you talked about brothers or sisters, you loved accounting because you were good at numbers, you were a checkout operator at a supermarket called Woolworths, you think families have become more flexible, and you studied as a software engineer and now work at Deloitte."
  );
  assert.doesNotMatch(summary, /\byou (?:remembered|mentioned) I\b/i);
  assert.doesNotMatch(summary, /\.\./);
});

test('prefers a richer adaptive follow-up memory in the session summary', () => {
  const summary = buildSessionSummary([
    {
      stepId: 'childhood_spin_question',
      answer: 'Food',
      adaptiveFollowUp: {
        question: 'What kind of food did you especially enjoy?',
        answer: 'My grandmother made roast lamb, and the smell filled the whole house.',
      },
    },
  ]);

  assert.equal(
    summary,
    'Today, you remembered how your grandmother made roast lamb, and the smell filled the whole house.'
  );
});

test('parses one bounded adaptive follow-up from the turn decision', () => {
  const turn = parseAdaptiveTurn(JSON.stringify({
    answered: true,
    response: 'Food can hold such strong childhood memories.',
    followUp: 'What kind of food did you especially enjoy? Why was it special?',
  }));

  assert.deepEqual(turn, {
    answered: true,
    response: 'Food can hold such strong childhood memories.',
    followUp: 'What kind of food did you especially enjoy?',
  });
});

test('does not retain a follow-up from an unanswered turn', () => {
  const turn = parseAdaptiveTurn(JSON.stringify({
    answered: false,
    response: 'No problem.',
    followUp: null,
  }));

  assert.equal(turn.answered, false);
  assert.equal(turn.followUp, null);
});

test('allows at most one adaptive follow-up after scripted turns are complete', () => {
  const step = {
    turns: 2,
    adaptiveFollowUp: {
      enabled: true,
      guidance: 'Explore one school memory.',
    },
  };

  assert.equal(canRequestAdaptiveFollowUp({
    step,
    effectiveTurnIndex: 1,
  }), false);
  assert.equal(canRequestAdaptiveFollowUp({
    step,
    effectiveTurnIndex: 2,
  }), true);
  assert.equal(canRequestAdaptiveFollowUp({
    step,
    effectiveTurnIndex: 2,
    hasActiveFollowUp: true,
  }), false);
});

test('requires a null follow-up on steps where adaptive depth is disabled', () => {
  const prompt = buildCstAdaptiveTurnInstructions({
    user: { name: 'Test User' },
    memoryEntries: [],
    slide: {
      index: 3,
      title: 'What day of the week is it?',
      prompt: 'What day of the week is it?',
    },
    recentMessages: [],
    scriptId: 'cst_childhood',
    expectedQuestion: 'What day of the week is it?',
    allowFollowUp: false,
  });

  assert.match(prompt, /No adaptive follow-up is allowed/);
  assert.match(prompt, /"followUp":null/);
  assert.doesNotMatch(prompt, /"followUp":"What made that especially memorable/);
});
