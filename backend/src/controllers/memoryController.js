import Memory from '../models/Memory.js';

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
    const memory = await Memory.findOneAndUpdate(
      { userId: req.params.userId },
      { $push: { entries: req.body } },
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
