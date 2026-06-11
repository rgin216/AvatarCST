import fs from 'fs';
import path from 'path';

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

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

export async function transcribeAudio(audioFilePath, originalName = 'audio.webm') {
  const model = process.env.GROQ_WHISPER_MODEL ?? 'whisper-large-v3-turbo';
  const buffer = fs.readFileSync(audioFilePath);
  // Groq infers format from the filename extension — use the original browser filename
  const blob = new Blob([buffer], { type: getMimeType(originalName) });

  const formData = new FormData();
  formData.append('file', blob, originalName);
  formData.append('model', model);
  formData.append('response_format', 'json');

  const res = await fetch(GROQ_STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Groq STT failed ${res.status}: ${body}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  return data.text?.trim() ?? '';
}
