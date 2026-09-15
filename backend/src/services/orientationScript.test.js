import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getScript, getScriptStep } from './cstScriptService.js';
import { evaluateTriviaAnswer, evaluateOrientationAnswer, buildTopicSessionSummary } from './sessionOrchestratorService.js';

const script = getScript('cst_orientation');
const find = (suffix) => script.find(step => step.id === `orientation_${suffix}`);

test('Session 11 covers all slides, preserves shared opening routes, and has aligned guidance', () => {
  assert.deepEqual([...new Set(script.map(step => step.deckSlide))], Array.from({length:27}, (_,i)=>i+1));
  assert.equal(new Set(script.map(step=>step.id)).size, script.length);
  const sections = readFileSync(new URL('../../context/vCST_Session11_AI_Script.md', import.meta.url), 'utf8').split(/\r?\n---\r?\n/);
  assert.equal(sections.length, script.length + 1);
  for (const [index,step] of script.entries()) {
    assert.ok(sections[index+1].includes(step.id), step.id);
    assert.equal(getScriptStep('cst_orientation', index).step.slideFolder, 'session11');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session11/slide-${String(step.deckSlide).padStart(2,'0')}.jpg`, import.meta.url)));
    for (const target of [step.nextStepId, ...Object.values(step.seasonBranches || {})].filter(Boolean)) assert.ok(script.some(step=>step.id===target));
  }
  assert.equal(find('check_in').deckSlide, 2);
  assert.equal(find('positive_news').deckSlide, 13);
  assert.equal(find('exercise').deckSlide, 14);
  assert.equal(find('theme_intro').deckSlide, 15);
  assert.equal(find('opening_song').interaction.type, 'spotifySong');
  assert.equal(find('summary_song').interaction.summarizeOnComplete, true);
  assert.equal(find('closing').autoCompleteAfterNarration, true);
  assert.match(find('closing').reply({name:'Test'}), /Using Money/);
  const year = new Intl.DateTimeFormat('en-NZ',{year:'numeric',timeZone:'Pacific/Auckland'}).format(new Date());
  assert.equal(find('orientation_year_reveal').title, year);
  assert.equal(evaluateOrientationAnswer({step:find('orientation_year'),content:year,retryCount:0}).outcome,'correct');
});

test('every landmark accepts its dropdown option, letters, and spoken aliases including macrons', () => {
  const questions = script.filter(step=>step.trivia);
  assert.equal(questions.length, 10);
  for (const step of questions) {
    assert.equal(step.turns, 1);
    assert.equal(step.adaptiveFollowUp, undefined);
    assert.equal(step.interaction.type, 'choiceQuestion');
    for (const [index,option] of step.trivia.choices.entries()) {
      for (const content of [option, 'ABC'[index], `option ${'abc'[index]}`]) {
        assert.equal(evaluateTriviaAnswer({step,content}).outcome, option === step.trivia.answer ? 'correct' : 'incorrect', step.id + ': ' + content);
      }
    }
    for (const content of step.trivia.aliases) assert.equal(evaluateTriviaAnswer({step,content}).outcome,'correct', content);
    const unsure = evaluateTriviaAnswer({step,content:'I am not sure'});
    assert.equal(unsure.outcome,'unsure');
    assert.ok(unsure.response.includes(step.trivia.answer));
    assert.equal(evaluateTriviaAnswer({step,content:'D'}).outcome, 'incorrect');
  }
});

test('slides 19 and 20 ask focused questions with no added adaptive follow-up', () => {
  const sensory = script.filter(step=>step.deckSlide===19);
  const neighbourhood = script.filter(step=>step.deckSlide===20);
  assert.equal(sensory.length,6);
  assert.equal(neighbourhood.length,6);
  for (const step of [...sensory,...neighbourhood]) {
    assert.equal(step.turns,1);
    assert.equal(step.acceptAnyAnswer,true);
    assert.equal(step.adaptiveFollowUp,undefined);
    assert.equal(step.followUps,undefined);
    assert.equal(step.interaction.type,'focusedQuestion');
    assert.ok((step.reply().match(/\?/g)||[]).length <= 2);
  }
  for (const sense of ['see','smell','hear','taste','touch']) assert.ok(find(`sensory_${sense}`));
  assert.match(find('neighbour_footpaths').reply(), /both sides.*smooth or cracked/);
});

test('Session 11 recap reflects only activities actually covered', () => {
  const summary = buildTopicSessionSummary([{stepId:'orientation_sensory_see',answer:'Trees and the sea'}]);
  assert.match(summary, /favourite place/);
  assert.doesNotMatch(summary, /landmarks|neighbourhood/);
});


test('Session 11 answers advance exactly one question and retain the correct deck slide', async (t) => {
  const [{default:Session},{default:User},{default:Memory},{default:Message},{respondToSessionTurn}] = await Promise.all([
    import('../models/Session.js'),import('../models/User.js'),import('../models/Memory.js'),import('../models/Message.js'),import('./sessionOrchestratorService.js')
  ]);
  const session = { _id:'orientation-test', userId:'orientation-user', status:'active', pipelineMode:'free', scriptId:'cst_orientation',
    scriptStepIndex:script.indexOf(find('landmark_17_1')), scriptStepTurnIndex:1, scriptStepRetryCount:0, activityRevision:1,
    interactionState:{sessionAnswers:[]}, save:async()=>session };
  t.mock.method(Session,'findOneAndUpdate',async()=>session);
  t.mock.method(User,'findById',()=>({lean:async()=>({_id:session.userId,name:'Test'})}));
  t.mock.method(Memory,'findOne',()=>({lean:async()=>null}));
  t.mock.method(Message,'find',()=>({sort(){return this},limit(){return this},lean:async()=>[{role:'assistant',content:script[session.scriptStepIndex].reply({})}]}));
  t.mock.method(Message,'create',async(message)=>({_id:'test-message',...message}));
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({choices:[{message:{content:'Thank you for sharing.'}}]})}));
  for (const [suffix,content,next] of [
    ['landmark_17_1','B','landmark_17_2'],
    ['landmark_17_5','I am not sure','landmark_18_1'],
    ['sensory_see','Trees and the sea','sensory_smell'],
    ['neighbour_colour','I would like to pass','neighbour_block'],
  ]) {
    session.scriptStepIndex=script.indexOf(find(suffix));
    session.scriptStepTurnIndex=1;
    session.interactionState={sessionAnswers:[]};
    const response=await respondToSessionTurn({sessionId:session._id,content});
    assert.equal(session.scriptStepIndex,script.indexOf(find(next)),suffix);
    assert.equal(response.slide.id,find(next).id);
    assert.equal(response.slide.deckSlide,find(next).deckSlide);
    assert.equal(response.slide.interaction.type,find(next).interaction.type);
  }
});
