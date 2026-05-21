import Summary from '../models/Summary.js';

export const createSummary = async (req, res, next) => {
  try {
    const summary = await Summary.create(req.body);
    res.status(201).json(summary);
  } catch (err) {
    next(err);
  }
};

export const getSessionSummary = async (req, res, next) => {
  try {
    const summary = await Summary.findOne({ sessionId: req.params.sessionId });
    if (!summary) return res.status(404).json({ error: 'Summary not found' });
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

export const getUserSummaries = async (req, res, next) => {
  try {
    const summaries = await Summary.find({ userId: req.params.userId })
      .populate('sessionId', 'title theme startedAt endedAt')
      .sort({ createdAt: -1 });
    res.json(summaries);
  } catch (err) {
    next(err);
  }
};
