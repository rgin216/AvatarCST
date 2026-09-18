import test from 'node:test';
import assert from 'node:assert/strict';
import { fitObjectBoard } from './objectBoardLayout.js';
test('board maximises available space without cropping at wide, square and portrait ratios',()=>{
 for(const [width,height] of [[2559,1260],[2560,1080],[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[844,390],[320,568]]){
  const size=fitObjectBoard(width,height);
  assert.ok(size.width<=width && size.height<=height+0.001);
  assert.ok(Math.abs(size.width/size.height-16/9)<0.001);
  assert.ok(Math.abs(size.width-width)<0.001 || Math.abs(size.height-height)<0.001);
 }
});
