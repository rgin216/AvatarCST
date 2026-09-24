import test from 'node:test';
import assert from 'node:assert/strict';
import Session from '../models/Session.js';
import { SessionEvaluation } from '../models/Evaluation.js';
import { retryEvaluation, getEvaluationReport } from './evaluationController.js';

test('requeuing a failed evaluation atomically removes the previous report from status reads', async t => {
  const session = { _id: 'session', evaluation: {}, status: 'completed' };
  const job = { status: 'failed', attempts: 3, error: 'Old error', report: { previousRun: true } };
  t.mock.method(Session, 'findById', () => ({ lean: async () => session }));
  t.mock.method(SessionEvaluation, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter, { sessionId: 'session', status: 'failed' });
    assert.deepEqual(update.$unset, { report: 1 });
    Object.assign(job, update.$set);
    delete job.report;
    return job;
  });
  t.mock.method(SessionEvaluation, 'findOne', () => ({ lean: async () => job }));
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  const req = { params: { id: 'session' } };
  const next = error => { throw error; };
  await retryEvaluation(req, res, next);
  assert.equal(res.statusCode, 202);
  assert.equal(job.attempts, 0);
  assert.equal(job.error, null);
  await getEvaluationReport(req, res, next);
  assert.equal(res.body.status, 'queued');
  assert.equal(res.body.report, undefined);
});
