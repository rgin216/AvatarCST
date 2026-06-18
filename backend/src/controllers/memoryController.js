import Memory from '../models/Memory.js';

const APPROVABLE_STATUSES = ['approved', 'rejected'];
const VALID_CATEGORIES = ['preference', 'personal', 'session_insight', 'caregiver_note'];

const buildMemoryEntry = (body = {}) => ({
  category: VALID_CATEGORIES.includes(body.category) ? body.category : 'personal',
  content: body.content?.trim(),
  addedBy: body.addedBy === 'system' ? 'system' : 'caregiver',
  status: body.status === 'pending' ? 'pending' : 'approved',
  reason: body.reason?.trim() || undefined,
  reviewedAt: body.status === 'pending' ? undefined : new Date(),
  reviewedBy: body.status === 'pending' ? undefined : 'caregiver',
});

export const getUserMemory = async (req, res, next) => {
  try {
    const memory = await Memory.findOne({ userId: req.params.userId });
    if (!memory) return res.status(404).json({ error: 'Memory bank not found' });
    res.json(memory);
  } catch (err) {
    next(err);
  }
};

export const addMemoryEntry = async (req, res, next) => {
  try {
    const entry = buildMemoryEntry(req.body);
    if (!entry.content) return res.status(400).json({ error: 'Memory content is required' });

    const memory = await Memory.findOneAndUpdate(
      { userId: req.params.userId },
      { $push: { entries: entry } },
      { new: true, upsert: true }
    );
    res.status(201).json(memory);
  } catch (err) {
    next(err);
  }
};

export const deleteMemoryEntry = async (req, res, next) => {
  try {
    const memory = await Memory.findOneAndUpdate(
      { userId: req.params.userId },
      { $pull: { entries: { _id: req.params.entryId } } },
      { new: true }
    );
    if (!memory) return res.status(404).json({ error: 'Memory bank not found' });
    res.json(memory);
  } catch (err) {
    next(err);
  }
};

export const reviewMemoryEntry = async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!APPROVABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const memory = await Memory.findOneAndUpdate(
      { userId: req.params.userId, 'entries._id': req.params.entryId },
      {
        $set: {
          'entries.$.status': status,
          'entries.$.reviewedAt': new Date(),
          'entries.$.reviewedBy': 'caregiver',
        },
      },
      { new: true }
    );

    if (!memory) return res.status(404).json({ error: 'Memory entry not found' });
    res.json(memory);
  } catch (err) {
    next(err);
  }
};

export const clearMemory = async (req, res, next) => {
  try {
    const memory = await Memory.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: { entries: [] } },
      { new: true }
    );
    if (!memory) return res.status(404).json({ error: 'Memory bank not found' });
    res.json(memory);
  } catch (err) {
    next(err);
  }
};
