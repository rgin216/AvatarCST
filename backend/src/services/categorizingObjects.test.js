import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getScript, getScriptStep } from './cstScriptService.js';
import { pairItems, oddItems, pairConnection } from './categorizingObjectsData.js';
import { evaluateCategorizingTurn } from './categorizingObjectsService.js';
import { respondToSessionTurn } from './sessionOrchestratorService.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Memory from '../models/Memory.js';
const script = getScript('cst_categorizing_objects');
const find = suffix => script.find(step => step.id === 'categorizing_objects_' + suffix);
const event = (step, action, ids) => `[[objects:${JSON.stringify({ stepId:step.id, action, ids })}]]`;
const run = (suffix, content, stored) => evaluateCategorizingTurn({step:find(suffix), content, stored});

test('Session 10 covers all 23 supplied slides and valid local routes', () => {
  assert.deepEqual([...new Set(script.map(step => step.deckSlide))].sort((a,b)=>a-b), Array.from({length:23},(_,i)=>i+1));
  assert.equal(new Set(script.map(step => step.id)).size,script.length);
  for(const [index,step] of script.entries()) {
    assert.equal(getScriptStep('cst_categorizing_objects', index).step.slideFolder,'session10');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session10/slide-${String(step.deckSlide).padStart(2,'0')}.jpg`,import.meta.url)));
    for(const target of [step.nextStepId,...Object.values(step.seasonBranches || {})].filter(Boolean)) assert.ok(script.some(s=>s.id===target),target);
  }
  assert.equal(find('opening_song').deckSlide,2);
  assert.equal(find('check_in').deckSlide,2);
  assert.equal(find('positive_news').deckSlide,13);
  assert.match(find('closing').reply({name:'Test'}),/Orientation/);
});

test('senses are three rounds of two prompts, accepting uncertainty', () => {
  const senses=script.filter(step=>step.activityKind==='senses');
  assert.equal(senses.length,3);
  assert.match(senses[0].reply(),/soft.*bitter/);
  assert.match(senses[1].reply(),/loud.*cold/);
  assert.match(senses[2].reply(),/scent.*yellow/);
  assert.equal(run('senses_soft_bitter','not sure').complete,true);
});

test('every image has a unique reachable region inside its source slide', () => {
  assert.equal(oddItems.length,13);
  assert.equal(pairItems.length,50);
  for(const items of [oddItems,pairItems]) {
    assert.equal(new Set(items.map(i=>i.id)).size,items.length);
    for(const {bounds:[x,y,w,h]} of items) assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1280&&y+h<=720);
  }
});

test('odd-one-out checks right, wrong and missed selections without advancing', () => {
  const step=find('odd_one_out');
  const result=run('odd_one_out',event(step,'check',['balloon','pizza']));
  assert.deepEqual(result.state.odd.correct,['balloon']);
  assert.deepEqual(result.state.odd.wrong,['pizza']);
  assert.equal(result.state.odd.missed.length,5);
  assert.equal(result.complete,false);
  assert.match(result.response,/non-food/);
  assert.equal(run('odd_one_out',event(step,'done'),result.state).complete,true);
});

test('pairs accept multiple uses, rooms and colours including requested examples', () => {
  for(const ids of [['comb','hairbrush'],['comb','lipstick'],['ring','earrings'],['ring','dress'],['fridge','bowl'],['gloves','ruler']]) {
    assert.ok(pairConnection(...ids.map(id=>pairItems.find(item=>item.id===id))),ids.join('/'));
  }
  const step=find('pairs');
  const first=run('pairs',event(step,'pair',['comb','hairbrush']));
  const second=run('pairs',event(step,'pair',['comb','lipstick']),first.state);
  assert.equal(second.state.pairs.length,2);
  assert.equal(second.complete,false);
  assert.match(second.response,/go together/);
  assert.equal(run('pairs',event(step,'pair',['lipstick','comb']),second.state).state.pairs.length,2);
});

test('unlisted associations invite an explanation and preserve it', () => {
  const result=run('pairs',event(find('pairs'),'pair',['ashtray','dress']));
  assert.deepEqual(result.state.pendingPair,['ashtray','dress']);
  const explained=run('pairs','They remind me of my grandmother.',result.state);
  assert.equal(explained.state.pairs[0].explained,true);
  assert.equal(explained.state.pendingPair,null);
  assert.equal(run('pairs','done',explained.state).complete,true);
});

test('malformed or stale activity events are rejected', () => {
  for(const content of ['[[objects:bad]]',event(find('odd_one_out'),'pair',['comb','hairbrush']),event(find('pairs'),'pair',['comb','comb']),event(find('pairs'),'pair',['missing','comb'])]) {
    assert.throws(()=>run('pairs',content),/Invalid object/);
  }
});

test('category and letter persist, word contributions can arrive over multiple turns', () => {
  const category=run('category','I chose animals');
  assert.equal(category.state.category,'animals');
  const letter=run('letter','bee',category.state);
  assert.equal(letter.state.letter,'B');
  assert.match(find('words').reply({categorizing:letter.state}),/animals beginning with B/);
  const words=run('words','I can think of bear and bat',letter.state);
  assert.deepEqual(words.state.words,['bear','bat']);
  assert.equal(words.complete,false);
  assert.equal(run('words',"I'm done",words.state).complete,true);
  assert.match(run('words','not sure',letter.state).response,/quite all right/);
});

function mockSession(t, suffix) {
  const step=find(suffix);
  const session={_id:'session10-test',userId:'test-user',status:'active',pipelineMode:'free',scriptId:'cst_categorizing_objects',scriptStepIndex:script.indexOf(step),scriptStepTurnIndex:1,scriptStepRetryCount:0,activityRevision:1,interactionState:{sessionAnswers:[]},save:async()=>session};
  t.mock.method(Session,'findOneAndUpdate',async()=>session);
  t.mock.method(User,'findById',()=>({lean:async()=>({_id:'test-user',name:'Test'})}));
  t.mock.method(Memory,'findOne',()=>({lean:async()=>null}));
  t.mock.method(Message,'find',()=>({sort(){return this;},limit(){return this;},lean:async()=>[{role:'assistant',content:step.reply()}]}));
  t.mock.method(Message,'create',async message=>({_id:'message',...message}));
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Activity feedback must not require a model');});
  return session;
}

test('orchestrator persists checked circles and only advances on Continue',async t=>{
  const session=mockSession(t,'odd_one_out');
  const result=await respondToSessionTurn({sessionId:session._id,content:event(find('odd_one_out'),'check',['balloon'])});
  assert.equal(result.slide.deckSlide,17);
  assert.equal(result.slide.interaction.state.odd.checked,true);
  assert.match(result.assistantText,/balloon/);
  assert.doesNotMatch(session.interactionState.sessionAnswers[0].answer,/\[\[/);
  const next=await respondToSessionTurn({sessionId:session._id,content:'done'});
  assert.equal(next.slide.deckSlide,18);
});

test('orchestrator retains pairs and keeps the slide while praising each selection',async t=>{
  const session=mockSession(t,'pairs');
  const result=await respondToSessionTurn({sessionId:session._id,content:event(find('pairs'),'pair',['ring','dress'])});
  assert.equal(result.slide.deckSlide,18);
  assert.equal(session.interactionState.categorizing.pairs.length,1);
  assert.match(result.assistantText,/go together/);
  const restored=await respondToSessionTurn({sessionId:session._id,content:''});
  assert.equal(restored.slide.interaction.state.pairs.length,1);
});

test('orchestrator asks category, then letter, then words using saved choices',async t=>{
  const session=mockSession(t,'category');
  const letter=await respondToSessionTurn({sessionId:session._id,content:'animals'});
  assert.match(letter.assistantText,/category is animals/);
  const words=await respondToSessionTurn({sessionId:session._id,content:'B'});
  assert.match(words.assistantText,/animals beginning with B/);
  const contribution=await respondToSessionTurn({sessionId:session._id,content:'bear, bat'});
  assert.equal(contribution.scriptStep.id,find('words').id);
  assert.equal(contribution.scriptStep.nextIndex,script.indexOf(find('words')));
  const finished=await respondToSessionTurn({sessionId:session._id,content:'done'});
  assert.equal(finished.slide.deckSlide,20);
});
