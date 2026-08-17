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
  assert.equal(requestBody.max_completion_tokens, 60);
  assert.equal(requestBody.max_tokens, undefined);
  assert.equal(requestBody.reasoning_effort, 'low');
  assert.equal(requestBody.include_reasoning, false);
});
