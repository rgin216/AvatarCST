import fs from 'fs';
import path from 'path';

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';
const TRANSCRIPTION_LANGUAGES = { en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', mi: 'Māori' };
const ENGLISH_PROMPT = 'The speaker is speaking English, possibly with a strong accent. Transcribe the speech in English using Latin letters. Do not translate it into another language. Do not invent words for silence or unclear audio.';

// Keep accents, Māori macrons, numbers and punctuation; reject letters in other scripts.
function hasUnexpectedScript(text) {
  return [...text].some(char => /\p{Letter}/u.test(char) && !/\p{Script=Latin}/u.test(char));
}

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
  const language = options.language || 'en';

  const requestTranscript = async (retry = false) => {
    const formData = new FormData();
    formData.append('file', blob, originalName);
    formData.append('model', retry && model.startsWith('gpt-4o-mini-transcribe') ? 'gpt-4o-transcribe' : model);
    if (TRANSCRIPTION_LANGUAGES[language]) {
      formData.append('language', language);
      formData.append('prompt', language === 'en'
        ? ENGLISH_PROMPT
        : `The speaker is speaking ${TRANSCRIPTION_LANGUAGES[language]}. Transcribe in that language. Do not translate into another language.`);
    }
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
  };

  let transcript = await requestTranscript();
  if (provider === 'openai' && language === 'en' && hasUnexpectedScript(transcript)) {
    // Re-transcribe the audio, never translate a potentially hallucinated transcript.
    transcript = await requestTranscript(true);
    if (hasUnexpectedScript(transcript)) {
      const err = new Error('Could not transcribe that recording in English. Please try recording your answer again.');
      err.status = 422;
      throw err;
    }
  }
  return transcript;
}
