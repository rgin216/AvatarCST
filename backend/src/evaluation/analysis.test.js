import test from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIC } from './runner.js';
import { compareHumanReview, findDisagreements } from './analysis.js';

function fixture() {
  const judgment = (judge, score, flagged = false) => ({
    judge, status: 'ok', result: {
      scores: Object.fromEntries(Object.keys(RUBRIC).map(k => [k, { score, evidence: 'Example' }])),
      criticalFailures: flagged ? [{ reason: 'Example', evidence: 'Example' }] : [],
    },
  });
  const row = { id: 'r1', status: 'ok', scenario: 's1', facilitator: 'a', input: 'Hi', acknowledgement: 'Hello',
    judgments: [judgment('b', 5), judgment('c', 2, true), { judge: 'd', status: 'error' }] };
  const review = { id: row.id, scenario: row.scenario, input: row.input, acknowledgement: row.acknowledgement,
    humanScores: { grounding: 4 } };
  return { report: { rows: [row] }, reviews: [review] };
}
test('reports score spreads and critical-flag disagreements without counting failed critics', () => {
  const { report } = fixture();
  const findings = findDisagreements(report.rows);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].differences[0].spread, 3);
  assert.equal(findings[0].criticalDisagreement, true);
  assert.equal(findings[0].criticalVotes.length, 2);
  report.rows[0].judgments = report.rows[0].judgments.slice(0, 1);
  assert.deepEqual(findDisagreements(report.rows), []);
});
test('human comparison computes criterion-level errors and signed generosity', () => {
  const { report, reviews } = fixture();
  const result = compareHumanReview(report, reviews);
  assert.equal(result.reviewedResponses, 1);
  assert.equal(result.metrics.length, 2);
  assert.deepEqual(result.metrics[0], {
    judge: 'b', criterion: 'grounding', count: 1, exactAgreement: 0,
    withinOneAgreement: 1, meanAbsoluteError: 1, meanSignedError: 1,
  });
  assert.equal(result.metrics[1].meanSignedError, -2);
});
test('blank and unsubmitted reviews do not become zero scores', () => {
  const { report, reviews } = fixture();
  reviews[0].humanScores = { grounding: null };
  const result = compareHumanReview(report, reviews);
  assert.equal(result.skippedResponses, 1);
  assert.deepEqual(result.metrics, []);
  assert.equal(compareHumanReview(report, []).unsubmittedResponses, 1);
});
test('rejects duplicate IDs, mismatched content, and invalid human ratings', () => {
  const { report, reviews } = fixture();
  assert.throws(() => compareHumanReview(report, [...reviews, ...reviews]), /duplicate/);
  assert.throws(() => compareHumanReview(report, [{ ...reviews[0], id: 'unknown' }]), /Unknown/);
  assert.throws(() => compareHumanReview(report, [{ ...reviews[0], acknowledgement: 'Changed' }]), /does not match/);
  for (const score of [0, 6, 3.5, '4']) {
    assert.throws(() => compareHumanReview(report, [{ ...reviews[0], humanScores: { grounding: score } }]), /integers/);
  }
});
