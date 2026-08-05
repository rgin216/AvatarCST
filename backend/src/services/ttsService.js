import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

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

async function streamEdgeSpeech(text, writable, options = {}) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(options.voice || EDGE_MALE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  await pipeline(audioStream, writable);
}

async function synthesizeEdgeSpeech(text, outputPath, options = {}) {
  await streamEdgeSpeech(text, fs.createWriteStream(outputPath), options);
}

async function fetchOpenAISpeech(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot stream OpenAI speech');
  }

  const model = options.model || process.env.OPENAI_TTS_MODEL || 'tts-1';
  const requestBody = {
    model,
    voice: options.voice || OPENAI_FEMALE_VOICE,
    input: text,
    response_format: options.responseFormat || 'mp3',
    ...(model.startsWith('gpt-4o-mini-tts') && {
      instructions: process.env.OPENAI_TTS_INSTRUCTIONS
        || 'Speak warmly, clearly, and gently for an older adult in a cognitive stimulation therapy session.',
    }),
  };

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS failed ${response.status}: ${body}`);
  }

  return response;
}

export function concatenateWavFiles(inputPaths, outputPath) {
  if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
    return Promise.reject(new Error('concatenateWavFiles: at least one input is required'));
  }

  return new Promise((resolve, reject) => {
    const filterInputs = inputPaths.map((_, index) => `[${index}:a]`).join('');
    const args = [
      '-y',
      ...inputPaths.flatMap((inputPath) => ['-i', inputPath]),
      '-filter_complex',
      `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[outa]`,
      '-map',
      '[outa]',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      outputPath,
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg audio concatenation failed (${code}): ${stderr.slice(-600)}`));
    });
  });
}

export async function synthesizeSpeechPlan(segments, outputPath, options = {}) {
  const usableSegments = (segments || []).filter(
    (segment) => segment?.audioPath || segment?.text?.trim()
  );
  if (usableSegments.length === 0) {
    throw new Error('synthesizeSpeechPlan: at least one speech segment is required');
  }

  const generatedPaths = [];
  const combinedTempPath = `${outputPath}.combined.part.wav`;

  try {
    const inputPaths = await Promise.all(usableSegments.map(async (segment, index) => {
      if (segment.audioPath) {
        await fs.promises.access(segment.audioPath, fs.constants.R_OK);
        return segment.audioPath;
      }

      const segmentPath = `${outputPath}.segment-${index}.wav`;
      generatedPaths.push(segmentPath);
      await synthesizeSpeech(segment.text, segmentPath, {
        ...options,
        model: segment.model || options.model,
        voice: segment.voice || options.voice,
        responseFormat: 'wav',
      });
      return segmentPath;
    }));

    if (inputPaths.length === 1) {
      await fs.promises.copyFile(inputPaths[0], combinedTempPath, fs.constants.COPYFILE_EXCL);
    } else {
      await concatenateWavFiles(inputPaths, combinedTempPath);
    }
    await fs.promises.rename(combinedTempPath, outputPath);
  } finally {
    await Promise.all([
      ...generatedPaths.map((filePath) => fs.promises.rm(filePath, { force: true })),
      fs.promises.rm(combinedTempPath, { force: true }),
    ]);
  }
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
