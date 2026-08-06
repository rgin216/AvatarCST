import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { buildAvatarResponse } from './avatarService.js';
import { getScriptStep, renderScriptFollowUp, renderScriptReply } from './cstScriptService.js';
import {
  buildCstAdaptiveResponseInstructions,
  buildCstAdaptiveTurnInstructions,
} from './promptService.js';
import { generateResponse } from './llmService.js';
import { getPositiveNzNews } from './newsService.js';
import { normalizeSongQuery, searchSpotifyTrack } from './spotifyService.js';
import { isOpenAIFastScriptedPipeline, usesOpenAITextPipeline } from '../config/pipeline.js';

const RECENT_MESSAGE_LIMIT = 20;
const MAX_UNANSWERED_ATTEMPTS = 3;
const MAX_MEMORY_SUGGESTIONS = 4;
const MAX_SELECTED_MEMORIES = 4;
const VALID_MEMORY_CATEGORIES = new Set([
  'preference',
  'personal',
  'session_insight',
  'caregiver_note',
]);
const SYSTEM_SUGGESTION_CATEGORIES = new Set(['preference', 'personal', 'session_insight']);
const MEMORY_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before',
  'being', 'could', 'did', 'does', 'doing', 'enjoy', 'favourite', 'favorite',
  'feel', 'from', 'have', 'into', 'just', 'like', 'more', 'most', 'much', 'remember',
  'some', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'think', 'this', 'those', 'today', 'very', 'want', 'was', 'were', 'what', 'when',
  'where', 'which', 'with', 'would', 'you', 'your',
]);
const MEMORY_TOPICS = {
  family: ['child', 'children', 'daughter', 'dad', 'family', 'father', 'grandchild', 'grandmother', 'grandfather', 'husband', 'mother', 'mum', 'parent', 'sister', 'brother', 'wife'],
  food: ['bake', 'cook', 'dish', 'drink', 'eat', 'food', 'meal', 'recipe', 'tea'],
  home: ['garden', 'gardening', 'home', 'house', 'neighbour', 'rose'],
  media: ['book', 'film', 'movie', 'radio', 'television', 'tv'],
  music: ['album', 'artist', 'band', 'concert', 'music', 'singer', 'song'],
  place: ['born', 'city', 'country', 'grew', 'hometown', 'live', 'lived', 'moved', 'place', 'town'],
  school: ['class', 'school', 'studied', 'subject', 'teacher', 'university'],
  sport: ['exercise', 'game', 'rugby', 'sport', 'team'],
  travel: ['beach', 'holiday', 'journey', 'lake', 'mountain', 'trip', 'travel', 'visited'],
  work: ['career', 'job', 'office', 'profession', 'retired', 'work', 'worked'],
};
const INSTRUCTION_LIKE_MEMORY_PATTERNS = [
  /\bignore (?:all |any |the )?(?:previous|prior|system|developer)\b/i,
  /\b(?:system|developer) (?:message|prompt|instruction)s?\b/i,
  /\b(?:follow|obey) (?:these|my|the following) instructions?\b/i,
  /\b(?:reveal|repeat|show) (?:the )?(?:hidden|system|developer) prompt\b/i,
  /```|<\/?(?:system|assistant|developer)>|\[\[[^\]]+\]\]/i,
];
const UNSAFE_MEMORY_PATTERNS = [
  /\b(?:api|secret|access) key\b/i,
  /\b(?:password|passcode|pin number)\b/i,
  /\b(?:bank account|credit card|debit card|ird number|social security)\b/i,
  /\b(?:home|street) address is\b/i,
  /\b(?:email address|phone number) is\b/i,
  /\b(?:diagnosed with|medication dose|prescription is)\b/i,
  /\b(?:self[- ]harm|suicid(?:e|al)|sexual assault|rape|abuse)\b/i,
];
const ORIENTATION_STEP_TYPES = {
  childhood_orientation_day: 'weekday',
  childhood_orientation_month: 'month',
  childhood_orientation_year: 'year',
  childhood_orientation_season: 'season',
};
const SEASON_BY_MONTH = [
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
];

const getDisplayName = (user) => user?.preferredName || user?.name || 'there';

const joinSpeechParts = (...parts) => parts.map((part) => part?.trim()).filter(Boolean).join(' ');

const SPEECH_OVERLAP_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'before', 'but', 'can', 'doing',
  'for', 'from', 'have', 'how', 'into', 'let', 'like', 'now', 'our', 'that', 'the',
  'their', 'them', 'there', 'they', 'this', 'today', 'was', 'were', 'what', 'when',
  'with', 'would', 'you', 'your',
]);

const getDistinctSpeechTerms = (text = '') => [...new Set(
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !SPEECH_OVERLAP_STOP_WORDS.has(term))
)];

const hasSubstantialSpeechOverlap = (adaptiveText = '', scriptedText = '') => {
  if (!adaptiveText || !scriptedText) return false;
  const scriptedTerms = new Set(getDistinctSpeechTerms(scriptedText));
  const sharedTerms = getDistinctSpeechTerms(adaptiveText)
    .filter((term) => scriptedTerms.has(term));
  return sharedTerms.length >= 2;
};

const getNzDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    month: 'long',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const normalizeAnswer = (content = '') =>
  content
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NUMBER_WORD_VALUES = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const parseNumberBelowHundred = (tokens = []) => {
  if (tokens.length === 1) return NUMBER_WORD_VALUES[tokens[0]] ?? null;
  if (tokens.length !== 2) return null;

  const tens = NUMBER_WORD_VALUES[tokens[0]];
  const units = NUMBER_WORD_VALUES[tokens[1]];
  if (tens == null || units == null) return null;
  if (tens === 0) return units;
  if (tens < 20 || tens % 10 !== 0 || units > 9) return null;
  return tens + units;
};

const normalizeYearAnswer = (content = '') => {
  const normalized = normalizeAnswer(content);
  const numericYear = normalized.match(/(?:^|\s)(\d{4})(?:\s|$)/)?.[1];
  if (numericYear) return numericYear;

  const ignoredWords = new Set(['and', 'i', 'it', 'is', 'maybe', 'the', 'think', 'year']);
  const tokens = normalized.split(' ').filter((token) => token && !ignoredWords.has(token));
  const thousandIndex = tokens.indexOf('thousand');
  if (thousandIndex > 0) {
    const thousands = parseNumberBelowHundred(tokens.slice(0, thousandIndex));
    const remainder = parseNumberBelowHundred(tokens.slice(thousandIndex + 1));
    if (thousands != null && remainder != null) return String(thousands * 1000 + remainder);
  }

  for (let splitIndex = 1; splitIndex < tokens.length; splitIndex += 1) {
    const century = parseNumberBelowHundred(tokens.slice(0, splitIndex));
    const remainder = parseNumberBelowHundred(tokens.slice(splitIndex));
    if (century >= 10 && remainder != null) return String(century * 100 + remainder);
  }

  return '';
};

const getExpectedOrientationAnswer = (type) => {
  const parts = getNzDateParts();
  if (type === 'weekday') return parts.weekday;
  if (type === 'month') return parts.month;
  if (type === 'year') return parts.year;
  if (type === 'season') return SEASON_BY_MONTH[new Date().toLocaleString('en-NZ', {
    month: 'numeric',
    timeZone: 'Pacific/Auckland',
  }) - 1];
  return '';
};

const isDontKnowAnswer = (content = '') =>
  /\b(don'?t know|not sure|unsure|can't remember|cannot remember|no idea)\b/i.test(content);

const isCorrectOrientationAnswer = (content = '', expected = '') => {
  const normalized = normalizeAnswer(content);
  const normalizedExpected = normalizeAnswer(expected);
  if (!normalized || !normalizedExpected) return false;
  if (/^\d{4}$/.test(normalizedExpected)) {
    return normalizeYearAnswer(content) === normalizedExpected;
  }
  if (normalized.includes(normalizedExpected)) return true;

  if (normalizedExpected.length >= 3) {
    return normalized.split(' ').some((word) => normalizedExpected.startsWith(word) && word.length >= 3);
  }

  return false;
};

const evaluateOrientationAnswer = ({ step, content, retryCount }) => {
  const type = ORIENTATION_STEP_TYPES[step.id];
  if (!type || !content) return null;

  const expected = getExpectedOrientationAnswer(type);
  if (!expected) return null;

  if (isDontKnowAnswer(content)) {
    return {
      answered: true,
      response: `No problem, it is actually ${expected}.`,
    };
  }

  if (isCorrectOrientationAnswer(content, expected)) {
    return {
      answered: true,
      response: `Yes, that's right, it is ${expected}.`,
    };
  }

  if (retryCount === 0) {
    return {
      answered: false,
      response: 'Good try. Let\'s try that once more.',
    };
  }

  return {
    answered: true,
    response: `That's okay, it is actually ${expected}.`,
  };
};

