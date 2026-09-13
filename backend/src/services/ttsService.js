import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

const EDGE_MALE_VOICE = process.env.EDGE_TTS_MALE_VOICE
  || process.env.TTS_VOICE
  || 'en-NZ-MitchellNeural';
const EDGE_FEMALE_VOICE = process.env.EDGE_TTS_FEMALE_VOICE || 'en-NZ-MollyNeural';
const OPENAI_MALE_VOICE = process.env.OPENAI_TTS_MALE_VOICE || 'alloy';
const OPENAI_FEMALE_VOICE = process.env.OPENAI_TTS_FEMALE_VOICE
  || process.env.OPENAI_TTS_VOICE
  || 'marin';

export function getVoiceOptionsForAvatar(avatarMode = 'male') {
  const useFemale = avatarMode === 'female';
  return {
    edgeVoice: useFemale ? EDGE_FEMALE_VOICE : EDGE_MALE_VOICE,
    openAiVoice: useFemale ? OPENAI_FEMALE_VOICE : OPENAI_MALE_VOICE,
  };
}

// Reused verbatim for acknowledgements and script segments. These are delivery
// targets, not a hard fundamental-frequency limiter (neither provider exposes one).
export function getVoiceDeliveryOptions(options = {}) {
  const female = options.avatarMode === 'female' || (!options.avatarMode &&
    [EDGE_FEMALE_VOICE, OPENAI_FEMALE_VOICE].includes(options.voice));
  const mode = female ? 'FEMALE' : 'MALE';
  const configuredPitch = process.env[`EDGE_TTS_${mode}_PITCH_HZ`];
  const pitchHz = Number(configuredPitch ?? 0);
  const safePitch = Number.isFinite(pitchHz) ? Math.max(-20, Math.min(20, pitchHz)) : 0;
  return {
    edgeProsody: { pitch: `${safePitch >= 0 ? '+' : ''}${safePitch}Hz`, rate: '+0%', volume: '+0%' },
    instructions: [
      process.env.OPENAI_TTS_INSTRUCTIONS || 'Speak clearly and gently to an older adult.',
      `Voice delivery: maintain the selected voice's natural ${female ? 'female' : 'male'} speaking register throughout.`,
      'Keep a narrow pitch range and a stable, comfortable baseline. Use restrained, nearly level intonation with only small natural inflections.',
      'Use the same pitch, resonance, volume, and measured conversational pace for brief acknowledgements, longer narration, and questions.',
      'Begin directly in that register. Do not start acknowledgements higher, brighten praise, add sing-song emphasis, or make exaggerated upward question endings.',
      'Stay warm through clear articulation and gentle pacing, without whispering, theatrical emotion, or exaggerated enthusiasm. Read only the supplied text.',
    ].join(' '),
  };
}

async function streamEdgeSpeech(text, writable, options = {}) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(options.voice || EDGE_MALE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, getVoiceDeliveryOptions(options).edgeProsody);
  await pipeline(audioStream, writable);
}

async function synthesizeEdgeSpeech(text, outputPath, options = {}) {
  await streamEdgeSpeech(text, fs.createWriteStream(outputPath), options);
}

async function fetchOpenAISpeech(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot stream OpenAI speech');
  }

  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      voice: options.voice || OPENAI_FEMALE_VOICE,
      input: text,
      response_format: options.responseFormat || 'mp3',
      ...(model === 'gpt-4o-mini-tts' ? { instructions: getVoiceDeliveryOptions(options).instructions } : {}),
      speed: 1.0,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS failed ${response.status}: ${body}`);
  }

  return response;
}

async function synthesizeOpenAISpeech(text, outputPath, options = {}) {
  const response = await fetchOpenAISpeech(text, options);
  const tempOutputPath = `${outputPath}.part`;

  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempOutputPath, { flags: 'wx' }));
    const { size } = await fs.promises.stat(tempOutputPath);
    if (size === 0) throw new Error('OpenAI TTS returned an empty audio file');
    await fs.promises.rename(tempOutputPath, outputPath);
  } catch (err) {
    await fs.promises.rm(tempOutputPath, { force: true }).catch(() => {});
    throw err;
  }
}

export async function synthesizeSpeech(text, outputPath, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('synthesizeSpeech: text must be a non-empty string');
  }

  if (options.provider === 'openai') {
    await synthesizeOpenAISpeech(text, outputPath, options);
    return;
  }

  await synthesizeEdgeSpeech(text, outputPath, options);
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

  await streamEdgeSpeech(text, writable, options);
}
