import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transcribeAudio } from './sttService.js';

test('English settings constrain transcription for both providers', async (t) => {
  const oldOpenAiKey = process.env.OPENAI_API_KEY;
  const oldGroqKey = process.env.GROQ_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
  t.after(() => {
    if (oldOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldOpenAiKey;
    if (oldGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldGroqKey;
  });
  t.mock.method(fs, 'readFileSync', () => Buffer.from('test audio'));
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(options.body);
    return Response.json({ text: 'Hello there' });
  });

  for (const provider of ['openai', 'groq']) {
    assert.equal(await transcribeAudio('test.webm', 'test.webm', { provider, language: 'en' }), 'Hello there');
  }
  for (const body of requests) {
    assert.equal(body.get('language'), 'en');
    assert.match(body.get('prompt'), /strong accent.*English/i);
  }
});

test('other language settings allow language detection', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  });
  t.mock.method(fs, 'readFileSync', () => Buffer.from('test audio'));
  let body;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    body = options.body;
    return Response.json({ text: 'Bonjour' });
  });

  await transcribeAudio('test.webm', 'test.webm', { provider: 'openai', language: 'fr' });
  assert.equal(body.get('language'), null);
  assert.equal(body.get('prompt'), null);
});
