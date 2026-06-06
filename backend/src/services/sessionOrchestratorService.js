import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { buildAvatarResponse } from './avatarService.js';
import { getScriptStep, renderScriptFollowUp, renderScriptReply } from './cstScriptService.js';
import {
  buildCstAdaptiveResponseInstructions,
  buildCstAnswerQualityInstructions,
  buildCstRealtimeInstructions,
} from './promptService.js';
import { mintRealtimeClientSecret } from './realtimeService.js';
import { generateResponse } from './llmService.js';

const RECENT_MESSAGE_LIMIT = 20;
const MAX_UNANSWERED_ATTEMPTS = 3;

const getDisplayName = (user) => user?.preferredName || user?.name || 'there';

const joinSpeechParts = (...parts) => parts.map((part) => part?.trim()).filter(Boolean).join(' ');

const parseAnswerQuality = (text = '') => {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.answered === 'boolean') return parsed.answered;
  } catch {
    // Fall through to a forgiving text parse.
  }
  if (/\banswered\s*["']?\s*:\s*true\b/i.test(text) || /\btrue\b/i.test(text)) return true;
  if (/\banswered\s*["']?\s*:\s*false\b/i.test(text) || /\bfalse\b/i.test(text)) return false;
  return true;
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

const ACTIVE_SESSION_STATUSES = ['active', 'pending'];

const assertCanUseSession = (session, action) => {
  if (ACTIVE_SESSION_STATUSES.includes(session.status)) return;

  const err = new Error(`Cannot ${action} for a ${session.status} session`);
  err.status = 409;
  throw err;
};

const getMemoryEntries = async (userId) => {
  const memory = await Memory.findOne({ userId }).lean();
  return memory?.entries || [];
};

const pickMemoryLine = (entries = []) => {
  const entry = entries.find((item) => ['personal', 'preference', 'caregiver_note'].includes(item.category));
  return entry?.content || '';
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

  assertCanUseSession(session, 'respond');

  if (session.status === 'pending') {
    session.status = 'active';
    session.startedAt = session.startedAt || new Date();
  }

  const stepTurns = step.turns || 1;
  const currentTurnIndex = session.scriptStepTurnIndex || 0;
  const currentRetryCount = session.scriptStepRetryCount || 0;

  let userMessage = null;
  if (userContent) {
    userMessage = await Message.create({ sessionId, role: 'user', content: userContent });
  }

  const scriptContext = { name: getDisplayName(user) };
  const hasDeliveredQuestion = currentTurnIndex > 0;
  const expectedQuestion = getAskedScriptLine(step, currentTurnIndex, scriptContext);

  let answeredCurrentQuestion = true;
  if (userContent && hasDeliveredQuestion) {
    const qualityPrompt = buildCstAnswerQualityInstructions({
      slide,
      recentMessages,
      scriptId: session.scriptId,
      expectedQuestion,
    });
    const qualityText = await generateResponse(
      [
        { role: 'system', content: qualityPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature: 0, maxTokens: 20 }
    );
    answeredCurrentQuestion = parseAnswerQuality(qualityText);
  }

  const unansweredAttemptCount =
    userContent && hasDeliveredQuestion && !answeredCurrentQuestion ? currentRetryCount + 1 : 0;
  const shouldRepeatQuestion = Boolean(userContent) && hasDeliveredQuestion && !answeredCurrentQuestion && unansweredAttemptCount < MAX_UNANSWERED_ATTEMPTS;
  const shouldForceProgress = Boolean(userContent) && hasDeliveredQuestion && !answeredCurrentQuestion && unansweredAttemptCount >= MAX_UNANSWERED_ATTEMPTS;
  const canProgress = Boolean(userContent) && hasDeliveredQuestion && (answeredCurrentQuestion || shouldForceProgress);
  const shouldAdvance = canProgress && !isFinalStep && currentTurnIndex >= stepTurns;
  const scriptedNextLine = shouldRepeatQuestion
    ? expectedQuestion
    : getProgressScriptLine({ step, nextStep, currentTurnIndex, stepTurns, context: scriptContext });
  const answerState = shouldRepeatQuestion
    ? 'repeat_question'
    : shouldForceProgress
    ? 'move_on_after_retries'
    : 'answered';

  let assistantText = scriptedNextLine;
  if (userContent) {
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
    const adaptiveText = await generateResponse(llmMessages, { temperature: 0.4, maxTokens: 60 });
    assistantText = joinSpeechParts(adaptiveText, scriptedNextLine);
  }

  const assistantMessage = await Message.create({ sessionId, role: 'assistant', content: assistantText });
  const nextStepIndex = shouldAdvance ? boundedIndex + 1 : boundedIndex;
  const nextTurnIndex = shouldRepeatQuestion
    ? currentTurnIndex
    : shouldAdvance
    ? 1
    : currentTurnIndex + 1;
  session.scriptStepTurnIndex = nextTurnIndex;
  session.scriptStepRetryCount = shouldRepeatQuestion ? unansweredAttemptCount : 0;
  session.scriptStepIndex = nextStepIndex;
  const displaySlide = shouldAdvance ? nextSlide : slide;
  const displayNextSlide =
    nextStepIndex >= totalSteps - 1
      ? null
      : toSlide({
          step: getScriptStep(session.scriptId, nextStepIndex + 1).step,
          index: nextStepIndex + 1,
          total: totalSteps,
        });
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
  };
  await session.save();

  return {
    sessionId: session._id,
    sessionStatus: session.status,
    scriptId: session.scriptId,
    scriptStep: {
      id: step.id,
      index: boundedIndex,
      nextIndex: nextStepIndex,
      turnIndex: session.scriptStepTurnIndex,
      retryCount: session.scriptStepRetryCount,
      answeredCurrentQuestion,
      forcedProgress: shouldForceProgress,
      isFinalStep,
      total: totalSteps,
    },
    slide: displaySlide,
    prompt: {
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
      instructions: buildCstRealtimeInstructions({
        user,
        memoryEntries,
        slide: displaySlide,
        nextSlide: displayNextSlide,
        recentMessages,
        scriptId: session.scriptId,
        stepTurnIndex: session.scriptStepTurnIndex,
      }),
    },
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
    suggestedMemoryUpdates: inferMemorySuggestions(userContent),
  };
};

export const createRealtimeSessionForTurn = async (sessionId) => {
  const context = await getSessionTurnContext(sessionId);
  assertCanUseSession(context.session, 'create realtime session');
  const secret = await mintRealtimeClientSecret(context);
  return {
    sessionId,
    slide: context.slide,
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
    voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
    clientSecret: secret,
  };
};