const isMusicCompletionProtocol = (content = '') =>
  /^\[\[music-complete\]\]$/i.test(content.trim());

const isVideoCompletionProtocol = (content = '') =>
  /^\[\[video-complete\]\]$/i.test(content.trim());

const isNaturalMediaCompletionAnswer = (content = '') => {
  const normalized = normalizeAnswer(content);
  if (!normalized) return false;

  return /^(?:all )?done$|^(?:i am |i m )?(?:finished|done listening)$|^(?:please )?(?:skip|continue|stop)$|^(?:i would |i d )?rather not$|^(?:i )?(?:do not|don t) want to$|^not today$|^(?:no |no,? )?thanks?$|^ready to continue$/i.test(
    normalized
  );
};

export const isMusicCompletionAnswer = (content = '') =>
  isMusicCompletionProtocol(content) || isNaturalMediaCompletionAnswer(content);

export const isVideoCompletionAnswer = (content = '') =>
  isVideoCompletionProtocol(content) || isNaturalMediaCompletionAnswer(content);

const evaluateMusicCompletionAnswer = ({ step, content, effectiveTurnIndex }) => {
  if (
    step?.interaction?.type !== 'spotifySong' ||
    effectiveTurnIndex !== 1 ||
    !content
  ) {
    return null;
  }

  if (isMusicCompletionAnswer(content)) {
    return {
      answered: true,
      response: 'Thank you. I hope you enjoyed that.',
    };
  }

  return {
    answered: false,
    response: 'Take your time.',
  };
};

const evaluateVideoCompletionAnswer = ({ step, content, effectiveTurnIndex }) => {
  if (
    step?.interaction?.type !== 'youtubeShort' ||
    effectiveTurnIndex !== 1 ||
    !content
  ) {
    return null;
  }

  if (isVideoCompletionAnswer(content)) {
    return {
      answered: true,
      response: 'Well done. I hope that felt comfortable.',
    };
  }

  return {
    answered: false,
    response: 'Take your time, and only do what feels comfortable.',
  };
};

