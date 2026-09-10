import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable, Readable } from 'node:stream';
import { MsEdgeTTS } from 'msedge-tts';
import { getVoiceDeliveryOptions, getVoiceOptionsForAvatar, pipeSpeechStream } from './ttsService.js';

const sink = () => new Writable({ write(chunk, encoding, callback) { callback(); } });

test('both avatar modes use the same delivery settings across acknowledgement and script requests', async (t) => {
  const priorKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.after(() => { if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    requests.push(JSON.parse(request.body));
    return new Response(new Uint8Array([1, 2, 3]));
  });
  for (const avatarMode of ['male', 'female']) {
    const voice = getVoiceOptionsForAvatar(avatarMode).openAiVoice;
    for (const text of ['That is right!', 'What is the weather like out your window today?']) {
      await pipeSpeechStream(text, sink(), { provider: 'openai', voice, avatarMode });
    }
    const [ack, script] = requests.slice(-2);
    assert.equal(ack.voice, voice);
    assert.equal(ack.instructions, script.instructions);
    assert.equal(ack.speed, script.speed);
    assert.match(ack.instructions, /narrow pitch range/);
    assert.match(ack.instructions, new RegExp(avatarMode + ' speaking register'));
    assert.equal(ack.input, 'That is right!');
  }
});

test('Edge sends explicit prosody for both voices and both segment types', async (t) => {
  const calls = [];
  t.mock.method(MsEdgeTTS.prototype, 'setMetadata', async function(voice) { this.testVoice = voice; });
  t.mock.method(MsEdgeTTS.prototype, 'toStream', function(text, prosody) {
    calls.push({ voice: this.testVoice, text, prosody });
    return { audioStream: Readable.from([Buffer.from('audio')]) };
  });
  for (const avatarMode of ['male', 'female']) {
    const voice = getVoiceOptionsForAvatar(avatarMode).edgeVoice;
    for (const text of ['Thank you.', 'Let us move on to our theme.']) {
      await pipeSpeechStream(text, sink(), { provider: 'edge', voice, avatarMode });
    }
    const [ack, script] = calls.slice(-2);
    assert.equal(ack.voice, voice);
    assert.deepEqual(ack.prosody, script.prosody);
    assert.match(ack.prosody.pitch, /^[+-][0-9.]+Hz$/);
  }
});

test('invalid or excessive Edge pitch settings are bounded independently per mode', (t) => {
  const keys = ['EDGE_TTS_MALE_PITCH_HZ', 'EDGE_TTS_FEMALE_PITCH_HZ'];
  const previous = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }));
  process.env.EDGE_TTS_MALE_PITCH_HZ = 'invalid';
  process.env.EDGE_TTS_FEMALE_PITCH_HZ = '-100';
  assert.equal(getVoiceDeliveryOptions({ avatarMode: 'male' }).edgeProsody.pitch, '+0Hz');
  assert.equal(getVoiceDeliveryOptions({ avatarMode: 'female' }).edgeProsody.pitch, '-20Hz');
});
