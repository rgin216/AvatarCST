import fs from 'fs';
import path from 'path';

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
  };
  return map[ext] ?? 'audio/webm';
}

export async function transcribeAudio(audioFilePath, originalName = 'audio.webm', options = {}) {
  const provider = options.provider === 'openai' ? 'openai' : 'groq';
  const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(`${provider === 'openai' ? 'OPENAI_API_KEY' : 'GROQ_API_KEY'} is not set - cannot transcribe audio`);
  }

  const model = provider === 'openai'
    ? process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'
    : process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';
  const buffer = fs.readFileSync(audioFilePath);
  // Providers infer format from the filename extension; use the original browser filename.
  const blob = new Blob([buffer], { type: getMimeType(originalName) });

  const formData = new FormData();
  formData.append('file', blob, originalName);
  formData.append('model', model);
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const res = await fetch(provider === 'openai' ? OPENAI_STT_URL : GROQ_STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${provider === 'openai' ? 'OpenAI' : 'Groq'} STT failed ${res.status}: ${body}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  return data.text?.trim() ?? '';
}
