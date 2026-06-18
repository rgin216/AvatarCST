import Memory from '../models/Memory.js';

export const getMemoryContext = async (userId) => {
  const memory = await Memory.findOne({ userId });
  if (!memory || memory.entries.length === 0) return '';
  return memory.entries
    .filter((entry) => !entry.status || entry.status === 'approved')
    .map((entry) => entry.content)
    .join('\n');
};

export const saveSessionInsight = async (userId, content) => {
  await Memory.findOneAndUpdate(
    { userId },
    { $push: { entries: { category: 'session_insight', content, addedBy: 'system', status: 'pending' } } },
    { upsert: true }
  );
};
