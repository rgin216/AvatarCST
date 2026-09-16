import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeRecorder} from './practiceRecorder.js';
import {shouldShowInputTutorial,tutorialStorageKey} from './inputTutorial.js';

function fixture({empty=false,startError=false}={}) {
  const states=[]; let stopped=0; let revoked=0; let instance; let timer;
  const stream={getTracks:()=>[{stop:()=>stopped++}]};
  class Recorder {
    static isTypeSupported(type) {return type==='audio/webm';}
    constructor(_stream,options){this.state='inactive';this.mimeType=options.mimeType;instance=this;}
    start(){if(startError)throw Error('failed');this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(empty?[]:['sample'],{type:this.mimeType})});this.onstop?.();}
  }
  const options={onChange:s=>states.push(s),mediaDevices:{getUserMedia:async()=>stream},Recorder,
    urls:{createObjectURL:()=> 'blob:practice',revokeObjectURL:()=>revoked++},
    setTimer:(callback,ms)=>{assert.equal(ms,20000);timer=callback;return 1;},clearTimer:()=>{timer=undefined;}};
  return {options,states,stream,get stopped(){return stopped;},get revoked(){return revoked;},get instance(){return instance;},timeout:()=>timer()};
}

test('practice recorder records locally, stops tracks, and revokes playback on disposal',async()=>{
  const f=fixture(); const recorder=createPracticeRecorder(f.options);
  await recorder.start();assert.equal(f.states.at(-1).status,'recording');
  recorder.stop();assert.equal(f.stopped,1);assert.deepEqual(f.states.at(-1),{status:'recorded',url:'blob:practice'});
  recorder.dispose();assert.equal(f.revoked,1);
});
test('a permission request resolving after leaving practice immediately releases its stream',async()=>{
  const f=fixture();let resolve;
  f.options.mediaDevices.getUserMedia=()=>new Promise(r=>{resolve=r;});
  const recorder=createPracticeRecorder(f.options);const pending=recorder.start();
  recorder.dispose();const count=f.states.length;resolve(f.stream);await pending;
  assert.equal(f.stopped,1);assert.equal(f.states.length,count);assert.equal(f.instance,undefined);
});
test('denied permission offers typing and a second attempt remains possible',async()=>{
  const f=fixture();f.options.mediaDevices.getUserMedia=async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'});};
  const recorder=createPracticeRecorder(f.options);await recorder.start();
  assert.equal(f.states.at(-1).status,'error');assert.match(f.states.at(-1).message,/typing/);
  f.options.mediaDevices.getUserMedia=async()=>f.stream;await recorder.start();assert.equal(f.states.at(-1).status,'recording');recorder.dispose();
});
test('practice recordings stop automatically after twenty seconds',async()=>{
  const f=fixture();const recorder=createPracticeRecorder(f.options);await recorder.start();f.timeout();
  assert.equal(f.states.at(-1).status,'recorded');assert.equal(f.stopped,1);recorder.dispose();
});
test('an empty recording is not reported as a successful microphone test',async()=>{
  const f=fixture({empty:true});const recorder=createPracticeRecorder(f.options);await recorder.start();recorder.stop();
  assert.equal(f.states.at(-1).status,'error');assert.equal(f.states.at(-1).url,undefined);recorder.dispose();
});
test('recorder setup failures release the microphone',async()=>{
  const f=fixture({startError:true});const recorder=createPracticeRecorder(f.options);await recorder.start();
  assert.equal(f.stopped,1);assert.equal(f.states.at(-1).status,'error');recorder.dispose();
});
test('unsupported browsers can continue by typing',async()=>{
  const f=fixture();const recorder=createPracticeRecorder({...f.options,Recorder:null});await recorder.start();
  assert.equal(f.states.at(-1).status,'error');assert.match(f.states.at(-1).message,/typing/);
});
test('new recordings discard the previous local recording',async()=>{
  const f=fixture();const recorder=createPracticeRecorder(f.options);await recorder.start();recorder.stop();await recorder.start();
  assert.equal(f.revoked,1);recorder.dispose();assert.equal(f.stopped,2);
});
test('practice is only shown for an unstarted session, and completion is per session',()=>{
  assert.equal(shouldShowInputTutorial({status:'pending',scriptStepIndex:0,scriptStepTurnIndex:0},false),true);
  assert.equal(shouldShowInputTutorial({status:'active',scriptStepIndex:0,scriptStepTurnIndex:1},false),false);
  assert.equal(shouldShowInputTutorial({status:'active',scriptStepIndex:2},false),false);
  for(const status of ['completed','abandoned'])assert.equal(shouldShowInputTutorial({status},false),false);
  assert.equal(shouldShowInputTutorial({status:'pending'},true),false);
  assert.notEqual(tutorialStorageKey('one'),tutorialStorageKey('two'));
});
