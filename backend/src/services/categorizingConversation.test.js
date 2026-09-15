import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizeCategorizingReply } from './categorizingAcknowledgementService.js';

import { evaluateCategorizingTurn } from './categorizingObjectsService.js';
import { getScript } from './cstScriptService.js';
const step = kind => getScript('cst_categorizing_objects').find(s=>s.activityKind===kind);
const run = (kind,content,stored) => evaluateCategorizingTurn({step:step(kind),content,stored});

test('natural category and letter choices are normalized without redundant acknowledgements',()=>{
 for(const category of ['Lets choose celebrities',"Let's go with celebrities",'I would like to choose celebrities']) {
  const result=run('category',category); assert.equal(result.state.category,'celebrities'); assert.equal(result.response,'');
 }
 for(const letter of ['Lets go with B',"Let's choose B",'I choose the letter B','B, please','bee']) {
  const result=run('letter',letter); assert.equal(result.state.letter,'B'); assert.equal(result.complete,true); assert.equal(result.response,'');
 }
 assert.equal(run('letter','B or C').complete,false);
});
test('words followed by a finishing phrase acknowledge first or last names and advance',()=>{
 const result=run('words','Bradley cooper, David beckham, BIG, thats all i can name',{category:'celebrities',letter:'B'});
 assert.deepEqual(result.state.words,['Bradley cooper','David beckham','BIG']);assert.equal(result.complete,true);
 assert.match(result.response,/David beckham/);assert.doesNotMatch(result.response,/share more/);
 assert.equal(run('words','thats all i can name',{category:'celebrities',letter:'B'}).complete,true);
});
test('Continue does not repeat the checked non-food answers',()=>{
 const result=run('odd','done',{odd:{checked:true}});assert.equal(result.response,'');assert.equal(result.complete,true);
});
test('sensory acknowledgement is grounded and retains fallback on failure',async()=>{
 const turn=run('senses','my bed pillow'); assert.match(turn.response,/pillow.*soft and plush/);
 const enhanced=await personalizeCategorizingReply(turn,{generate:async messages=>{assert.match(messages[1].content,/bed pillow/);return 'Ah yes, a pillow feels soft beneath your head.';}});
 assert.match(enhanced.response,/pillow feels soft/);assert.equal(enhanced.complete,true);
 assert.equal((await personalizeCategorizingReply(turn,{generate:async()=>{throw Error('offline');}})).response,turn.response);
});
test('a personal pair explanation is affirmed specifically',async()=>{
 const turn=run('pairs','both remind me of my grandmother',{pendingPair:['ashtray','dress']});
 assert.match(turn.response,/Yes, I see.*grandmother/);
 const enhanced=await personalizeCategorizingReply(turn,{generate:async()=> 'Yes, both bring back memories of your grandmother.'});
 assert.match(enhanced.response,/Yes, both bring back memories/);assert.equal(enhanced.state.pairs.length,1);
});
test('category requests strip first-person wording and category suffixes',()=>{
 for(const text of ["I'll choose the peach as a category.","I will choose peach for my category.","I’ll choose the peach as the category."]){assert.equal(run('category',text).state.category,'peach');}
 assert.equal(run('letter',"Let's go with S.").state.letter,'S');
 assert.equal(run('category','I choose the category').complete,false);
});

test('nested spoken framing leaves only the category and preserves multiword topics',()=>{
 for(const text of ["I think I'll choose beach as my category.","Well, I think I’ll choose beach as my category.","I guess I'll go with beach.","Maybe lets choose beach.","I think ill choose beach"]){
  assert.equal(run('category',text).state.category,'beach',text);
 }
 assert.equal(run('category',"I think I'll choose New Zealand beaches as my category.").state.category,'New Zealand beaches');
 assert.equal(run('letter',"Let's go with S.",{category:"I think I'll choose beach"}).state.category,'beach');
});
