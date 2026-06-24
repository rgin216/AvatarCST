import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

// NZ English voices: en-NZ-MitchellNeural (male), en-NZ-MollyNeural (female)
const TTS_VOICE = process.env.TTS_VOICE ?? 'en-NZ-MitchellNeural';

async function streamEdgeSpeech(text, writable) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  await pipeline(audioStream, writable);
}

async function fetchOpenAISpeech(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot stream OpenAI speech');
  }

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE || 'marin',
      input: text,
      response_format: options.responseFormat || 'mp3',
      instructions: process.env.OPENAI_TTS_INSTRUCTIONS
        || 'Speak warmly, clearly, and gently for an older adult in a cognitive stimulation therapy session.',
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS failed ${response.status}: ${body}`);
  }

  return response;
}

export async function pipeSpeechStream(text, writable, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('pipeSpeechStream: text must be a non-empty string');
  }

  if (options.provider === 'openai') {
    const response = await fetchOpenAISpeech(text, options);
    await pipeline(Readable.fromWeb(response.body), writable);
    return;
  }

  await streamEdgeSpeech(text, writable);
}
