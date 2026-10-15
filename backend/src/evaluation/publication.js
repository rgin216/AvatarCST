import { createHash } from 'node:crypto';
import { validateInputs } from './runner.js';

// A finished file alone does not establish that every planned block was saved.
export function validateCompletedRun(manifest, report) {
  const { models, scenarios, repeats } = manifest;
  validateInputs(models, scenarios, repeats);
  const hash = createHash('sha256').update(JSON.stringify(scenarios)).digest('hex');
  if (hash !== manifest.fixtureHash) throw new Error('Fixture hash mismatch');
  if (JSON.stringify(models) !== JSON.stringify(report.models) || report.repeats !== repeats) {
    throw new Error('Report roster/repetitions differ from manifest');
  }
  const expected = new Set(scenarios.flatMap(s => models.flatMap(m =>
    Array.from({ length: repeats }, (_, repeat) => JSON.stringify([s.id, m.id, repeat])))));
  for (const row of report.rows) {
    if (!expected.delete(JSON.stringify([row.scenario, row.facilitator, row.repeat]))) {
      throw new Error('Duplicate or unexpected response block');
    }
    if (row.status !== 'ok' && row.status !== 'error') throw new Error('Invalid response status');
    if (row.status === 'ok') {
      const judges = new Set(models.filter(m => m.id !== row.facilitator).map(m => m.id));
      for (const judgment of row.judgments) {
        if (!judges.delete(judgment.judge) || !['ok', 'error'].includes(judgment.status)) {
          throw new Error('Duplicate or unexpected critique');
        }
      }
      if (judges.size) throw new Error('Missing critique attempts');
    }
  }
  if (expected.size) throw new Error(`Incomplete run: ${expected.size} response blocks missing`);
}

export function portableArtifact(text, root, secrets = []) {
  // Check before rewriting paths so credentials can never enter exported files.
  if (secrets.some(secret => text.includes(secret) || text.includes(JSON.stringify(secret).slice(1, -1)))) {
    throw new Error('Credential found in artifact; export refused');
  }
  for (const base of [root, root.replaceAll('\\', '/')]) {
    text = text.replaceAll(JSON.stringify(base).slice(1, -1), 'backend').replaceAll(base, 'backend');
  }
  return text;
}
