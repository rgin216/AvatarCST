import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import { pipeline } from 'stream/promises';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

// NZ English voices: en-NZ-MitchellNeural (male), en-NZ-MollyNeural (female)
const TTS_VOICE = process.env.TTS_VOICE ?? 'en-NZ-MitchellNeural';

async function synthesizeEdgeSpeech(text, outputPath) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  // toFile() treats its argument as a directory; use toStream() to control the output path directly.
  const { audioStream } = tts.toStream(text);
  await pipeline(audioStream, fs.createWriteStream(outputPath));
}

async function synthesizeOpenAISpeech(text, outputPath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot synthesize OpenAI speech');
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
      response_format: 'mp3',
      instructions: process.env.OPENAI_TTS_INSTRUCTIONS
        || 'Speak warmly, clearly, and gently for an older adult in a cognitive stimulation therapy session.',
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS failed ${response.status}: ${body}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(outputPath, buffer);
}

async function synthesizeOpenAIAudioSpeech(text, outputPath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot synthesize OpenAI audio model speech');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_AUDIO_MODEL || 'gpt-audio-1.5',
      modalities: ['text', 'audio'],
      audio: {
        voice: process.env.OPENAI_AUDIO_VOICE || process.env.OPENAI_TTS_VOICE || 'marin',
        format: 'wav',
      },
      messages: [
        {
          role: 'user',
          content: `Speak this CST facilitator line warmly and clearly. Do not add or remove words:\n\n${text}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI audio model speech failed ${response.status}: ${body}`);
  }

  const data = await response.json();
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) throw new Error('OpenAI audio model did not return audio data');

  await fs.promises.writeFile(outputPath, Buffer.from(audioBase64, 'base64'));
}

export async function synthesizeSpeech(text, outputPath, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('synthesizeSpeech: text must be a non-empty string');
  }

  if (options.provider === 'openai') {
    await synthesizeOpenAISpeech(text, outputPath);
    return;
  }

  if (options.provider === 'openai-audio') {
    await synthesizeOpenAIAudioSpeech(text, outputPath);
    return;
  }

  await synthesizeEdgeSpeech(text, outputPath);
}
