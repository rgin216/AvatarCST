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
    // Instruction prompts were echoed into transcripts of quiet audio (see DementiaBank WER evaluation).
    assert.equal(body.get('prompt'), null);
  }
});

test('an explicit prompt option is sent for evaluation comparisons', async (t) => {
  const bodies = mockOpenAi(t, ['Hello there']);
  await transcribeAudio('test.webm', 'test.webm', { provider: 'openai', language: 'en', prompt: 'Legacy prompt.' });
  assert.equal(bodies[0].get('prompt'), 'Legacy prompt.');
});

test('Groq English script drift retries with the full Whisper model', async (t) => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldModel = process.env.GROQ_WHISPER_MODEL;
  process.env.GROQ_API_KEY = 'test-key';
  delete process.env.GROQ_WHISPER_MODEL;
  t.after(() => {
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_WHISPER_MODEL;
    else process.env.GROQ_WHISPER_MODEL = oldModel;
  });
  t.mock.method(fs, 'readFileSync', () => Buffer.from('test audio'));
  const bodies = [];
  const outputs = ['你好', 'Hello there'];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    bodies.push(options.body);
    return Response.json({ text: outputs[bodies.length - 1] });
  });

  assert.equal(await transcribeAudio('test.webm', 'test.webm', { provider: 'groq', language: 'en' }), 'Hello there');
  assert.deepEqual(bodies.map(body => body.get('model')), ['whisper-large-v3-turbo', 'whisper-large-v3']);
});

test('other selected languages are pinned instead of auto-detected', async (t) => {
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
  assert.equal(body.get('language'), 'fr');
  assert.match(body.get('prompt'), /French/);
});

function mockOpenAi(t, outputs) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldModel = process.env.OPENAI_TRANSCRIBE_MODEL;
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.OPENAI_TRANSCRIBE_MODEL;
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENAI_TRANSCRIBE_MODEL;
    else process.env.OPENAI_TRANSCRIBE_MODEL = oldModel;
  });
  t.mock.method(fs, 'readFileSync', () => Buffer.from('original recording'));
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    bodies.push(options.body);
    assert.ok(bodies.length <= outputs.length, 'unexpected extra retry');
    return Response.json({ text: outputs[bodies.length - 1] });
  });
  return bodies;
}

test('missing language defaults to English and accepts accented Latin letters', async (t) => {
  const bodies = mockOpenAi(t, ['I visited a café in Tāmaki Makaurau.']);
  assert.equal(await transcribeAudio('test.webm', 'answer.webm', { provider: 'openai' }), 'I visited a café in Tāmaki Makaurau.');
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].get('language'), 'en');
});

for (const foreignText of ['안녕하세요', '你好', 'Hello 世界', 'Привет', 'مرحبا']) {
  test(`English script drift is recovered from the original audio: ${foreignText}`, async (t) => {
    const bodies = mockOpenAi(t, [foreignText, 'Hello there']);
    assert.equal(await transcribeAudio('test.webm', 'answer.webm', { provider: 'openai', language: 'en' }), 'Hello there');
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].get('model'), 'gpt-4o-transcribe');
    for (const body of bodies) {
      assert.equal(body.get('language'), 'en');
      assert.equal(body.get('file').name, 'answer.webm');
      assert.equal(await body.get('file').text(), 'original recording');
    }
  });
}

test('persistent script drift fails before a transcript can reach the session', async (t) => {
  const bodies = mockOpenAi(t, ['你好', '안녕하세요']);
  await assert.rejects(transcribeAudio('test.webm', 'test.webm', { provider: 'openai', language: 'en' }),
    err => err.status === 422 && /recording your answer again/.test(err.message));
  assert.equal(bodies.length, 2);
});

test('explicit Chinese selection keeps Chinese speech without an English retry', async (t) => {
  const bodies = mockOpenAi(t, ['你好']);
  assert.equal(await transcribeAudio('test.webm', 'test.webm', { provider: 'openai', language: 'zh' }), '你好');
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].get('language'), 'zh');
});
