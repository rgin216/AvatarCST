import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCompletedRun, portableArtifact } from './publication.js';

const models = ['a', 'b'].map(id => ({ id, model: id, provider: 'groq' }));
const scenarios = [{ id: 's', input: 'Hello', context: { slide: 'intro', scriptId: 'intro' } }];
const manifest = { models, scenarios, repeats: 1,
  fixtureHash: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex') };
const makeReport = () => ({ models, repeats: 1, rows: models.map(m => ({
  scenario: 's', facilitator: m.id, repeat: 0, status: 'ok',
  judgments: models.filter(j => j.id !== m.id).map(j => ({ judge: j.id, status: 'ok' })),
})) });

test('publication requires the full plan, retaining attempted provider failures', () => {
  const report = makeReport();
  validateCompletedRun(manifest, report);
  report.rows[0].judgments[0].status = 'error';
  validateCompletedRun(manifest, report);
  report.rows[0].status = 'error'; report.rows[0].judgments = [];
  validateCompletedRun(manifest, report);
  report.rows.pop();
  assert.throws(() => validateCompletedRun(manifest, report), /Incomplete/);
});

test('publication rejects duplicate blocks, missing critics and changed fixtures/rosters', () => {
  const report = makeReport();
  assert.throws(() => validateCompletedRun(manifest, { ...report, rows: [report.rows[0], report.rows[0]] }), /Duplicate/);
  assert.throws(() => validateCompletedRun({ ...manifest, fixtureHash: 'changed' }, report), /hash mismatch/);
  assert.throws(() => validateCompletedRun(manifest, { ...report, models: models.slice(0, 1) }), /roster/);
  report.rows[0].judgments = [];
  assert.throws(() => validateCompletedRun(manifest, report), /Missing critique/);
});

test('exports remove native, escaped JSON and slash paths, and refuse credentials', () => {
  const root = 'C:\\Users\\Example\\backend';
  assert.equal(portableArtifact(`${root} ${root.replaceAll('\\', '/')} ${JSON.stringify(root)}`, root), 'backend backend "backend"');
  assert.throws(() => portableArtifact('token-secret', root, ['token-secret']), /Credential/);
  assert.throws(() => portableArtifact(JSON.stringify('secret\\value'), root, ['secret\\value']), /Credential/);
});
