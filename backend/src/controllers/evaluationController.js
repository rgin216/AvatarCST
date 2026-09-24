import Session from '../models/Session.js';
import { SessionEvaluation } from '../models/Evaluation.js';
import { getLiveModels, liveEvaluationEnabled } from '../evaluation/liveConfig.js';
import { enqueueSessionEvaluation } from '../evaluation/sessionJobs.js';
import { assertProviderCredentials } from '../services/llmProviders.js';

export const getEvaluationOptions = (_req, res) => {
  let available = liveEvaluationEnabled();
  let reason = available ? null : 'Evaluation is disabled on this server';
  try { if (available) assertProviderCredentials(getLiveModels()); }
  catch { available = false; reason = 'Groq API key is not configured'; }
  res.json({ available, reason, models: available ? getLiveModels() : [] });
};
export const getEvaluationReport = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.evaluation) return res.json({ status: 'disabled' });
    const job = await SessionEvaluation.findOne({ sessionId: session._id }).lean();
    res.json({ status: job?.status || 'collecting', assignment: session.evaluation,
      report: job?.report, error: job?.error, captureError: session.evaluation.captureError });
  } catch (error) { next(error); }
};
export const retryEvaluation = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session?.evaluation) return res.status(404).json({ error: 'Evaluation session not found' });
    const retried = await SessionEvaluation.findOneAndUpdate({ sessionId: session._id, status: 'failed' },
      { $set: { status: 'queued', attempts: 0, error: null }, $unset: { report: 1 } }, { returnDocument: 'after' });
    if (!retried && session.status !== 'completed') return res.status(409).json({ error: 'Finish the session before evaluating' });
    if (!retried) {
      const existing = await SessionEvaluation.findOne({ sessionId: session._id }).lean();
      if (existing) return res.status(409).json({ error: 'Evaluation is already ' + existing.status });
      await enqueueSessionEvaluation(session._id);
    }
    res.status(202).json({ status: retried?.status || 'queued' });
  } catch (error) { next(error); }
};
