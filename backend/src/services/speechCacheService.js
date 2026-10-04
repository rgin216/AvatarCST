import crypto from 'crypto';
import fs from 'fs';

// Scripted narration is fixed text, so its synthesized audio and lip-sync can be
// produced once and shared. Entries hold the in-flight promise, which lets a
// background prefetch and the turn that needs the audio share one synthesis.
const MAX_ENTRIES = 300;
// Neither TTS provider bounds a stalled stream, and a stuck entry would block
// every later turn that needs the same line, so give up and retry instead.
const SPEECH_TIMEOUT_MS = 60_000;
const entries = new Map();

export const speechCacheKey = (parts) =>
  crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');

const fileExists = (filePath) =>
  fs.promises.access(filePath).then(() => true, () => false);

const forget = (key, pending) => {
  if (entries.get(key) === pending) entries.delete(key);
};

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Speech synthesis timed out')), timeoutMs);
  timer.unref?.();
  promise.then(resolve, reject).finally(() => clearTimeout(timer));
});

const store = (key, create, isComplete, timeoutMs) => {
  const pending = withTimeout(Promise.resolve().then(create), timeoutMs);
  entries.set(key, pending);
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  // Failed or incomplete results are not kept, so the next request retries.
  pending.then(
    (result) => { if (!isComplete(result)) forget(key, pending); },
    () => forget(key, pending)
  );
  return pending;
};

export async function getOrCreateSpeech(key, create, { isComplete = () => true, timeoutMs = SPEECH_TIMEOUT_MS } = {}) {
  const existing = entries.get(key);
  if (existing) {
    entries.delete(key);
    entries.set(key, existing);
    try {
      const result = await existing;
      if (isComplete(result) && await fileExists(result.audioOutputPath)) return result;
    } catch {
      // A failed prefetch must not fail the turn; synthesize afresh below.
    }
    forget(key, existing);
    if (entries.has(key)) return getOrCreateSpeech(key, create, { isComplete, timeoutMs });
  }
  return store(key, create, isComplete, timeoutMs);
}

export function prefetchSpeech(key, create, options) {
  getOrCreateSpeech(key, create, options).catch((error) => {
    console.warn('[speech-cache] Prefetch failed:', error.message);
  });
}

export const clearSpeechCache = () => entries.clear();
