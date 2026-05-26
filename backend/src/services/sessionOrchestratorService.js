import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import { getScriptStep } from './cstScriptService.js';

const RECENT_MESSAGE_LIMIT = 12;

const getDisplayName = (user) => user?.preferredName || user?.name || 'there';

const getMemoryForUser = async (userId) => {
  const memory = await Memory.findOne({ userId });
  return memory?.entries || [];
};

const pickMemoryLine = (entries = []) => {
  const personalEntry = entries.find((entry) =>
    ['personal', 'preference', 'caregiver_note'].includes(entry.category)
  );
  return personalEntry?.content || '';
};

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

  const grewUpMatch = text.match(/\b(?:i grew up in|i was born in|i lived in) ([^.!?]+)/i);
  if (grewUpMatch) {
    suggestions.push({
      category: 'personal',
      content: `Place from life history: ${grewUpMatch[1].trim()}`,
      reason: 'User shared autobiographical context.',
    });
  }

  const familyMatch = text.match(/\b(?:my|our) (?:daughter|son|wife|husband|partner|sister|brother|mother|father|grandchild|grandson|granddaughter) (?:is|was|called|named) ([^.!?]+)/i);
  if (familyMatch) {
    suggestions.push({
      category: 'personal',
      content: `Family detail: ${familyMatch[0].trim()}`,
      reason: 'User shared a family detail.',
    });
  }

  return suggestions;
};

export const respondToSessionTurn = async ({ sessionId, content }) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  if (!['active', 'pending'].includes(session.status)) {
    const err = new Error(`Cannot respond to a ${session.status} session`);
    err.status = 409;
    throw err;
  }

  if (session.status === 'pending') {
    session.status = 'active';
    session.startedAt = session.startedAt || new Date();
  }

  const user = await User.findById(session.userId);
  const memoryEntries = await getMemoryForUser(session.userId);
  const userContent = content?.trim();
  let userMessage = null;

  if (userContent) {
    userMessage = await Message.create({
      sessionId,
      role: 'user',
      content: userContent,
    });
  }

  const recentMessages = await Message.find({ sessionId })
    .sort({ timestamp: -1 })
    .limit(RECENT_MESSAGE_LIMIT)
    .lean();

  const { step, boundedIndex, isFinalStep, totalSteps } = getScriptStep(
    session.scriptId,
    session.scriptStepIndex || 0
  );

  const assistantText = step.reply({
    name: getDisplayName(user),
    memoryLine: pickMemoryLine(memoryEntries),
    recentMessages: recentMessages.reverse(),
    userMessage,
  });

  const assistantMessage = await Message.create({
    sessionId,
    role: 'assistant',
    content: assistantText,
  });

  const nextStepIndex = isFinalStep ? boundedIndex : boundedIndex + 1;
  const slide = {
    index: boundedIndex,
    total: totalSteps,
    id: step.id,
    title: step.title,
    prompt: step.prompt,
    visualHint: step.visualHint,
  };

  session.scriptStepIndex = nextStepIndex;
  session.presentationState = {
    slideIndex: slide.index,
    title: slide.title,
    prompt: slide.prompt,
    visualHint: slide.visualHint,
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
    assistantText,
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
