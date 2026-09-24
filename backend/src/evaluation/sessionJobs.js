import { randomUUID } from 'node:crypto';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { EvaluationTurn, SessionEvaluation } from '../models/Evaluation.js';
import { getScriptStep } from '../services/cstScriptService.js';
import { judgeFullSession } from './sessionJudge.js';

export function describeScript(scriptId) {
  const { totalSteps } = getScriptStep(scriptId, 0);
  return Array.from({ length: totalSteps }, (_, index) => {
    const { step } = getScriptStep(scriptId, index);
    return { index, id: step.id, title: step.title, prompt: step.prompt, turns: step.turns,
      imageGuidance: step.imageGuidance, interactionType: step.interaction?.type };
  });
}
export async function enqueueSessionEvaluation(sessionId, naturalCompletion = false) {
  const session = await Session.findById(sessionId).lean();
  if (!session?.evaluation?.facilitator) return;
  try {
    await SessionEvaluation.updateOne({ sessionId }, { $setOnInsert: {
      sessionId, status: 'queued', naturalCompletion,
    } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
}
export async function processEvaluationJob() {
  const token = randomUUID();
  const job = await SessionEvaluation.findOneAndUpdate({
    $or: [{ status: 'queued' }, { status: 'running', leaseUntil: { $lt: new Date() } }],
  }, { $set: { status: 'running', leaseToken: token, leaseUntil: new Date(Date.now() + 10 * 60_000) }, $inc: { attempts: 1 } },
  { returnDocument: 'after', sort: { createdAt: 1 } });
  if (!job) return false;
  // Section reviews may exceed one lease window. Renew only while this worker owns it.
  const heartbeat = setInterval(() => {
    void SessionEvaluation.updateOne({ _id: job._id, leaseToken: token, status: 'running' },
      { $set: { leaseUntil: new Date(Date.now() + 10 * 60_000) } })
      .catch(error => console.error('[evaluation lease]', error.message));
  }, 30000);
  heartbeat.unref();
  try {
    if (job.attempts > 3) throw new Error('Evaluation worker interrupted too many times; retry explicitly');
    const session = await Session.findById(job.sessionId).lean();
    if (!session?.evaluation) throw new Error('Evaluation session no longer exists');
    if (session.evaluation.captureError) throw new Error('Turn capture was incomplete; refusing to score a partial record');
    const turns = await EvaluationTurn.find({ sessionId: job.sessionId }).sort({ revision: 1 }).lean();
    const delivered = await Message.find({ sessionId: job.sessionId, role: 'assistant' }).sort({ timestamp: 1, _id: 1 }).lean();
    if (delivered.length !== turns.length || delivered.some((message, index) => message.content !== turns[index].deliveredText)) {
      throw new Error('Transcript and turn capture differ; refusing to score a partial record');
    }
    const report = await judgeFullSession({
      turns, assignment: session.evaluation, script: describeScript(session.scriptId),
      naturalCompletion: job.naturalCompletion,
    });
    await SessionEvaluation.updateOne({ _id: job._id, leaseToken: token }, { $set: {
      status: report.judgments.every(j => j.status === 'ok') ? 'complete' : 'failed',
      report, error: report.judgments.some(j => j.status === 'error') ? 'One or more critics failed' : null,
    } });
  } catch (error) {
    await SessionEvaluation.updateOne({ _id: job._id, leaseToken: token }, { $set: { status: 'failed', error: error.message } });
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export function startEvaluationWorker() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await processEvaluationJob(); } catch (error) { console.error('[evaluation worker]', error.message); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
