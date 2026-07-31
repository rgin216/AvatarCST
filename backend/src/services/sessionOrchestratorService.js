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

const parseAdaptiveTurn = (text = '') => {
  const parsed = extractJsonObject(text);
  if (parsed) {
    const explicitAnswerQuality = parseAnswerQuality(text);
    return {
      answered: typeof parsed.answered === 'boolean' ? parsed.answered : explicitAnswerQuality === true,
      response: typeof parsed?.response === 'string' ? parsed.response.trim() : '',
    };
  }

  const explicitAnswerQuality = parseAnswerQuality(text);
  return {
    answered: explicitAnswerQuality === true,
    response: text
      .replace(/```(?:json)?[\s\S]*?```/gi, '')
      .replace(/\{[\s\S]*$/, '')
      .replace(/^(response:|aria says:?|as aria,?)\s*/i, '')
      .trim(),
  };
};

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
    !['childhood_summary_song', 'childhood_closing'].includes(step.id)
  );

const toSessionAnswer = ({ step, content }) => ({
  stepId: step.id,
  title: step.title,
  prompt: step.prompt,
  answer: content.trim(),
});

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

export const buildSessionSummary = (answers = []) => {
  const meaningful = answers
    .filter((item) => item.answer && !/^ok(?:ay)?$|^yes$|^no$|^continue$/i.test(item.answer))
    .slice(-8);

  const byStep = new Map(meaningful.map((item) => [item.stepId, item.answer]));
  const highlights = [];

  if (byStep.has('theme_song_choice')) {
    highlights.push(`you chose ${normalizeSongQuery(byStep.get('theme_song_choice'))} as your theme song`);
  }
  if (byStep.has('childhood_birthplace')) {
    highlights.push(asSummaryClause(byStep.get('childhood_birthplace'), 'you talked about'));
  }
  if (byStep.has('childhood_parents')) highlights.push(`you shared your parents' names`);
  if (byStep.has('childhood_siblings')) highlights.push(`you talked about brothers or sisters`);
  if (byStep.has('childhood_school')) {
    highlights.push(asSummaryClause(byStep.get('childhood_school'), 'you remembered'));
  }
  if (byStep.has('childhood_first_job')) {
    highlights.push(asSummaryClause(byStep.get('childhood_first_job'), 'you mentioned'));
  }
  if (byStep.has('childhood_modern_family')) {
    highlights.push(asSummaryClause(byStep.get('childhood_modern_family'), 'you shared'));
  }
  if (byStep.has('childhood_spin_question')) {
    highlights.push(asSummaryClause(
      byStep.get('childhood_spin_question'),
      'you answered the wheel question with'
    ));
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

const inferMemorySuggestions = (content = '') => {
  const text = content.trim();
  if (!text) return [];

  const suggestions = [];
  const favouriteMatch = text.match(/\b(?:my )?favou?rite ([a-z ]{3,30}) is ([^.!?]+)/i);
  if (favouriteMatch) {
    suggestions.push({
      category: 'preference',
      content: `Favourite ${favouriteMatch[1].trim()}: ${favouriteMatch[2].trim()}`,
      reason: 'User stated a preference during the session.',
    });
  }

  const placeMatch = text.match(/\b(?:i grew up in|i was born in|i lived in) ([^.!?]+)/i);
  if (placeMatch) {
    suggestions.push({
      category: 'personal',
      content: `Place from life history: ${placeMatch[1].trim()}`,
      reason: 'User shared autobiographical context.',
    });
  }

  return suggestions;
};

const normalizeMemoryContent = (content = '') => content.trim().replace(/\s+/g, ' ').toLowerCase();

const savePendingMemorySuggestions = async ({ userId, sessionId, suggestions = [] }) => {
  const normalizedSuggestions = suggestions
    .map((suggestion) => ({
      ...suggestion,
      content: suggestion.content?.trim(),
      reason: suggestion.reason?.trim(),
    }))
    .filter((suggestion) => suggestion.content);

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
  const currentRetryCount = session.scriptStepRetryCount || 0;
  const llmProvider = getLlmProviderForSession(session);
  const useFastScriptedTurn = isOpenAIFastScriptedPipeline(session.pipelineMode);
  const persistedWheelState = session.interactionState?.questionWheel;
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
      : userContent;
    userMessage = await Message.create({ sessionId, role: 'user', content: messageContent });
  }

  const needsCurrentAffairs = [step, nextStep].some(
    (candidate) => candidate?.id === 'childhood_current_affairs'
  );
  const currentAffairs = needsCurrentAffairs ? await getPositiveNzNews() : null;
  let themeSong = session.interactionState?.themeSong || null;
  const scriptContext = {
    name: getDisplayName(user),
    wheelQuestion: wheelEvent?.question || session.interactionState?.questionWheel?.question,
    currentAffairs,
    themeSong,
  };
  const hasUserContent = Boolean(userContent);
  const hasDeliveredQuestion = effectiveTurnIndex > 0;
  const expectedQuestion = getAskedScriptLine(step, effectiveTurnIndex, scriptContext);
  const isQuestionWheelEvent = Boolean(wheelEvent && step.id === 'childhood_spin_question');
  const storedAnswers = Array.isArray(session.interactionState?.sessionAnswers)
    ? session.interactionState.sessionAnswers
    : [];
  let sessionAnswers = storedAnswers;
  scriptContext.sessionSummary = buildSessionSummary(storedAnswers);

  let answeredCurrentQuestion = true;
  let adaptiveText = '';
  if (!isQuestionWheelEvent && userContent && hasDeliveredQuestion) {
    const deterministicTurn = evaluateOrientationAnswer({
      step,
      content: userContent,
      retryCount: currentRetryCount,
    });
    const adaptiveTurn = deterministicTurn || parseAdaptiveTurn(await generateResponse(
      [
        {
          role: 'system',
          content: buildCstAdaptiveTurnInstructions({
            user,
            memoryEntries,
            slide,
            recentMessages,
            scriptId: session.scriptId,
            expectedQuestion,
          }),
        },
        { role: 'user', content: userContent },
      ],
      {
        provider: llmProvider,
        temperature: 0.25,
        maxTokens: 80,
        model: useFastScriptedTurn ? process.env.OPENAI_FAST_TEXT_MODEL : undefined,
      }
    ));
    answeredCurrentQuestion = adaptiveTurn.answered;
    adaptiveText = adaptiveTurn.response;
  }

  if (
    hasDeliveredQuestion &&
    answeredCurrentQuestion &&
    isRecordableSessionAnswer({ step, content: userContent, wheelEvent })
  ) {
    sessionAnswers = [...storedAnswers, toSessionAnswer({ step, content: userContent })];
    scriptContext.sessionSummary = buildSessionSummary(sessionAnswers);
    if (step.id === 'theme_song_choice') {
      themeSong = await searchSpotifyTrack(userContent);
      scriptContext.themeSong = themeSong;
    }
  }

  const unansweredAttemptCount =
    hasUserContent && hasDeliveredQuestion && !answeredCurrentQuestion ? currentRetryCount + 1 : 0;
  const shouldRepeatQuestion = hasUserContent && hasDeliveredQuestion && !answeredCurrentQuestion && unansweredAttemptCount < MAX_UNANSWERED_ATTEMPTS;
  const shouldForceProgress = hasUserContent && hasDeliveredQuestion && !answeredCurrentQuestion && unansweredAttemptCount >= MAX_UNANSWERED_ATTEMPTS;
  const canProgress = hasUserContent && hasDeliveredQuestion && (answeredCurrentQuestion || shouldForceProgress);
  const shouldAdvance = canProgress && !isFinalStep && effectiveTurnIndex >= stepTurns;
  const scriptedNextLine = shouldRepeatQuestion
    ? expectedQuestion
    : hasUserContent && hasDeliveredQuestion
    ? getProgressScriptLine({ step, nextStep, currentTurnIndex: effectiveTurnIndex, stepTurns, context: scriptContext })
    : expectedQuestion || renderScriptReply(step, scriptContext);
  const answerState = shouldRepeatQuestion
    ? 'repeat_question'
    : shouldForceProgress
    ? 'move_on_after_retries'
    : 'answered';

  let assistantText = scriptedNextLine;
  if (userContent && !adaptiveText && !isQuestionWheelEvent) {
    const systemPrompt = buildCstAdaptiveResponseInstructions({
      user,
      memoryEntries,
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
  if (isQuestionWheelEvent) {
    nextInteractionState.questionWheel = wheelEvent;
  } else if (displaySlide.interaction?.type === 'questionWheel') {
    nextInteractionState.questionWheel = nextInteractionState.questionWheel?.status === 'landed'
      ? nextInteractionState.questionWheel
      : { status: 'pending' };
  } else {
    delete nextInteractionState.questionWheel;
  }
  if (displaySlide.id === 'childhood_summary_song') {
    delete nextInteractionState.sessionAnswers;
  }
  session.interactionState = nextInteractionState;
  await session.save();

  let suggestedMemoryUpdates = [];
  try {
    suggestedMemoryUpdates = await savePendingMemorySuggestions({
      userId: session.userId,
      sessionId: session._id,
      suggestions: wheelEvent ? [] : inferMemorySuggestions(userContent),
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
    themeSong: displaySlide.id === 'childhood_summary_song' ? themeSong : null,
    questionWheel: session.interactionState?.questionWheel || null,
    assistantText,
    avatar: buildAvatarResponse({ text: assistantText }),
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
    memoryUsed: memoryEntries.slice(0, 4).map((entry) => ({
      id: entry._id,
      category: entry.category,
      content: entry.content,
    })),
    suggestedMemoryUpdates,
  };
};
