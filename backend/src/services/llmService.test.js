import test from 'node:test';
import assert from 'node:assert/strict';

import { generateResponse } from './llmService.js';

test('per-call model selection isolates concurrent requests and preserves judge JSON', async (t) => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    bodies.push(body);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"script_adherence":5,"evidence":"**exact**"}' } }] });
  });
  const results = await Promise.all(['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'].map(model =>
    generateResponse([{ role: 'user', content: 'Return JSON' }], { provider: 'groq', model, json: true })));
  assert.deepEqual(bodies.map(b => b.model), ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
  assert.equal(bodies[1].reasoning_effort, 'none');
  assert.equal(bodies[1].response_format.type, 'json_object');
  assert.equal(JSON.parse(results[0]).evidence, '**exact**');
});

test('rejects unknown providers instead of silently using Groq', async () => {
  await assert.rejects(generateResponse([], { provider: 'typo' }), /Unsupported/);
});

test('rejects incomplete OpenAI output', async (t) => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test';
  t.after(() => { if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior; });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'incomplete', output_text: '{"score":' }));
  await assert.rejects(generateResponse([], { provider: 'openai', json: true }), /complete response/);
});

test('OpenAI default and overridden timeouts cover successful JSON and failed text bodies', async t => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test';
  t.after(() => { if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior; });
  const realSetTimeout = globalThis.setTimeout;
  for (const timeoutMs of [undefined, 60000]) {
    for (const ok of [true, false]) {
      let requestedDelay;
      const timerMock = t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
        requestedDelay = delay;
        return realSetTimeout(callback, 5);
      });
      const fetchMock = t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
        const read = () => new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
        return { ok, status: ok ? 200 : 503, json: read, text: read };
      });
      await assert.rejects(generateResponse([], { provider: 'openai', timeoutMs }),
        { message: `OpenAI request timed out after ${(timeoutMs ?? 15000) / 1000}s` });
      assert.equal(requestedDelay, timeoutMs ?? 15000);
      fetchMock.mock.restore();
      timerMock.mock.restore();
    }
  }
});

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
