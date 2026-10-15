import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCompletedRun, portableArtifact, configuredSecrets } from './publication.js';

const models = ['a', 'b'].map(id => ({ id, model: id, provider: 'groq' }));
const scenarios = [{ id: 's', input: 'Hello', context: { slide: 'intro', scriptId: 'intro' } }];
const manifest = { models, scenarios, repeats: 1,
  fixtureHash: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex') };
const makeReport = () => ({ models, repeats: 1, rows: models.map(m => ({
  scenario: 's', facilitator: m.id, repeat: 0, status: 'ok',
  input: scenarios[0].input, context: structuredClone(scenarios[0].context),
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

test('publication rejects substituted input and context, including failed responses', () => {
  for (const status of ['ok', 'error']) {
    for (const field of ['input', 'context']) {
      const report = makeReport();
      report.rows[0].status = status;
      report.rows[0][field] = field === 'input' ? 'Different input' : { ...scenarios[0].context, slide: 'different' };
      assert.throws(() => validateCompletedRun(manifest, report), /input\/context differ/);
    }
  }
});

test('configured auth configs are refused in plain and JSON-escaped artifacts', () => {
  for (const name of ['AUTH_CONFIG', 'DOCKER_AUTH_CONFIG']) {
    const secret = '{"auths":{"registry":{"auth":"test-credential"}}}';
    const secrets = configuredSecrets({ [name]: secret, NORMAL_SETTING: 'ordinary-value' });
    assert.deepEqual(secrets, [secret]);
    for (const text of [secret, JSON.stringify({ config: secret })]) {
      assert.throws(() => portableArtifact(text, 'unused-root', secrets), /Credential/);
    }
  }
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
