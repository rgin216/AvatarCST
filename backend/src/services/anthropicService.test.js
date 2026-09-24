import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResponse } from './llmService.js';
import { assertProviderCredentials } from './llmProviders.js';

const messages = [{ role: 'system', content: 'First' }, { role: 'system', content: 'Second' }, { role: 'user', content: 'Hello' }];
function key(t) {
  const prior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-only';
  t.after(() => { if (prior === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prior; });
}
test('Claude uses Messages headers, top-level system and explicit model without sampling parameters', async t => {
  key(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(options.headers['x-api-key'], 'test-only');
    assert.equal(options.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'claude-sonnet-5');
    assert.equal(body.system, 'First\n\nSecond');
    assert.deepEqual(body.messages, [messages[2]]);
    assert.equal(body.temperature, undefined);
    assert.equal(body.max_tokens, 256);
    assert.equal(body.thinking.type, 'disabled');
    return Response.json({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: '**Hello.**' }] });
  });
  assert.equal(await generateResponse(messages, { provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.4 }), 'Hello.');
});
test('Claude sends JSON schema and preserves evidence text exactly', async t => {
  key(t);
  const schema = { type: 'object', additionalProperties: false, required: ['evidence'], properties: { evidence: { type: 'string' } } };
  const raw = '{"evidence":"**literal_under_score**"}';
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    assert.deepEqual(JSON.parse(options.body).output_config.format, { type: 'json_schema', schema });
    return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: raw }] });
  });
  assert.equal(await generateResponse(messages, { provider: 'anthropic', json: true, jsonSchema: schema }), raw);
});
test('Claude rejects truncation, refusal, unexpected tool use and empty output', async t => {
  key(t);
  for (const stop_reason of ['max_tokens', 'refusal', 'tool_use', 'pause_turn']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ stop_reason, content: [{ type: 'text', text: 'Partial' }] }));
    await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), /did not complete/);
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ stop_reason: 'end_turn', content: [] }));
  await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), /empty text/);
});
test('Claude validates credentials and JSON configuration before network calls', async t => {
  key(t);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected network call'); });
  await assert.rejects(generateResponse(messages, { provider: 'anthropic', json: true }), /jsonSchema/);
  await assert.rejects(generateResponse([{ role: 'assistant', content: 'prefill' }], { provider: 'anthropic' }), /ending with a user/);
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), /ANTHROPIC_API_KEY/);
});
test('Claude surfaces HTTP failures without echoing sensitive provider detail', async t => {
  key(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { type: 'rate_limit_error', message: 'private-account-detail' } }, { status: 429 }));
  await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), error =>
    error.message === 'Anthropic HTTP 429');
});

test('Claude non-JSON bodies retain HTTP status without leaking parse excerpts', async t => {
  key(t);
  for (const status of [200, 502, 429]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('<html>private-body-detail</html>', { status }));
    await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), error =>
      error.message === (status === 200 ? 'Anthropic returned invalid JSON' : `Anthropic HTTP ${status}`));
    mock.mock.restore();
  }
});

test('Claude preserves abort handling for both successful and failed response bodies', async t => {
  key(t);
  for (const ok of [true, false]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok, status: ok ? 200 : 503,
      json: async () => { throw new DOMException('private-abort-detail', 'AbortError'); },
    }));
    await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), { message: 'Anthropic request timed out after 60s' });
    mock.mock.restore();
  }
});
test('Claude timeout applies while reading the response body', async t => {
  key(t);
  t.mock.method(globalThis, 'fetch', async () => ({ json: async () => { throw new DOMException('Aborted', 'AbortError'); } }));
  await assert.rejects(generateResponse(messages, { provider: 'anthropic' }), /timed out/);
});
test('credential preflight reports exact missing provider and never accepts unrelated keys', () => {
  const roster = [{ provider: 'groq' }, { provider: 'anthropic' }];
  assert.throws(() => assertProviderCredentials(roster, { GROQ_API_KEY: 'x', OPENAI_API_KEY: 'x' }), /ANTHROPIC_API_KEY/);
  assert.doesNotThrow(() => assertProviderCredentials(roster, { GROQ_API_KEY: 'x', ANTHROPIC_API_KEY: 'x' }));
});
