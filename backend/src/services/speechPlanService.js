import path from 'path';
import { fileURLToPath } from 'url';

export const SESSION_ONE_OPENING_QUESTION = 'How are you feeling today?';

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REQUIRED_SPEECH_DIR = path.resolve(SERVICE_DIR, '../../assets/speech');
const REQUIRED_QUESTION_ASSETS = {
  alloy: 'session1-feeling-today-alloy.wav',
  nova: 'session1-feeling-today-nova.wav',
};
const TTS_ONE_VOICES = new Set([
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
]);

const getScriptedVoice = (voice) => {
  if (TTS_ONE_VOICES.has(voice)) return voice;
  const configuredFallback = process.env.OPENAI_SCRIPTED_TTS_FEMALE_VOICE || 'nova';
  return TTS_ONE_VOICES.has(configuredFallback) ? configuredFallback : 'nova';
};

const getRequiredQuestionAsset = (voice) =>
  path.join(
    REQUIRED_SPEECH_DIR,
    REQUIRED_QUESTION_ASSETS[voice] || REQUIRED_QUESTION_ASSETS.alloy
  );

const isSessionOneOpening = (turn) =>
  turn?.scriptId === 'cst_intro_reminiscence' &&
  turn?.scriptStep?.id === 'welcome_opening';

const splitRequiredEnding = (text, requiredEnding) => {
  const normalizedText = text.toLocaleLowerCase('en-NZ');
  const normalizedEnding = requiredEnding.toLocaleLowerCase('en-NZ');
  const endingIndex = normalizedText.lastIndexOf(normalizedEnding);

  if (endingIndex < 0) return text.trim();
  return text.slice(0, endingIndex).trim();
};

export const createOpenAiSpeechPlan = ({
  turn,
  voice,
  adaptiveModel = process.env.OPENAI_ADAPTIVE_TTS_MODEL || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  scriptedModel = process.env.OPENAI_SCRIPTED_TTS_MODEL || 'tts-1',
} = {}) => {
  const sourceSegments = Array.isArray(turn?.speechSegments) && turn.speechSegments.length > 0
    ? turn.speechSegments
    : [{ kind: 'scripted', text: turn?.assistantText || '' }];
  const hasScriptedSpeech = sourceSegments.some((segment) => segment?.kind !== 'adaptive');
  const scriptedVoice = hasScriptedSpeech ? getScriptedVoice(voice) : voice;
  const turnVoice = isSessionOneOpening(turn) && !REQUIRED_QUESTION_ASSETS[scriptedVoice]
    ? 'alloy'
    : scriptedVoice;

  const segments = sourceSegments
    .filter((segment) => segment?.text?.trim())
    .map((segment) => ({
      kind: segment.kind === 'adaptive' ? 'adaptive' : 'scripted',
      text: segment.text.trim(),
      model: segment.kind === 'adaptive' ? adaptiveModel : scriptedModel,
      voice: turnVoice,
    }));

  if (!isSessionOneOpening(turn)) {
    return { segments, requiredPhrases: [] };
  }

  const scriptedIndex = segments.findIndex((segment) => segment.kind === 'scripted');
  if (scriptedIndex < 0) {
    throw new Error('Session 1 opening is missing its scripted speech segment');
  }

  const scriptedSegment = segments[scriptedIndex];
  const prefix = splitRequiredEnding(scriptedSegment.text, SESSION_ONE_OPENING_QUESTION);
  const replacement = [
    ...(prefix ? [{ ...scriptedSegment, text: prefix }] : []),
    {
      kind: 'verified-asset',
      audioPath: getRequiredQuestionAsset(turnVoice),
      text: SESSION_ONE_OPENING_QUESTION,
    },
  ];

  return {
    segments: [
      ...segments.slice(0, scriptedIndex),
      ...replacement,
      ...segments.slice(scriptedIndex + 1),
    ],
    requiredPhrases: [SESSION_ONE_OPENING_QUESTION],
  };
};