export const isNewsElaborationRequest = (content = '') => {
  const request = String(content).trim();
  if (!request) return false;

  if (
    /\b(tell me more|more about|more detail|more information|what happened|what else|elaborate|go on)\b/i.test(
      request
    )
  ) {
    return true;
  }

  // Recorded speech often arrives without a question mark, so recognise common
  // spoken question forms while the user is on the current-affairs slide.
  if (/\?\s*$/.test(request)) return true;
  if (/\b(i wonder(?:ed)?|i was wondering|i(?:'d| would) like to know)\b/i.test(request)) {
    return true;
  }
  if (/^(?:when|where|which|who|why|can|could|did|do|does|has|have|is|are|was|were|will|would)\b/i.test(request)) {
    return true;
  }
  if (/^what\b(?!\s+(?:a|an)\b)/i.test(request)) return true;

  return /^how\s+(?:(?:did|does|do|has|have|is|are|was|were|can|could|will|would)\b|(?:long|many|much|old|far|soon|often)\b|\S+\s+(?:did|does|do|has|have|is|are|was|were|can|could|will|would)\b)/i.test(
    request
  );
};

export const buildNewsElaboration = (currentAffairs) => {
  const article = currentAffairs?.status === 'available' ? currentAffairs.article : null;
  if (!article) {
    return 'I do not have a vetted story with more detail available right now.';
  }

  const cleanDetail = (value = '') => {
    const rawDetail = String(value);
    if (/(?:\u2026|\.\.\.)?\s*\[\+\d+\s+chars\]\s*$/i.test(rawDetail)) return '';
    const detail = rawDetail.trim();
    return /(?:\u2026|\.\.\.)$/.test(detail) ? '' : detail;
  };
  const detail = cleanDetail(article.content) || cleanDetail(article.description);
  if (!detail) {
    return `The verified information I have only gives the headline, ${article.title}.`;
  }

  return `The report adds: ${detail}`;
};

const evaluateNewsElaborationRequest = ({ step, content, currentAffairs }) => {
  if (step?.id !== 'childhood_current_affairs' || !isNewsElaborationRequest(content)) {
    return null;
  }

  return {
    answered: true,
    response: buildNewsElaboration(currentAffairs),
  };
};

const parseAnswerQuality = (text = '') => {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.answered === 'boolean') return parsed.answered;
  } catch {
    // Fall through to a forgiving text parse.
  }
  if (/\banswered\s*["']?\s*:\s*true\b/i.test(text)) return true;
  if (/\banswered\s*["']?\s*:\s*false\b/i.test(text)) return false;
  return false;
};

const extractJsonObject = (text = '') => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
};

const normalizeAdaptiveFollowUp = (value) => {
  if (typeof value !== 'string') return null;
  let question = value.replace(/\s+/g, ' ').trim();
  if (!question || /^(?:none|null|n\/a)$/i.test(question)) return null;

  const firstQuestionMark = question.indexOf('?');
  if (firstQuestionMark >= 0) question = question.slice(0, firstQuestionMark + 1);
  const words = question.replace(/[?!.]+$/, '').split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 22) return null;
  return `${words.join(' ').replace(/[?!.]+$/, '')}?`;
};

export const parseAdaptiveTurn = (text = '') => {
  const parsed = extractJsonObject(text);
  if (parsed) {
    const explicitAnswerQuality = parseAnswerQuality(text);
    const answered =
      typeof parsed.answered === 'boolean' ? parsed.answered : explicitAnswerQuality === true;
    return {
      answered,
      response: typeof parsed?.response === 'string' ? parsed.response.trim() : '',
      followUp: answered ? normalizeAdaptiveFollowUp(parsed?.followUp) : null,
    };
  }

  const explicitAnswerQuality = parseAnswerQuality(text);
  return {
    answered: explicitAnswerQuality === true,
    followUp: null,
    response: text
      .replace(/```(?:json)?[\s\S]*?```/gi, '')
      .replace(/\{[\s\S]*$/, '')
      .replace(/^(response:|aria says:?|as aria,?)\s*/i, '')
      .trim(),
  };
};

export const canRequestAdaptiveFollowUp = ({
  step,
  effectiveTurnIndex,
  hasActiveFollowUp = false,
}) =>
  Boolean(
    step?.adaptiveFollowUp?.enabled &&
    !hasActiveFollowUp &&
    effectiveTurnIndex >= (step.turns || 1)
  );

const isQuestionWheelProtocol = (content = '') => /^\[\[question-wheel:/i.test(content.trim());

const parseQuestionWheelEvent = (content = '', step = null) => {
  const match = content.trim().match(/^\[\[question-wheel:(.+)\]\]$/s);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    const options = step?.interaction?.type === 'questionWheel' ? step.interaction.options || [] : [];
    const requestedId = String(parsed?.optionId || parsed?.id || '').trim();
    const requestedLabel = String(parsed?.label || '').trim();
    const option = options.find((candidate) =>
      (requestedId && String(candidate.id || '') === requestedId) ||
      (requestedLabel && candidate.label.toLowerCase() === requestedLabel.toLowerCase())
    );
    if (!option?.label || !option?.question) return null;
    return {
      status: 'landed',
      ...(option.id ? { optionId: String(option.id) } : {}),
      label: option.label,
      question: option.question,
    };
  } catch {
    return null;
  }
};

const isRecordableSessionAnswer = ({ step, content, wheelEvent }) =>
  Boolean(
    content &&
    !wheelEvent &&
    step?.id &&
    ![
      'childhood_exercise_follow_along',
      'childhood_summary_song',
      'childhood_closing',
    ].includes(step.id)
  );

const toSessionAnswer = ({ step, content }) => ({
  stepId: step.id,
  title: step.title,
  prompt: step.prompt,
  answer: content.trim(),
});

const attachAdaptiveFollowUpAnswer = ({ answers, step, question, content }) => {
  const answerIndex = answers.findLastIndex((item) => item.stepId === step.id);
  if (answerIndex < 0) return answers;

  const updatedAnswers = [...answers];
  updatedAnswers[answerIndex] = {
    ...updatedAnswers[answerIndex],
    adaptiveFollowUp: {
      question,
      answer: content.trim(),
    },
  };
  return updatedAnswers;
};

export const toSecondPersonSummaryClause = (answer = '') =>
  String(answer)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bI am\b/gi, 'you are')
    .replace(/\bI was\b/gi, 'you were')
    .replace(/\bI['’]m\b/gi, 'you are')
    .replace(/\bI['’]ve\b/gi, 'you have')
    .replace(/\bI['’]ll\b/gi, 'you will')
    .replace(/\bI['’]d\b/gi, 'you would')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bmine\b/gi, 'yours')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bme\b/gi, 'you')
    .replace(/\bI\b/gi, 'you')
    .replace(/[.!?]+$/, '')
    .replace(/^(You|Your)\b/, (word) => word.toLowerCase());

const asSummaryClause = (answer, fallbackPrefix) => {
  const clause = toSecondPersonSummaryClause(answer);
  if (!clause) return '';
  return /^(?:you|your)\b/i.test(clause) ? clause : `${fallbackPrefix} ${clause}`;
};

const asDeeperSummaryClause = (answer, fallbackPrefix = 'you remembered how') => {
  const clause = toSecondPersonSummaryClause(answer);
  if (!clause) return '';
  if (/^you\b/i.test(clause)) return clause;
  const naturalClause = clause.replace(
    /^(Because|He|It|She|That|The|They|We)\b/,
    (word) => word.toLowerCase()
  );
  return `${fallbackPrefix} ${naturalClause}`;
};

export const buildSessionSummary = (answers = []) => {
  const meaningful = answers
    .filter((item) => item.answer && !/^ok(?:ay)?$|^yes$|^no$|^continue$/i.test(item.answer));

  const byStep = new Map(meaningful.map((item) => [item.stepId, item]));
  const primaryAnswer = (stepId) => byStep.get(stepId)?.answer || '';
  const deeperAnswer = (stepId) => byStep.get(stepId)?.adaptiveFollowUp?.answer || '';
  const highlights = [];

  if (byStep.has('theme_song_choice')) {
    highlights.push(`you chose ${normalizeSongQuery(primaryAnswer('theme_song_choice'))} as your theme song`);
  }
  if (byStep.has('childhood_birthplace')) {
    highlights.push(
      deeperAnswer('childhood_birthplace')
        ? asDeeperSummaryClause(deeperAnswer('childhood_birthplace'))
        : asSummaryClause(primaryAnswer('childhood_birthplace'), 'you talked about')
    );
  }
  if (byStep.has('childhood_parents')) {
    highlights.push(
      deeperAnswer('childhood_parents')
        ? asDeeperSummaryClause(deeperAnswer('childhood_parents'))
        : `you shared your parents' names`
    );
  }
  if (byStep.has('childhood_siblings')) {
    highlights.push(
      deeperAnswer('childhood_siblings')
        ? asDeeperSummaryClause(deeperAnswer('childhood_siblings'))
        : 'you talked about brothers or sisters'
    );
  }
  if (byStep.has('childhood_school')) {
    highlights.push(
      deeperAnswer('childhood_school')
        ? asDeeperSummaryClause(deeperAnswer('childhood_school'))
        : asSummaryClause(primaryAnswer('childhood_school'), 'you remembered')
    );
  }
  if (byStep.has('childhood_first_job')) {
    highlights.push(
      deeperAnswer('childhood_first_job')
        ? asDeeperSummaryClause(deeperAnswer('childhood_first_job'))
        : asSummaryClause(primaryAnswer('childhood_first_job'), 'you mentioned')
    );
  }
  if (byStep.has('childhood_modern_family')) {
    highlights.push(
      deeperAnswer('childhood_modern_family')
        ? asDeeperSummaryClause(deeperAnswer('childhood_modern_family'))
        : asSummaryClause(primaryAnswer('childhood_modern_family'), 'you shared')
    );
  }
  if (byStep.has('childhood_spin_question')) {
    highlights.push(
      deeperAnswer('childhood_spin_question')
        ? asDeeperSummaryClause(deeperAnswer('childhood_spin_question'))
        : asSummaryClause(
            primaryAnswer('childhood_spin_question'),
            'you answered the wheel question with'
          )
    );
  }

  if (highlights.length === 0) {
    const fallback = meaningful
      .filter((item) => !ORIENTATION_STEP_TYPES[item.stepId])
      .slice(-3)
      .map((item) => asSummaryClause(item.answer, 'you shared'))
      .filter(Boolean);
    if (fallback.length > 0) highlights.push(...fallback);
  }

  if (highlights.length === 0) return '';
  if (highlights.length === 1) return `Today, ${highlights[0]}.`;

  return `Today, ${highlights.slice(0, -1).join(', ')}, and ${highlights[highlights.length - 1]}.`;
};

const getAskedScriptLine = (step, currentTurnIndex, context) =>
  currentTurnIndex <= 1
    ? renderScriptReply(step, context)
    : renderScriptFollowUp(step, currentTurnIndex - 2, context);

const getProgressScriptLine = ({ step, nextStep, currentTurnIndex, stepTurns, context }) => {
  if (currentTurnIndex <= 0) return renderScriptReply(step, context);
  if (currentTurnIndex >= stepTurns) return renderScriptReply(nextStep, context);
  return renderScriptFollowUp(step, currentTurnIndex - 1, context);
};

const hasPriorAssistantTurn = (messages = []) => messages.some((message) => message.role === 'assistant');

const ACTIVE_SESSION_STATUSES = ['active', 'pending'];

const assertCanUseSession = (session, action) => {
  if (ACTIVE_SESSION_STATUSES.includes(session.status)) return;

  const err = new Error(`Cannot ${action} for a ${session.status} session`);
  err.status = 409;
  throw err;
};

const getLlmProviderForSession = (session) =>
  usesOpenAITextPipeline(session.pipelineMode) ? 'openai' : 'groq';

const getMemoryEntries = async (userId) => {
  const memory = await Memory.findOne({ userId }).lean();
  return (memory?.entries || []).filter((entry) => !entry.status || entry.status === 'approved');
};

const toSlide = ({ step, index, total }) => ({
  index,
  total,
  id: step.id,
  deckSlide: step.deckSlide,
  imageUrl: step.deckSlide
    ? `/slides/${step.slideFolder || 'session1'}/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`
    : null,
  title: step.title,
  subtitle: step.subtitle,
  prompt: step.prompt,
  bullets: step.bullets,
  visualHint: step.visualHint,
  accent: step.accent,
  interaction: step.interaction,
});

const cleanMemoryField = (value = '', maxLength = 240) =>
  String(value)
    .replace(/\s+/g, ' ')
    .replace(/^["']+|["']+$/g, '')
    .trim()
    .slice(0, maxLength);

const isSafeMemoryText = (value = '') => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return Boolean(text) && text.length <= 600 &&
    !INSTRUCTION_LIKE_MEMORY_PATTERNS.some((pattern) => pattern.test(text)) &&
    !UNSAFE_MEMORY_PATTERNS.some((pattern) => pattern.test(text));
};

const toSemanticTokens = (value = '') =>
  cleanMemoryField(value, 1_000)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !MEMORY_STOP_WORDS.has(token));

const getMemoryTopics = (value = '') => {
  const tokens = new Set(toSemanticTokens(value));
  return Object.entries(MEMORY_TOPICS)
    .filter(([, keywords]) => keywords.some((keyword) => tokens.has(keyword)))
    .map(([topic]) => topic);
};

const trimExtractedValue = (value = '') =>
  cleanMemoryField(value.replace(/\s+(?:and|but)\s+i\s+.*$/i, ''), 180)
    .replace(/[,:;]+$/, '')
    .trim();

const MEMORY_EXTRACTORS = [
  {
    category: 'preference',
    pattern: /\b(?:my\s+)?favou?rite\s+([a-z][a-z -]{1,30}?)\s+(?:is|was)\s+(.+)/i,
    buildContent: (match) => `Favourite ${match[1].trim()}: ${trimExtractedValue(match[2])}`,
    reason: 'The user directly stated a favourite.',
  },
  {
    category: 'preference',
    pattern: /\bi\s+(?:really\s+)?(?:like|love|enjoy|prefer)\s+(.+)/i,
    buildContent: (match) => `Enjoys ${trimExtractedValue(match[1])}`,
    reason: 'The user directly stated a current preference.',
  },
  {
    category: 'preference',
    pattern: /\bi\s+(?:used to\s+(?:like|love|enjoy|prefer)|liked|loved|enjoyed|preferred)\s+(.+)/i,
    buildContent: (match) => `Enjoyed ${trimExtractedValue(match[1])}`,
    reason: 'The user directly stated a past preference.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+(grew up|was born|used to live|lived)\s+(in|at|near)\s+(.+)/i,
    buildContent: (match) => `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]} ${trimExtractedValue(match[3])}`,
    reason: 'The user shared a place from their life history.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+moved\s+(to|from)\s+(.+)/i,
    buildContent: (match) => `Moved ${match[1]} ${trimExtractedValue(match[2])}`,
    reason: 'The user shared a move from their life history.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+(?:used to\s+work|worked|work)\s+(as|at|for|in)\s+(.+)/i,
    buildContent: (match) => `Worked ${match[1]} ${trimExtractedValue(match[2])}`,
    reason: 'The user shared their work history.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+(studied|attended|went to school at)\s+(.+)/i,
    buildContent: (match) => `${match[1][0].toUpperCase()}${match[1].slice(1)} ${trimExtractedValue(match[2])}`,
    reason: 'The user shared their education history.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+(?:have|had)\s+(.+\b(?:brother|brothers|sister|sisters|son|sons|daughter|daughters|child|children)\b.*)/i,
    buildContent: (match) => `Has family: ${trimExtractedValue(match[1])}`,
    reason: 'The user shared information about their family.',
  },
  {
    category: 'personal',
    pattern: /\bmy\s+(mother|mum|father|dad|parents?|sister|brother|wife|husband|daughter|son)\s+(?:is|was|are|were)(?:\s+(?:named|called))?\s+(.+)/i,
    buildContent: (match) => `${match[1][0].toUpperCase()}${match[1].slice(1)}: ${trimExtractedValue(match[2])}`,
    reason: 'The user shared information about a family member.',
  },
  {
    category: 'personal',
    pattern: /\bi\s+remember\s+(.+)/i,
    buildContent: (match) => `Remembers ${trimExtractedValue(match[1])}`,
    reason: 'The user shared an autobiographical memory.',
  },
];

const validateMemorySuggestion = (suggestion, sourceText) => {
  const category = cleanMemoryField(suggestion?.category, 40);
  const content = cleanMemoryField(suggestion?.content);
  const evidence = cleanMemoryField(suggestion?.evidence);
  const reason = cleanMemoryField(suggestion?.reason);
  if (!SYSTEM_SUGGESTION_CATEGORIES.has(category) || !content || !evidence || !reason) return null;
  if (!isSafeMemoryText(content) || !isSafeMemoryText(evidence)) return null;

  const normalizedSource = cleanMemoryField(sourceText, 1_000).toLowerCase();
  if (!normalizedSource.includes(evidence.toLowerCase())) return null;

  const contentTokens = new Set(toSemanticTokens(content));
  const evidenceTokens = toSemanticTokens(evidence);
  if (!evidenceTokens.some((token) => contentTokens.has(token))) return null;

  return { category, content, evidence, reason };
};

export const inferMemorySuggestions = (content = '') => {
  const rawText = String(content).replace(/\s+/g, ' ').trim();
  if (rawText.length > 1_000) return [];
  const text = cleanMemoryField(rawText, 1_000);
  if (!text || !isSafeMemoryText(text)) return [];

  const candidates = text
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .flatMap((sentence) => MEMORY_EXTRACTORS.flatMap((extractor) => {
      const match = sentence.match(extractor.pattern);
      if (!match) return [];
      return [{
        category: extractor.category,
        content: extractor.buildContent(match),
        evidence: match[0],
        reason: extractor.reason,
      }];
    }))
    .map((candidate) => validateMemorySuggestion(candidate, text))
    .filter(Boolean);

  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const key = `${candidate.category}:${normalizeMemoryContent(candidate.content)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_MEMORY_SUGGESTIONS);
};

export const selectRelevantMemoryEntries = ({
  memoryEntries = [],
  currentQuestion = '',
  step = {},
  recentMessages = [],
  userContent = '',
} = {}) => {
  const currentContext = [
    currentQuestion,
    step.id,
    step.title,
    step.prompt,
    step.adaptiveFollowUp?.guidance,
    userContent,
  ].filter(Boolean).join(' ');
  const conversationContext = recentMessages
    .slice(-4)
    .map((message) => message.content)
    .filter(Boolean)
    .join(' ');
  const currentTokens = new Set(toSemanticTokens(currentContext));
  const conversationTokens = new Set(toSemanticTokens(conversationContext));
  const currentTopics = new Set(getMemoryTopics(currentContext));
  const conversationTopics = new Set(getMemoryTopics(conversationContext));

  return memoryEntries
    .map((entry, index) => {
      if (
        (entry.status && entry.status !== 'approved') ||
        !VALID_MEMORY_CATEGORIES.has(entry.category) ||
        !isSafeMemoryText(entry.content)
      ) return null;

      const memoryTokens = new Set(toSemanticTokens(entry.content));
      const directTerms = [...memoryTokens].filter((token) => currentTokens.has(token));
      const conversationTerms = [...memoryTokens]
        .filter((token) => conversationTokens.has(token) && !currentTokens.has(token));
      const memoryTopics = getMemoryTopics(entry.content);
      const directTopics = memoryTopics.filter((topic) => currentTopics.has(topic));
      const recentTopics = memoryTopics
        .filter((topic) => conversationTopics.has(topic) && !currentTopics.has(topic));
      const score = directTerms.length * 3 + directTopics.length * 5 +
        conversationTerms.length + recentTopics.length * 2;
      if (score < 3) return null;

      const selectionReason = directTopics.length > 0
        ? `Selected because it is relevant to the current ${directTopics[0]} topic.`
        : directTerms.length > 0
        ? `Selected because it shares the key term "${directTerms[0]}" with the current question.`
        : recentTopics.length > 0
        ? `Selected because it is relevant to the recent ${recentTopics[0]} discussion.`
        : `Selected because it connects to the recent term "${conversationTerms[0]}".`;

      return { entry: { ...entry, selectionReason }, score, index };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_SELECTED_MEMORIES)
    .map(({ entry }) => entry);
};

export const getRetryDecision = ({
  hasUserContent,
  hasDeliveredQuestion,
  answeredCurrentQuestion,
  unansweredAttemptCount,
}) => {
  const hasUnansweredTurn =
    hasUserContent && hasDeliveredQuestion && !answeredCurrentQuestion;
  return {
    shouldRepeatQuestion:
      hasUnansweredTurn && unansweredAttemptCount < MAX_UNANSWERED_ATTEMPTS,
    shouldForceProgress:
      hasUnansweredTurn && unansweredAttemptCount >= MAX_UNANSWERED_ATTEMPTS,
  };
};

const normalizeMemoryContent = (content = '') => content.trim().replace(/\s+/g, ' ').toLowerCase();

const savePendingMemorySuggestions = async ({ userId, sessionId, suggestions = [] }) => {
  const normalizedSuggestions = suggestions
    .map((suggestion) => ({
      ...suggestion,
      category: suggestion.category?.trim(),
      content: suggestion.content?.trim(),
      evidence: suggestion.evidence?.trim(),
      reason: suggestion.reason?.trim(),
    }))
    .filter((suggestion) =>
      SYSTEM_SUGGESTION_CATEGORIES.has(suggestion.category) &&
      suggestion.content &&
      suggestion.evidence &&
      suggestion.reason &&
      isSafeMemoryText(suggestion.content) &&
      isSafeMemoryText(suggestion.evidence)
    );

  if (normalizedSuggestions.length === 0) return [];

  const memory = await Memory.findOne({ userId });
  const existingContent = new Set(
    (memory?.entries || [])
      .filter((entry) => entry.status !== 'rejected')
      .map((entry) => normalizeMemoryContent(entry.content))
  );

  const entriesToAdd = normalizedSuggestions
    .filter((suggestion) => {
      const normalized = normalizeMemoryContent(suggestion.content);
      if (existingContent.has(normalized)) return false;
      existingContent.add(normalized);
      return true;
    })
    .map((suggestion) => ({
      category: suggestion.category,
      content: suggestion.content,
      evidence: suggestion.evidence,
      reason: suggestion.reason,
      addedBy: 'system',
      status: 'pending',
      sourceSessionId: sessionId,
    }));

  if (entriesToAdd.length === 0) return [];

  const updatedMemory = await Memory.findOneAndUpdate(
    { userId },
    { $push: { entries: { $each: entriesToAdd } } },
    { new: true, upsert: true }
  ).lean();

  const addedContent = new Set(entriesToAdd.map((entry) => normalizeMemoryContent(entry.content)));
  return (updatedMemory?.entries || [])
    .filter((entry) => entry.status === 'pending' && addedContent.has(normalizeMemoryContent(entry.content)))
    .map((entry) => ({
      id: entry._id,
      category: entry.category,
      content: entry.content,
      evidence: entry.evidence,
      reason: entry.reason,
      status: entry.status,
    }));
};

export const getSessionTurnContext = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  const user = await User.findById(session.userId).lean();
  const memoryEntries = await getMemoryEntries(session.userId);
  const recentMessages = await Message.find({ sessionId })
    .sort({ timestamp: -1 })
    .limit(RECENT_MESSAGE_LIMIT)
    .lean();
  const { step, boundedIndex, isFinalStep, totalSteps } = getScriptStep(
    session.scriptId,
    session.scriptStepIndex || 0
  );
  const slide = toSlide({ step, index: boundedIndex, total: totalSteps });
  const nextStep = isFinalStep ? null : getScriptStep(session.scriptId, boundedIndex + 1).step;
  const nextSlide = nextStep
    ? toSlide({
        step: nextStep,
        index: boundedIndex + 1,
        total: totalSteps,
      })
    : null;

  return {
    session,
    user,
    memoryEntries,
    recentMessages: recentMessages.reverse(),
    step,
    nextStep,
    slide,
    nextSlide,
    boundedIndex,
    isFinalStep,
    totalSteps,
  };
};

// TODO: wrap writes in a MongoDB transaction when upgrading to Atlas M10+ (replica set required)
export const respondToSessionTurn = async ({ sessionId, content }) => {
  const userContent = content?.trim();

  const context = await getSessionTurnContext(sessionId);
  const { session, user, memoryEntries, recentMessages, step, nextStep, slide, nextSlide, boundedIndex, isFinalStep, totalSteps } = context;

  const hasMusicCompletionProtocol = isMusicCompletionProtocol(userContent || '');
  const hasVideoCompletionProtocol = isVideoCompletionProtocol(userContent || '');
  const hasWheelProtocol = isQuestionWheelProtocol(userContent || '');
  const wheelEvent = parseQuestionWheelEvent(userContent || '', step);
  if (hasWheelProtocol && !wheelEvent) {
    const err = new Error('Invalid question wheel option');
    err.status = 400;
    throw err;
  }

  assertCanUseSession(session, 'respond');

  if (session.status === 'pending') {
    session.status = 'active';
    session.startedAt = session.startedAt || new Date();
  }

  const stepTurns = step.turns || 1;
  const currentTurnIndex = session.scriptStepTurnIndex || 0;
  const effectiveTurnIndex = currentTurnIndex || (hasPriorAssistantTurn(recentMessages) ? 1 : 0);
  if (
    hasMusicCompletionProtocol &&
    (step.interaction?.type !== 'spotifySong' || effectiveTurnIndex !== 1)
  ) {
    const err = new Error('Music completion is not expected at this point');
    err.status = 409;
    throw err;
  }
  if (
    hasVideoCompletionProtocol &&
    (step.interaction?.type !== 'youtubeShort' || effectiveTurnIndex !== 1)
  ) {
    const err = new Error('Video completion is not expected at this point');
    err.status = 409;
    throw err;
  }
  const currentRetryCount = session.scriptStepRetryCount || 0;
  const llmProvider = getLlmProviderForSession(session);
  const useFastScriptedTurn = isOpenAIFastScriptedPipeline(session.pipelineMode);
  const persistedWheelState = session.interactionState?.questionWheel;
  const persistedAdaptiveFollowUp = session.interactionState?.adaptiveFollowUp;
  const activeAdaptiveFollowUp =
    persistedAdaptiveFollowUp?.stepId === step.id ? persistedAdaptiveFollowUp : null;
  const awaitingWheelResult = Boolean(
    step.interaction?.type === 'questionWheel' &&
    effectiveTurnIndex > 0 &&
    persistedWheelState?.status !== 'landed'
  );
  if (awaitingWheelResult && userContent && !wheelEvent) {
    const err = new Error('Spin the question wheel before answering');
    err.status = 409;
    throw err;
  }

  let userMessage = null;
  if (userContent) {
    const messageContent = wheelEvent
      ? `Question wheel landed on ${wheelEvent.label}.`
      : hasMusicCompletionProtocol
      ? 'Music playback completed.'
      : hasVideoCompletionProtocol
      ? 'Exercise video completed.'
      : userContent;
    userMessage = await Message.create({ sessionId, role: 'user', content: messageContent });
  }

  const needsCurrentAffairs = [step, nextStep].some(
    (candidate) => candidate?.id === 'childhood_current_affairs'
  );
  const currentAffairs = needsCurrentAffairs
    ? session.interactionState?.currentAffairs || await getPositiveNzNews()
    : null;
  let themeSong = session.interactionState?.themeSong || null;
  const scriptContext = {
    name: getDisplayName(user),
    wheelQuestion: wheelEvent?.question || session.interactionState?.questionWheel?.question,
    currentAffairs,
    themeSong,
  };
  const hasUserContent = Boolean(userContent);
  const hasDeliveredQuestion = effectiveTurnIndex > 0;
  const expectedQuestion =
    activeAdaptiveFollowUp?.question ||
    getAskedScriptLine(step, effectiveTurnIndex, scriptContext);
  const plannedNextLine = getProgressScriptLine({
    step,
    nextStep,
    currentTurnIndex: effectiveTurnIndex,
    stepTurns,
    context: scriptContext,
  });
  const selectedMemoryEntries = selectRelevantMemoryEntries({
    memoryEntries,
    currentQuestion: expectedQuestion,
    step,
    recentMessages,
    userContent: userContent || '',
  });
  let promptedMemoryEntries = [];
  const isQuestionWheelEvent = Boolean(wheelEvent && step.id === 'childhood_spin_question');
  const newsElaborationRequested = Boolean(
    step.id === 'childhood_current_affairs' &&
    hasDeliveredQuestion &&
    isNewsElaborationRequest(userContent || '')
  );
  const allowAdaptiveFollowUp = canRequestAdaptiveFollowUp({
    step,
    effectiveTurnIndex,
    hasActiveFollowUp: Boolean(activeAdaptiveFollowUp),
  });
  const storedAnswers = Array.isArray(session.interactionState?.sessionAnswers)
    ? session.interactionState.sessionAnswers
    : [];
  let sessionAnswers = storedAnswers;
  scriptContext.sessionSummary = buildSessionSummary(storedAnswers);

  let answeredCurrentQuestion = true;
  let adaptiveText = '';
  let adaptiveFollowUpQuestion = null;
  if (!isQuestionWheelEvent && userContent && hasDeliveredQuestion) {
    const deterministicTurn = evaluateOrientationAnswer({
      step,
      content: userContent,
      retryCount: currentRetryCount,
    }) || evaluateMusicCompletionAnswer({
      step,
      content: userContent,
      effectiveTurnIndex,
    }) || evaluateVideoCompletionAnswer({
      step,
      content: userContent,
      effectiveTurnIndex,
    }) || evaluateNewsElaborationRequest({
      step,
      content: userContent,
      currentAffairs,
    });
    let adaptiveTurn = deterministicTurn;
    if (!adaptiveTurn) {
      promptedMemoryEntries = selectedMemoryEntries;
      adaptiveTurn = parseAdaptiveTurn(await generateResponse(
        [
          {
            role: 'system',
            content: buildCstAdaptiveTurnInstructions({
              user,
              memoryEntries: selectedMemoryEntries,
              slide,
              recentMessages,
              scriptId: session.scriptId,
              expectedQuestion,
              plannedNextLine,
              allowFollowUp: allowAdaptiveFollowUp,
              followUpGuidance: step.adaptiveFollowUp?.guidance || '',
            }),
          },
          { role: 'user', content: userContent },
        ],
        {
          provider: llmProvider,
          temperature: 0.25,
          maxTokens: 110,
          model: useFastScriptedTurn ? process.env.OPENAI_FAST_TEXT_MODEL : undefined,
        }
      ));
    }
    answeredCurrentQuestion = adaptiveTurn.answered;
    adaptiveText = adaptiveTurn.response;
    adaptiveFollowUpQuestion =
      answeredCurrentQuestion && allowAdaptiveFollowUp ? adaptiveTurn.followUp : null;
  }

  if (
    hasDeliveredQuestion &&
    answeredCurrentQuestion &&
    !newsElaborationRequested &&
    isRecordableSessionAnswer({ step, content: userContent, wheelEvent })
  ) {
    sessionAnswers = activeAdaptiveFollowUp
      ? attachAdaptiveFollowUpAnswer({
          answers: storedAnswers,
          step,
          question: activeAdaptiveFollowUp.question,
          content: userContent,
        })
      : [...storedAnswers, toSessionAnswer({ step, content: userContent })];
    scriptContext.sessionSummary = buildSessionSummary(sessionAnswers);
    if (step.id === 'theme_song_choice' && !activeAdaptiveFollowUp) {
      themeSong = await searchSpotifyTrack(userContent);
      scriptContext.themeSong = themeSong;
    }
  }

  const requiresMusicCompletion = Boolean(
    step.interaction?.type === 'spotifySong' && effectiveTurnIndex === 1
  );
  const requiresVideoCompletion = Boolean(
    step.interaction?.type === 'youtubeShort' && effectiveTurnIndex === 1
  );
  const requiresMediaCompletion = requiresMusicCompletion || requiresVideoCompletion;
  const unansweredAttemptCount =
    hasUserContent && hasDeliveredQuestion && !answeredCurrentQuestion ? currentRetryCount + 1 : 0;
  const { shouldRepeatQuestion, shouldForceProgress } = getRetryDecision({
    hasUserContent,
    hasDeliveredQuestion,
    answeredCurrentQuestion,
    unansweredAttemptCount,
  });
  const canProgress = hasUserContent && hasDeliveredQuestion && (answeredCurrentQuestion || shouldForceProgress);
  const shouldAskAdaptiveFollowUp = Boolean(
    hasUserContent &&
    hasDeliveredQuestion &&
    answeredCurrentQuestion &&
    adaptiveFollowUpQuestion
  );
  const shouldElaborateNews = Boolean(
    hasUserContent &&
    answeredCurrentQuestion &&
    newsElaborationRequested
  );
  const shouldAdvance =
    canProgress &&
    !shouldAskAdaptiveFollowUp &&
    !shouldElaborateNews &&
    !isFinalStep &&
    effectiveTurnIndex >= stepTurns;
  const scriptedNextLine = shouldRepeatQuestion
    ? requiresMediaCompletion
      ? requiresMusicCompletion
        ? 'When you have finished or want to skip the music, press Done, or say or type done.'
        : 'When you have finished or want to skip the exercise, press Done, or say or type done.'
      : expectedQuestion
    : shouldAskAdaptiveFollowUp
    ? adaptiveFollowUpQuestion
    : shouldElaborateNews
    ? currentAffairs?.status === 'available'
      ? 'What part of that story stands out to you?'
      : 'Have you heard anything pleasant or interesting lately?'
    : hasUserContent && hasDeliveredQuestion
    ? getProgressScriptLine({ step, nextStep, currentTurnIndex: effectiveTurnIndex, stepTurns, context: scriptContext })
    : expectedQuestion || renderScriptReply(step, scriptContext);
  const answerState = shouldRepeatQuestion
    ? 'repeat_question'
    : shouldAskAdaptiveFollowUp
    ? 'adaptive_follow_up'
    : shouldForceProgress
    ? 'move_on_after_retries'
    : 'answered';

  let assistantText = scriptedNextLine;
  if (userContent && !adaptiveText && !isQuestionWheelEvent) {
    promptedMemoryEntries = selectedMemoryEntries;
    const systemPrompt = buildCstAdaptiveResponseInstructions({
      user,
      memoryEntries: selectedMemoryEntries,
      slide,
      recentMessages,
      scriptId: session.scriptId,
      scriptedNextLine,
      isFinalStep,
      answerState,
    });
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];
    adaptiveText = await generateResponse(llmMessages, {
      provider: llmProvider,
      temperature: 0.4,
      maxTokens: 60,
      model: useFastScriptedTurn ? process.env.OPENAI_FAST_TEXT_MODEL : undefined,
    });
  }

  if (userContent) {
    if (hasSubstantialSpeechOverlap(adaptiveText, scriptedNextLine)) {
      adaptiveText = '';
    }
    assistantText = joinSpeechParts(adaptiveText, scriptedNextLine);
  }

  const assistantMessage = await Message.create({ sessionId, role: 'assistant', content: assistantText });
  const nextStepIndex = shouldAdvance ? boundedIndex + 1 : boundedIndex;
  const nextTurnIndex = !hasUserContent
    ? Math.max(currentTurnIndex, 1)
    : shouldRepeatQuestion
    ? currentTurnIndex
    : shouldAdvance
    ? 1
    : effectiveTurnIndex + 1;
  session.scriptStepTurnIndex = nextTurnIndex;
  session.scriptStepRetryCount = !hasUserContent
    ? currentRetryCount
    : shouldRepeatQuestion
    ? unansweredAttemptCount
    : 0;
  session.scriptStepIndex = nextStepIndex;
  const displaySlide = shouldAdvance ? nextSlide : slide;
  session.presentationState = {
    slideIndex: displaySlide.index,
    deckSlide: displaySlide.deckSlide,
    imageUrl: displaySlide.imageUrl,
    title: displaySlide.title,
    subtitle: displaySlide.subtitle,
    prompt: displaySlide.prompt,
    bullets: displaySlide.bullets,
    visualHint: displaySlide.visualHint,
    accent: displaySlide.accent,
    interaction: displaySlide.interaction,
  };
  const nextInteractionState = {
    ...(session.interactionState || {}),
    sessionAnswers,
  };
  if (themeSong) {
    nextInteractionState.themeSong = themeSong;
  }
  if (shouldAskAdaptiveFollowUp) {
    nextInteractionState.adaptiveFollowUp = {
      stepId: step.id,
      question: adaptiveFollowUpQuestion,
    };
  } else if (
    nextInteractionState.adaptiveFollowUp &&
    nextInteractionState.adaptiveFollowUp.stepId !== displaySlide.id
  ) {
    delete nextInteractionState.adaptiveFollowUp;
  }
  if (isQuestionWheelEvent) {
    nextInteractionState.questionWheel = wheelEvent;
  } else if (displaySlide.interaction?.type === 'questionWheel') {
    nextInteractionState.questionWheel = nextInteractionState.questionWheel?.status === 'landed'
      ? nextInteractionState.questionWheel
      : { status: 'pending' };
  } else {
    delete nextInteractionState.questionWheel;
  }
  if (displaySlide.id === 'childhood_current_affairs') {
    nextInteractionState.currentAffairs = currentAffairs;
  } else {
    delete nextInteractionState.currentAffairs;
  }
  if (displaySlide.interaction?.type === 'youtubeShort') {
    nextInteractionState.exercisePlayback = { status: 'awaiting-completion' };
  } else {
    delete nextInteractionState.exercisePlayback;
  }
  if (displaySlide.id === 'childhood_summary_song') {
    nextInteractionState.musicPlayback =
      !hasUserContent && currentTurnIndex === 0
        ? { status: 'awaiting-completion' }
        : requiresMusicCompletion && hasUserContent && answeredCurrentQuestion
        ? { status: 'complete' }
        : nextInteractionState.musicPlayback?.status === 'complete'
        ? nextInteractionState.musicPlayback
        : { status: 'awaiting-completion' };
  } else {
    delete nextInteractionState.musicPlayback;
  }
  if (step.id === 'childhood_summary_song' && displaySlide.id !== 'childhood_summary_song') {
    delete nextInteractionState.sessionAnswers;
  }
  session.interactionState = nextInteractionState;
  await session.save();

  let suggestedMemoryUpdates = [];
  try {
    suggestedMemoryUpdates = await savePendingMemorySuggestions({
      userId: session.userId,
      sessionId: session._id,
      suggestions:
        wheelEvent || hasMusicCompletionProtocol || hasVideoCompletionProtocol || !answeredCurrentQuestion
          ? []
          : inferMemorySuggestions(userContent),
    });
  } catch (err) {
    console.warn('[memory] Skipping suggested memory updates:', err.message);
  }

  return {
    sessionId: session._id,
    sessionStatus: session.status,
    scriptId: session.scriptId,
    pipelineMode: session.pipelineMode,
    scriptStep: {
      id: step.id,
      index: boundedIndex,
      nextIndex: nextStepIndex,
      turnIndex: session.scriptStepTurnIndex,
      retryCount: session.scriptStepRetryCount,
      answeredCurrentQuestion,
      forcedProgress: shouldForceProgress,
      progressionSource: useFastScriptedTurn ? 'llm-assisted-fast-script' : 'llm-assisted',
      isFinalStep,
      total: totalSteps,
    },
    slide: displaySlide,
    currentAffairs: displaySlide.id === 'childhood_current_affairs' ? currentAffairs : null,
    exercisePlayback:
      displaySlide.interaction?.type === 'youtubeShort'
        ? session.interactionState?.exercisePlayback || null
        : null,
    themeSong: displaySlide.id === 'childhood_summary_song' ? themeSong : null,
    musicPlayback:
      displaySlide.id === 'childhood_summary_song'
        ? session.interactionState?.musicPlayback || null
        : null,
    questionWheel: session.interactionState?.questionWheel || null,
    assistantText,
    avatar: buildAvatarResponse({ text: assistantText }),
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
    memoryUsed: promptedMemoryEntries.map((entry) => ({
      id: entry._id,
      category: entry.category,
      content: entry.content,
      selectionReason: entry.selectionReason,
    })),
    suggestedMemoryUpdates,
  };
};
