import Summary from '../models/Summary.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { generateSummary } from '../services/summaryService.js';

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

export const generateSessionSummary = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    const keyTalkingPoints = await generateSummary(messages, session.pipelineMode);

    const summary = await Summary.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { sessionId: req.params.sessionId, userId: session.userId, keyTalkingPoints },
      { upsert: true, new: true }
    );

    res.json(summary);
  } catch (err) {
    next(err);
  }
};
