import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getScript, getScriptStep } from './cstScriptService.js';
import { evaluateTriviaAnswer } from './sessionOrchestratorService.js';
import { teamQuizQuestions, tallyTeamQuiz, teamQuizScoreReply } from './teamQuizService.js';

const script = getScript('cst_team_quiz');
const questions = script.filter(s => s.trivia);

test('Session 15 includes the complete source quiz and valid shared opening, media and routes', () => {
  assert.match(script[0].reply({ name: 'Test' }), /Session 15/);
  assert.equal(questions.length, 20);
  assert.deepEqual([...new Set(questions.map(s => s.deckSlide))], [16, 17, 18, 19]);
  assert.ok(questions.some(s => s.interaction.type === 'choiceQuestion'));
  assert.ok(questions.some(s => s.interaction.type === 'focusedQuestion'));
  assert.equal(script.find(s => s.id === 'team_quiz_theme_intro').deckSlide, 15);
  assert.equal(script.find(s => s.id === 'team_quiz_feedback').deckSlide, 27);
  for (const [index, step] of script.entries()) {
    assert.equal(getScriptStep('cst_team_quiz', index).step.slideFolder, 'session15');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session15/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`, import.meta.url)));
    for (const id of [...Object.values(step.seasonBranches || {}), ...(step.nextStepId ? [step.nextStepId] : [])]) assert.ok(script.some(s => s.id === id), id);
  }
});

test('all source answers, tap values and spoken option letters earn credit consistently', () => {
  for (const [i, step] of questions.entries()) {
    const q = teamQuizQuestions[i];
    const inputs = [q.answer, ...q.aliases];
    if (q.options) inputs.push(q.options[q.options.indexOf(q.answer)], `option ${'ABC'[q.options.indexOf(q.answer)]}`);
    for (const content of inputs) {
      assert.equal(evaluateTriviaAnswer({ step, content }).outcome, 'correct', `${q.id}: ${content}`);
      assert.equal(tallyTeamQuiz([{ stepId: step.id, answer: content }]).correct, 1);
    }
    for (const content of ['I am not sure', 'I would like to pass', 'a completely different answer']) {
      assert.notEqual(evaluateTriviaAnswer({ step, content }).outcome, 'correct');
      assert.equal(tallyTeamQuiz([{ stepId: step.id, answer: content }]).correct, 0);
    }
  }
});

test('open answers accept conversational alternatives and reject negated answers', () => {
  for (const [number, content] of [[6, 'I think it is Mount Cook'], [11, 'A B B A'], [12, 'Elvis'], [13, 'The Bee Gees'], [18, 'a deep freezer'], [19, 'Platinum'], [20, 'A filly']]) {
    assert.equal(evaluateTriviaAnswer({ step: questions[number - 1], content }).outcome, 'correct', content);
  }
  assert.equal(evaluateTriviaAnswer({ step: questions[11], content: 'It is not Elvis' }).outcome, 'incorrect');
});

test('score counts each quiz question once and excludes orientation, feedback and memories', () => {
  const answers = questions.map(s => ({ stepId: s.id, answer: s.trivia.answer }));
  assert.deepEqual(tallyTeamQuiz([...answers, ...answers, { stepId: 'team_quiz_orientation_day', answer: 'Monday' }]), { correct: 20, total: 20, attempted: 20 });
  const mixed = answers.map((a, i) => ({ ...a, answer: i < 7 ? a.answer : 'I would like to pass' }));
  assert.deepEqual(tallyTeamQuiz(mixed), { correct: 7, total: 20, attempted: 20 });
  assert.equal(tallyTeamQuiz([{ ...answers[0], quizOutcome: 'unsure' }]).correct, 0);
  for (const rows of [[], mixed, answers]) {
    const score = teamQuizScoreReply(rows);
    assert.match(score, /out of 20/);
    assert.match(score, /Wonderful|Well done|worth celebrating/);
    assert.doesNotMatch(script.at(-1).reply({ name: 'Test', sessionAnswers: rows }), /out of 20/);
  }
});

test('session flow retains scored answers and includes the final answer in the announced tally', async t => {
  const { respondToSessionTurn } = await import('./sessionOrchestratorService.js');
  const { default: Session } = await import('../models/Session.js');
  const { default: User } = await import('../models/User.js');
  const { default: Memory } = await import('../models/Memory.js');
  const { default: Message } = await import('../models/Message.js');
  const priorKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.after(() => { if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey; });
  const session = { _id: 'team-quiz-test', userId: 'test', status: 'active', pipelineMode: 'free', scriptId: 'cst_team_quiz', scriptStepIndex: script.indexOf(questions[0]), scriptStepTurnIndex: 1, scriptStepRetryCount: 0, activityRevision: 1, interactionState: { sessionAnswers: [] }, save: async () => session };
  t.mock.method(Session, 'findOneAndUpdate', async () => session);
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ _id: 'test', name: 'Test' }) }));
  t.mock.method(Memory, 'findOne', () => ({ lean: async () => ({ entries: [] }) }));
  t.mock.method(Message, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [{ role: 'assistant', content: 'Try this question.' }] }));
  t.mock.method(Message, 'create', async value => ({ _id: 'message', ...value }));
  t.mock.method(globalThis, 'fetch', async () => {
    const content = '{"answered":true,"response":"Thank you for sharing.","followUp":null}';
    return Response.json({ output_text: content, choices: [{ message: { content } }] });
  });
  let response;
  for (const [i, question] of questions.entries()) {
    assert.equal(session.scriptStepIndex, script.indexOf(question));
    response = await respondToSessionTurn({ sessionId: session._id, content: i < 19 ? 'I would like to pass' : 'a filly' });
  }
  assert.equal(response.slide.id, 'team_quiz_score');
  assert.match(JSON.stringify(response.messages), /1 out of 20/);
  assert.equal(session.interactionState.sessionAnswers.length, 20);
  assert.equal(session.interactionState.sessionAnswers.at(-1).quizOutcome, 'correct');
  assert.equal(tallyTeamQuiz(session.interactionState.sessionAnswers).correct, 1);
  response = await respondToSessionTurn({ sessionId: session._id, content: '[[auto-advance]]' });
  assert.equal(response.slide.id, 'team_quiz_spin_question');
  assert.equal(tallyTeamQuiz(session.interactionState.sessionAnswers).correct, 1);

  // Resume at the shared recap, then follow every remaining step. The recap
  // normally discards answers; this session must keep its scored record.
  session.scriptStepIndex = script.findIndex(s => s.id === 'team_quiz_summary_song');
  session.scriptStepTurnIndex = 1;
  response = await respondToSessionTurn({ sessionId: session._id, content: 'Done' });
  assert.match(response.assistantText, /What was one part you enjoyed/);
  assert.doesNotMatch(response.assistantText, /out of 20/);
  response = await respondToSessionTurn({ sessionId: session._id, content: 'The music questions' });
  assert.equal(response.slide.id, 'team_quiz_feedback');
  assert.match(response.assistantText, /completed 15 sessions.*done wonderfully/);
  assert.equal(tallyTeamQuiz(session.interactionState.sessionAnswers).correct, 1);
  for (let i = 0; i < 5; i += 1) {
    response = await respondToSessionTurn({ sessionId: session._id, content: 'I would like to pass' });
    assert.doesNotMatch(response.assistantText, /out of 20/);
  }
  assert.equal(response.slide.id, 'team_quiz_closing');
  assert.equal(response.sessionCompleteAfterResponse, true);
  assert.equal(tallyTeamQuiz(session.interactionState.sessionAnswers).correct, 1);
});


test('rounds start naturally and the score is announced only at the score step', () => {
  assert.match(questions[0].reply(), /Our first round is General Knowledge/);
  assert.doesNotMatch(questions[0].reply(), /next round/);
  assert.match(questions[5].reply(), /Our next round is New Zealand/);
  const context = { name: 'Test', sessionAnswers: questions.slice(0, 9).map(s => ({ stepId: s.id, answer: s.trivia.answer })) };
  assert.match(script.find(s => s.id === 'team_quiz_score').reply(context), /9 out of 20/);
  assert.doesNotMatch(script.find(s => s.id === 'team_quiz_summary_song').followUps[0](context), /out of 20/);
  assert.doesNotMatch(script.at(-1).reply(context), /out of 20/);
  assert.match(script.find(s => s.id === 'team_quiz_feedback').reply(context), /completed 15 sessions.*done wonderfully.*How have our sessions made you feel/);
  assert.doesNotMatch(script.find(s => s.id === 'team_quiz_feedback_2').reply(context), /completed 15 sessions/);
});

test('accepted alternatives are named in positive feedback', () => {
  for (const [number, content, expected] of [
    [14, 'Nightwing', /Nightwing/], [14, 'Dick Grayson', /Dick Grayson/],
    [19, 'I think platinum', /Platinum/], [19, 'silver', /Silver/],
    [20, 'a filly', /filly.*young female horse/], [20, 'colt', /colt.*young male horse/],
  ]) {
    const result = evaluateTriviaAnswer({ step: questions[number - 1], content });
    assert.equal(result.outcome, 'correct');
    assert.match(result.response, expected);
    if (number === 19 && /platinum|silver/i.test(content)) assert.doesNotMatch(result.response, /gold/i);
  }
});

test('correct, incorrect and unsure acknowledgements vary between questions', () => {
  for (const kind of ['correct', 'incorrect', 'unsure']) {
    const openings = questions.map(step => {
      const content = kind === 'correct' ? step.trivia.answer : kind === 'incorrect' ? 'a different answer' : 'I am not sure';
      const result = evaluateTriviaAnswer({ step, content });
      assert.equal(result.outcome, kind);
      return result.response.split(/[.!:]/)[0];
    });
    assert.ok(new Set(openings).size >= 5, kind);
    for (let i = 1; i < openings.length; i += 1) assert.notEqual(openings[i], openings[i - 1], kind);
  }
});

test('negation applies to its clause while affirmed alternatives earn credit', () => {
  const step = questions[18];
  for (const content of ['not gold, platinum', 'not gold but platinum', 'platinum, not gold', 'not gold; silver', 'not platinum, gold']) {
    assert.equal(evaluateTriviaAnswer({ step, content }).outcome, 'correct', content);
    assert.equal(tallyTeamQuiz([{ stepId: step.id, answer: content }]).correct, 1, content);
  }
  for (const content of ['not gold', 'not platinum', 'it is not gold', 'gold is not right', 'not gold or platinum', 'not gold, or platinum', 'not gold, not platinum', 'not gold, copper']) {
    assert.equal(evaluateTriviaAnswer({ step, content }).outcome, 'incorrect', content);
    assert.equal(tallyTeamQuiz([{ stepId: step.id, answer: content }]).correct, 0, content);
  }
  assert.match(evaluateTriviaAnswer({ step, content: 'not gold, platinum' }).response, /Platinum/);
  assert.doesNotMatch(evaluateTriviaAnswer({ step, content: 'not platinum, gold' }).response, /Platinum/);
  assert.equal(evaluateTriviaAnswer({ step: questions[0], content: 'not China, option A' }).outcome, 'correct');
});
