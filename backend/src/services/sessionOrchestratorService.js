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
      response: `Good try, but it is actually ${expected}. Let's try it again.`,
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

const parseQuestionWheelEvent = (content = '') => {
  const match = content.trim().match(/^\[\[question-wheel:(.+)\]\]$/s);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed?.label || !parsed?.question) return null;
    return {
      label: String(parsed.label).trim(),
      question: String(parsed.question).trim(),
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

const buildSessionSummary = (answers = []) => {
  const meaningful = answers
    .filter((item) => item.answer && !/^ok(?:ay)?$|^yes$|^no$|^continue$/i.test(item.answer))
    .slice(-8);

  const byStep = new Map(meaningful.map((item) => [item.stepId, item.answer]));
  const highlights = [];

  if (byStep.has('theme_song_choice')) highlights.push(`you chose ${byStep.get('theme_song_choice')} as a song idea`);
  if (byStep.has('childhood_birthplace')) highlights.push(`you talked about ${byStep.get('childhood_birthplace')}`);
  if (byStep.has('childhood_parents')) highlights.push(`you shared your parents' names`);
  if (byStep.has('childhood_siblings')) highlights.push(`you talked about brothers or sisters`);
  if (byStep.has('childhood_school')) highlights.push(`you remembered ${byStep.get('childhood_school')}`);
  if (byStep.has('childhood_first_job')) highlights.push(`you mentioned ${byStep.get('childhood_first_job')}`);
  if (byStep.has('childhood_modern_family')) highlights.push(`you gave your view on modern family life`);
  if (byStep.has('childhood_spin_question')) highlights.push(`the wheel question led us to ${byStep.get('childhood_spin_question')}`);

  if (highlights.length === 0) {
    const fallback = meaningful
      .filter((item) => !ORIENTATION_STEP_TYPES[item.stepId])
      .slice(-3)
      .map((item) => item.answer);
    if (fallback.length > 0) highlights.push(`you shared ${fallback.join(', ')}`);
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
  const wheelEvent = parseQuestionWheelEvent(userContent || '');

  const context = await getSessionTurnContext(sessionId);
  const { session, user, memoryEntries, recentMessages, step, nextStep, slide, nextSlide, boundedIndex, isFinalStep, totalSteps } = context;

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

  let userMessage = null;
  if (userContent) {
    const messageContent = wheelEvent
      ? `Question wheel landed on ${wheelEvent.label}.`
      : userContent;
    userMessage = await Message.create({ sessionId, role: 'user', content: messageContent });
  }

  const scriptContext = {
    name: getDisplayName(user),
    wheelQuestion: wheelEvent?.question || session.interactionState?.questionWheel?.question,
  };
  const hasUserContent = Boolean(userContent);
  const hasDeliveredQuestion = effectiveTurnIndex > 0;
  const expectedQuestion = getAskedScriptLine(step, effectiveTurnIndex, scriptContext);
  const isQuestionWheelEvent = Boolean(wheelEvent && step.id === 'childhood_spin_question');
  const storedAnswers = Array.isArray(session.interactionState?.sessionAnswers)
    ? session.interactionState.sessionAnswers
    : [];
  const sessionAnswers = isRecordableSessionAnswer({ step, content: userContent, wheelEvent })
    ? [...storedAnswers, toSessionAnswer({ step, content: userContent })]
    : storedAnswers;
  scriptContext.sessionSummary = buildSessionSummary(sessionAnswers);

  let answeredCurrentQuestion = true;
  let adaptiveText = '';
  if (isQuestionWheelEvent) {
    session.interactionState = {
      ...(session.interactionState || {}),
      questionWheel: wheelEvent,
      sessionAnswers,
    };
  } else if (userContent && hasDeliveredQuestion) {
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
  if (!isQuestionWheelEvent) {
    const nextInteractionState = {
      ...(session.interactionState || {}),
      sessionAnswers,
    };
    if (shouldAdvance) delete nextInteractionState.questionWheel;
    session.interactionState = nextInteractionState;
  }
  await session.save();

  let suggestedMemoryUpdates = [];
  try {
    suggestedMemoryUpdates = await savePendingMemorySuggestions({
      userId: session.userId,
      sessionId: session._id,
      suggestions: inferMemorySuggestions(userContent),
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
