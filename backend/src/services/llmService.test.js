import test from 'node:test';
import assert from 'node:assert/strict';

import { generateResponse } from './llmService.js';

test('requests visible low-reasoning output from GPT-OSS on Groq', async (t) => {
  let requestBody;

  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: 'That sounds like a lovely memory.' },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const response = await generateResponse(
    [{ role: 'user', content: 'I enjoyed walking by the beach.' }],
    { provider: 'groq', temperature: 0.4, maxTokens: 60 }
  );

  assert.equal(response, 'That sounds like a lovely memory.');
  assert.equal(requestBody.model, 'openai/gpt-oss-120b');
  assert.equal(requestBody.max_completion_tokens, 512);
  assert.equal(requestBody.max_tokens, undefined);
  assert.equal(requestBody.reasoning_effort, 'low');
  assert.equal(requestBody.include_reasoning, false);
});

test('retries truncated Groq output and returns only the complete replacement', async (t) => {
  const budgets = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    budgets.push(JSON.parse(options.body).max_completion_tokens);
    return new Response(JSON.stringify({choices:[{finish_reason:budgets.length === 1 ? 'length' : 'stop',message:{content:budgets.length === 1 ? 'Your pairing of Marilyn and' : 'Elvis Presley is the King of Rock and Roll.'}}]}), {status:200});
  });
  assert.equal(await generateResponse([{role:'user',content:'My match'}],{maxTokens:60}), 'Elvis Presley is the King of Rock and Roll.');
  assert.deepEqual(budgets,[512,1024]);
});

test('never returns a fragment if the larger Groq retry is also truncated', async (t) => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;
    return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'Today you enjoyed matching'}}]}),{status:200});
  });
  await assert.rejects(generateResponse([{role:'user',content:'Summarise'}]),/complete response/);
  assert.equal(calls,2);
});
