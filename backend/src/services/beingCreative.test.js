import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getScript, getScriptPreparation, getScriptStep, renderScriptReply } from './cstScriptService.js';
import {
  buildInactivityReminderText,
  buildTopicSessionSummary,
  getSessionInactivityReminder,
  removePacingReassurance,
  respondToSessionTurn,
} from './sessionOrchestratorService.js';
import { buildCstAdaptiveResponseInstructions } from './promptService.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import Message from '../models/Message.js';

const script = getScript('cst_being_creative');
const find = (suffix) => script.find((step) => step.id === `being_creative_${suffix}`);
const PACING = /take your time|no rush|no hurry/i;

test('Session 9 script lines up with its markdown sections and exported slides', () => {
  assert.equal(script.length, 29);
  const md = readFileSync(new URL('../../context/vCST_Session9_AI_Script.md', import.meta.url), 'utf8');
  const sections = md.split(/\r?\n---\r?\n/).map((s) => s.trim()).filter(Boolean);
  assert.equal(sections.length, script.length + 1);

  // Several steps share a content slide, but every slide 1-26 is used and none is skipped.
  assert.deepEqual([...new Set(script.map((step) => step.deckSlide))], Array.from({ length: 26 }, (_, i) => i + 1));
  for (const [index, step] of script.entries()) {
    assert.equal(getScriptStep('cst_being_creative', index).step.slideFolder, 'session9');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session9/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`, import.meta.url)), step.id);
    for (const id of [...Object.values(step.seasonBranches || {}), ...(step.nextStepId ? [step.nextStepId] : [])]) {
      assert.ok(script.some((candidate) => candidate.id === id), id);
    }
  }
  assert.match(script[0].reply({ name: 'Test' }), /ninth session.*pen and some paper/);
  assert.match(script.at(-1).reply({ name: 'Test' }), /Categorizing Objects/);
});

test('a fresh Session 9 asks for a pen and paper before it starts', () => {
  const preparation = getScriptPreparation('cst_being_creative');
  assert.match(preparation.message, /pen and some paper/);
  assert.equal(getScriptPreparation('cst_number_games'), null);
});

test('the drawing slide never tells the participant to take their time', () => {
  const drawingSteps = script.filter((step) => step.deckSlide === 23);
  assert.deepEqual(drawingSteps.map((step) => step.id), [
    'being_creative_draw_house',
    'being_creative_house_favourite_part',
    'being_creative_home_memory',
  ]);
  for (const step of drawingSteps) {
    assert.equal(step.avoidPacingReassurance, true, step.id);
    assert.doesNotMatch(renderScriptReply(step, { name: 'Test' }), PACING, step.id);
  }
  assert.equal(find('draw_house').interaction.type, 'offscreenTask');
  assert.match(find('draw_house').interaction.doneLabel, /finished my drawing/);
  // The follow-ups keep their reminder, without the "take your time" opener.
  assert.equal(
    buildInactivityReminderText('What is your favourite part of your house?', find('house_favourite_part').inactivityReminderLead),
    'What is your favourite part of your house? If you cannot think of an answer, feel free to say or type, "I don\'t know."'
  );
  assert.match(buildInactivityReminderText('How are you?'), /^Take your time; there is no rush\./);
});

test('pacing reassurance is removed sentence by sentence', () => {
  assert.equal(removePacingReassurance('What a lovely house. Take your time with it.'), 'What a lovely house.');
  assert.equal(removePacingReassurance('No rush at all! A seaside cottage sounds perfect.'), 'A seaside cottage sounds perfect.');
  assert.equal(removePacingReassurance('Take your time.'), '');
  assert.equal(removePacingReassurance('A big garden would be timeless.'), 'A big garden would be timeless.');
});

test('paintings share their title and artist after any reaction, never before', () => {
  for (const suffix of ['scream', 'dali', 'picasso']) {
    const step = find(suffix);
    assert.ok(step.revealFact, suffix);
    assert.doesNotMatch(renderScriptReply(step, {}), /Munch|Dalí|Picasso|Persistence|Three Musicians|The Scream/, suffix);
  }
  const slide = { index: script.indexOf(find('dali')), title: 'The Persistence of Memory', prompt: 'What would you call this painting?' };
  const withFact = buildCstAdaptiveResponseInstructions({
    slide, scriptId: 'cst_being_creative', recentMessages: [], revealFact: find('dali').revealFact,
  });
  assert.match(withFact, /# Fact To Share[\s\S]*runny Camembert/);
  assert.match(withFact, /Maximum 3 sentences/);
  const repeating = buildCstAdaptiveResponseInstructions({
    slide, scriptId: 'cst_being_creative', recentMessages: [], revealFact: find('dali').revealFact, answerState: 'repeat_question',
  });
  assert.doesNotMatch(repeating, /Fact To Share/);
  assert.match(repeating, /Maximum 1 sentence/);
});

test('the recap names the Session 9 activities', () => {
  const recap = buildTopicSessionSummary([
    { stepId: 'being_creative_dali', answer: 'Melting Time' },
    { stepId: 'being_creative_love', answer: 'They want to make up' },
    { stepId: 'being_creative_house_favourite_part', answer: 'The big veranda' },
  ]);
  assert.match(recap, /famous paintings/);
  assert.match(recap, /thought-provoking art/);
  assert.match(recap, /dream house/);
});

const mockSession = (t, llmReply) => {
  const session = {
    _id: 'being-creative-test', userId: 'test', status: 'active', pipelineMode: 'free', scriptId: 'cst_being_creative',
    scriptStepIndex: 0, scriptStepTurnIndex: 1, scriptStepRetryCount: 0, activityRevision: 1,
    interactionState: { sessionAnswers: [] }, save: async () => session,
  };
  t.mock.method(Session, 'findOneAndUpdate', async () => session);
  t.mock.method(Session, 'updateOne', async () => ({}));
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ _id: 'test', name: 'Test' }) }));
  t.mock.method(Memory, 'findOne', () => ({ lean: async () => ({ entries: [] }) }));
  t.mock.method(Message, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [{ role: 'assistant', content: 'Have a go.' }] }));
  t.mock.method(Message, 'create', async (value) => ({ _id: 'message', ...value }));
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ status: 'completed', output_text: llmReply }) }));
  return {
    session,
    at: (suffix) => Object.assign(session, { scriptStepIndex: script.indexOf(find(suffix)), scriptStepTurnIndex: 1, scriptStepRetryCount: 0 }),
  };
};

test('finishing the drawing moves on without any take-your-time line', async (t) => {
  const { session, at } = mockSession(t, 'What a lovely thing to draw. Take your time.');
  at('draw_house');
  const response = await respondToSessionTurn({ sessionId: session._id, content: 'I have finished my drawing.' });
  assert.equal(response.slide.id, find('house_favourite_part').id);
  assert.equal(response.assistantText, 'What a lovely thing to draw. What is your favourite part of your house?');
});

test('naming the Dalí painting asks Aria to share its real title afterwards', async (t) => {
  const { session, at } = mockSession(t, 'Melting Time is a great title. Dalí called it The Persistence of Memory.');
  at('dali');
  const response = await respondToSessionTurn({ sessionId: session._id, content: 'Melting Time' });
  assert.equal(response.slide.id, find('picasso').id);
  const prompts = globalThis.fetch.mock.calls.map((call) => String(call.arguments[1]?.body || ''));
  assert.ok(prompts.some((body) => /Fact To Share/.test(body) && /Camembert/.test(body)));
  assert.match(response.assistantText, /^Melting Time is a great title\. Dalí called it The Persistence of Memory\. And here are three musicians\./);
});

test('the drawing step has no inactivity reminder', async (t) => {
  const { session, at } = mockSession(t, 'Lovely.');
  at('draw_house');
  await assert.rejects(getSessionInactivityReminder(session._id, 1), { status: 409 });
});
