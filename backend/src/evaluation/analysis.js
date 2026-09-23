import { RUBRIC } from './runner.js';

const criteria = Object.keys(RUBRIC);

// Descriptive agreement only: these are not clinical validation or
// independent observations for confidence-interval calculations.
export function findDisagreements(rows, threshold = 2) {
  return rows.filter(row => row.status === 'ok').flatMap(row => {
    const valid = row.judgments.filter(j => j.status === 'ok');
    if (valid.length < 2) return [];
    const differences = criteria.flatMap(criterion => {
      const scores = valid.map(j => ({ judge: j.judge, score: j.result.scores[criterion].score }));
      const spread = Math.max(...scores.map(s => s.score)) - Math.min(...scores.map(s => s.score));
      return spread >= threshold ? [{ criterion, spread, scores }] : [];
    });
    const criticalVotes = valid.map(j => ({ judge: j.judge, flagged: j.result.criticalFailures.length > 0 }));
    const criticalDisagreement = criticalVotes.some(v => v.flagged) && criticalVotes.some(v => !v.flagged);
    return differences.length || criticalDisagreement ? [{
      id: row.id, scenario: row.scenario, facilitator: row.facilitator,
      differences, criticalDisagreement, criticalVotes,
    }] : [];
  });
}

export function compareHumanReview(report, reviews) {
  if (!Array.isArray(reviews) || !Array.isArray(report.rows)) throw new Error('Report rows and reviews must be arrays');
  const rows = new Map(report.rows.map(r => [r.id, r]));
  if (rows.size !== report.rows.length) throw new Error('Duplicate report row IDs');
  const seen = new Set(), buckets = new Map();
  let reviewedResponses = 0, skippedResponses = 0;
  for (const review of reviews) {
    if (!review || seen.has(review.id)) throw new Error('Invalid or duplicate review ID');
    seen.add(review.id);
    const row = rows.get(review.id);
    if (!row || row.status !== 'ok') throw new Error('Unknown or unsuccessful review row: ' + review.id);
    // Prevent accidentally combining review exports from edited/different runs.
    if (review.input !== row.input || review.acknowledgement !== row.acknowledgement || review.scenario !== row.scenario) {
      throw new Error('Review content does not match report row: ' + review.id);
    }
    const scores = review.humanScores;
    if (!scores || Object.keys(scores).some(k => !criteria.includes(k))) throw new Error('Invalid human score criteria');
    let hasScore = false;
    for (const criterion of criteria) {
      const human = scores[criterion];
      if (human === null || human === undefined) continue;
      if (!Number.isInteger(human) || human < 1 || human > 5) throw new Error('Human scores must be integers 1–5 or null');
      hasScore = true;
      for (const judgment of row.judgments.filter(j => j.status === 'ok')) {
        const key = JSON.stringify([judgment.judge, criterion]);
        const bucket = buckets.get(key) || { judge: judgment.judge, criterion, count: 0, exact: 0, withinOne: 0, absoluteError: 0, signedError: 0 };
        const delta = judgment.result.scores[criterion].score - human;
        bucket.count++;
        bucket.exact += Number(delta === 0);
        bucket.withinOne += Number(Math.abs(delta) <= 1);
        bucket.absoluteError += Math.abs(delta);
        bucket.signedError += delta;
        buckets.set(key, bucket);
      }
    }
    if (hasScore) reviewedResponses++; else skippedResponses++;
  }
  return {
    schemaVersion: 1, reviewedResponses, skippedResponses,
    unsubmittedResponses: report.rows.filter(r => r.status === 'ok' && !seen.has(r.id)).length,
    metrics: [...buckets.values()].map(b => ({
      judge: b.judge, criterion: b.criterion, count: b.count,
      exactAgreement: b.exact / b.count, withinOneAgreement: b.withinOne / b.count,
      meanAbsoluteError: b.absoluteError / b.count,
      meanSignedError: b.signedError / b.count,
    })),
    note: 'Descriptive comparison with one reviewer; positive signed error means the model scores more generously. Missing scores and failed judgments are excluded.',
  };
}
