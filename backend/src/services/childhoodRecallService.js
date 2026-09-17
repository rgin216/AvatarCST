import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { childhoodPlaceFromMemory, childhoodPlaceFromMessages, extractChildhoodPlace } from './orientationContext.js';

export async function recallChildhoodPlace({ userId, sessionId, memoryEntries }) {
  const remembered = childhoodPlaceFromMemory(memoryEntries);
  if (remembered) return remembered;
  // Conflicting approved memories need an open question, not an older guess.
  if (memoryEntries.some(entry => (!entry.status || entry.status === 'approved') && extractChildhoodPlace(entry.content))) return null;
  // Only this participant's earlier sessions; never cross participant boundaries.
  const sessions = await Session.find({userId, _id:{$ne:sessionId}}).sort({createdAt:-1}).limit(20).select('_id').lean();
  if (!sessions.length) return null;
  const messages = await Message.find({sessionId:{$in:sessions.map(session=>session._id)}}).sort({timestamp:-1}).limit(300).lean();
  return childhoodPlaceFromMessages(messages.reverse());
}
