import { v4 as uuidv4 } from 'uuid';

const STREAM_TTL_MS = 5 * 60 * 1000;
const speechStreams = new Map();

const cleanupExpiredStreams = () => {
  const now = Date.now();
  for (const [token, entry] of speechStreams.entries()) {
    if (entry.expiresAt <= now) speechStreams.delete(token);
  }
};

export const createSpeechStreamToken = ({
  text,
  provider = 'openai',
  voice = null,
  lipsync = 'audio-energy',
}) => {
  cleanupExpiredStreams();
  const token = uuidv4();
  speechStreams.set(token, {
    text,
    provider,
    voice,
    lipsync,
    expiresAt: Date.now() + STREAM_TTL_MS,
  });
  return token;
};

export const getSpeechStream = (token) => {
  cleanupExpiredStreams();
  const entry = speechStreams.get(token);
  if (!entry) return null;
  entry.expiresAt = Date.now() + STREAM_TTL_MS;
  return entry;
};
