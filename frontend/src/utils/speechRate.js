// Mirrors the bounds on User.settings.speechRate in the backend model.
export const SPEECH_RATE_MIN = 0.75;
export const SPEECH_RATE_MAX = 1.25;
export const SPEECH_RATE_STEP = 0.05;

export function clampSpeechRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 1;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
}

export const formatSpeechRate = (rate) => `${clampSpeechRate(rate).toFixed(2)}×`;
