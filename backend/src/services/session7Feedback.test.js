import test from 'node:test';
import assert from 'node:assert/strict';
import {getScript} from './cstScriptService.js';
import {parseMatchingAnswer} from './matchingService.js';
import {classifyPictureAnswer,pictureRevealReply} from './pictureAnswerService.js';
import {evaluateImageObservationAnswer,generateSessionSummary,respondToSessionTurn} from './sessionOrchestratorService.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Memory from '../models/Memory.js';
const steps=getScript('cst_faces_scenes');
const step=steps.find(s=>s.deckSlide===17);
const encode=matches=>`[[matching:${JSON.stringify(matches)}]]`;
const wrong={'clue-0':'name-3','clue-2':'name-0','clue-3':'name-4','clue-4':'name-2'};

test('reports the incorrect and missing pairs from the latest matching conversation',()=>{
 const result=parseMatchingAnswer(step,encode(wrong));
 assert.equal(result.results.filter(r=>r.correct).length,3);
 assert.match(result.response,/King of Rock and Roll.*you chose Marilyn Monroe.*correct match is Elvis Presley/);
 assert.match(result.response,/Actress in Some Like It Hot.*missing match is Marilyn Monroe/);
 assert.equal(result.results[1].chosen,null);
 assert.doesNotMatch(result.transcript,/\[\[matching/);
});
test('rejects stale, malformed, unknown, or duplicate matching selections',()=>{
 assert.throws(()=>parseMatchingAnswer({interaction:{type:'realOrAi'}},encode(wrong)),/Invalid/);
 assert.throws(()=>parseMatchingAnswer(step,'[[matching:bad]]'),/Invalid/);
 assert.throws(()=>parseMatchingAnswer(step,encode({'clue-100':'name-0'})),/Invalid/);
 assert.throws(()=>parseMatchingAnswer(step,encode({'clue-0':'name-0','clue-1':'name-0'})),/Invalid/);
});
test('picture reveals distinguish correct, mistaken and uncertain answers without deck wording',()=>{
 assert.equal(classifyPictureAnswer('not real'),'ai');
 assert.equal(classifyPictureAnswer('Not sure'),'unsure');
 assert.equal(classifyPictureAnswer('AI generated'),'ai');
 for(const answer of ['real','ai']) {
  const right=pictureRevealReply({answer,previousAnswer:answer,random:()=>0});
  const mistaken=pictureRevealReply({answer,previousAnswer:answer==='real'?'AI generated':'Real person',random:()=>0});
  const uncertain=pictureRevealReply({answer,previousAnswer:'Not sure',random:()=>0});
  assert.match(mistaken,/technology.*fool our eyes/); assert.doesNotMatch(right,/fool our eyes/);
  assert.match(right,/You got it/); assert.match(mistaken,/actually/); assert.notEqual(uncertain,right);
  for(const reply of [right,mistaken,uncertain]) assert.doesNotMatch(reply,/deck|labels/i);
  assert.notEqual(pictureRevealReply({answer,previousAnswer:answer,recentMessages:[{role:'assistant',content:right}],random:()=>0}),right);
 }
});
test('does not endorse inferred personality and rejects an incomplete recap',async()=>{
 const response=evaluateImageObservationAnswer({step:steps.find(s=>s.id==='faces_scenes_people_different'),content:'They all are egotistic.'});
 assert.match(response.response,/cannot tell their personalities/);
 const summary=await generateSessionSummary({answers:[{stepId:'faces_scenes_match_nz',answer:'Hillary climbed Everest'}],generate:async()=> 'Today, you shared some ideas and enjoyed matching'});
 assert.match(summary,/matching descriptions to famous people\./);
});
test('speaks deterministic matching corrections before transitioning to slide 18',async(t)=>{
 const session={_id:'matching-test',userId:'test-user',status:'active',pipelineMode:'free',scriptId:'cst_faces_scenes',scriptStepIndex:steps.indexOf(step),scriptStepTurnIndex:1,scriptStepRetryCount:0,activityRevision:1,interactionState:{sessionAnswers:[]},save:async()=>session};
 t.mock.method(Session,'findOneAndUpdate',async()=>session);
 t.mock.method(User,'findById',()=>({lean:async()=>({_id:'test-user',name:'Test'})}));
 t.mock.method(Memory,'findOne',()=>({lean:async()=>null}));
 t.mock.method(Message,'find',()=>({sort(){return this;},limit(){return this;},lean:async()=>[{role:'assistant',content:step.reply()}]}));
 t.mock.method(Message,'create',async message=>({_id:'message',...message}));
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Matching must not need an LLM');});
 const result=await respondToSessionTurn({sessionId:session._id,content:encode(wrong)});
 assert.match(result.assistantText,/matched 3 correctly/);
 assert.match(result.assistantText,/Elvis Presley/);
 assert.equal(result.speechSegments[0].role,'acknowledgement');
 assert.equal(result.speechSegments[0].advanceSlideAfter,true);
 assert.equal(result.slide.deckSlide,18);
 assert.doesNotMatch(session.interactionState.sessionAnswers[0].answer,/\[\[matching/);
});

for (const echoNextQuestion of [true, false]) {
 test(`people-to-scenes transition keeps follow-ups on the current picture (echo=${echoNextQuestion})`, async(t)=>{
  const people=steps.find(s=>s.id==='faces_scenes_people_different');
  const scenes=steps.find(s=>s.id==='faces_scenes_scene_preference');
  const session={_id:'scene-test',userId:'test-user',status:'active',pipelineMode:'openai-fast-scripted',scriptId:'cst_faces_scenes',scriptStepIndex:steps.indexOf(people),scriptStepTurnIndex:1,scriptStepRetryCount:0,activityRevision:1,interactionState:{sessionAnswers:[]},save:async()=>session};
  t.mock.method(Session,'findOneAndUpdate',async()=>session);
  t.mock.method(User,'findById',()=>({lean:async()=>({_id:'test-user',name:'Test'})}));
  t.mock.method(Memory,'findOne',()=>({lean:async()=>null}));
  t.mock.method(Message,'find',()=>({sort(){return this;},limit(){return this;},lean:async()=>[{role:'assistant',content:people.reply()}]}));
  t.mock.method(Message,'create',async message=>({_id:'message',...message}));
  const oldKey=process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY='test-key';
  t.after(()=>{if(oldKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=oldKey;});
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({output_text:JSON.stringify({answered:true,response:'You noticed different clothes.',followUp:echoNextQuestion ? scenes.reply() : 'Which of those clothes would you enjoy wearing?'})})}));
  const result=await respondToSessionTurn({sessionId:session._id,content:'One is wearing black and another is wearing colourful clothes.'});
  assert.equal(result.slide.deckSlide,echoNextQuestion ? 22 : 21);
  if(echoNextQuestion){
   assert.equal(result.slideTransition.to.deckSlide,22);
   assert.equal(result.speechSegments[0].advanceSlideAfter,true);
   assert.equal(result.speechSegments[1].text,scenes.reply());
  } else {
   assert.equal(result.speechSegments[0].role, "acknowledgement");
   assert.equal(result.speechSegments[0].advanceSlideAfter, false);
   assert.equal(result.speechSegments[1].role, "script");
   assert.equal(result.slideTransition,null);
   assert.match(result.assistantText,/Which of those clothes/);
  }
 });
}
