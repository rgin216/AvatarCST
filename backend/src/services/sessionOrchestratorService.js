import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { buildAvatarResponse } from './avatarService.js';
import { getScriptStep } from './cstScriptService.js';
import { buildCstRealtimeInstructions } from './promptService.js';
import { mintRealtimeClientSecret } from './realtimeService.js';

const RECENT_MESSAGE_LIMIT = 12;

const getDisplayName = (user) => user?.preferredName || user?.name || 'there';

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
  imageUrl: step.deckSlide ? `/slides/session1/slide-${String(step.deckSlide).padStart(2, '0')}.jpg` : null,
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

  return {
    session,
    user,
    memoryEntries,
    recentMessages: recentMessages.reverse(),
    step,
    slide,
    boundedIndex,
    isFinalStep,
    totalSteps,
  };
};

export const respondToSessionTurn = async ({ sessionId, content }) => {
  const context = await getSessionTurnContext(sessionId);
  const { session, user, memoryEntries, recentMessages, step, slide, boundedIndex, isFinalStep, totalSteps } = context;

  if (!['active', 'pending'].includes(session.status)) {
    const err = new Error(`Cannot respond to a ${session.status} session`);
    err.status = 409;
    throw err;
  }

  if (session.status === 'pending') {
    session.status = 'active';
    session.startedAt = session.startedAt || new Date();
  }

  const userContent = content?.trim();
  let userMessage = null;
  if (userContent) {
    userMessage = await Message.create({ sessionId, role: 'user', content: userContent });
  }

  const assistantText = step.reply({
    name: getDisplayName(user),
    memoryLine: pickMemoryLine(memoryEntries),
    recentMessages,
    userMessage,
  });

  const assistantMessage = await Message.create({
    sessionId,
    role: 'assistant',
    content: assistantText,
  });

  const nextStepIndex = isFinalStep ? boundedIndex : boundedIndex + 1;
  session.scriptStepIndex = nextStepIndex;
  session.presentationState = {
    slideIndex: slide.index,
    deckSlide: slide.deckSlide,
    imageUrl: slide.imageUrl,
    title: slide.title,
    subtitle: slide.subtitle,
    prompt: slide.prompt,
    bullets: slide.bullets,
    visualHint: slide.visualHint,
    accent: slide.accent,
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
      isFinalStep,
      total: totalSteps,
    },
    slide,
    prompt: {
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
      instructions: buildCstRealtimeInstructions({ user, memoryEntries, slide, recentMessages }),
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
  const secret = await mintRealtimeClientSecret(context);
  return {
    sessionId,
    slide: context.slide,
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
    voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
    clientSecret: secret,
  };
};
