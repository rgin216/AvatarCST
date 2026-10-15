import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RUBRIC, summarize } from './runner.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function workspace(t) {
  const dir = await mkdtemp(resolve(tmpdir(), 'avatar-eval-review-'));
  t.after(async () => {
    assert.equal(dirname(dir), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

test('offline export finalizes atomically, retries a failed export, and keeps relative report sources', async t => {
  const dir = await workspace(t), llm = resolve(dir, 'llm'), out = resolve(dir, 'published');
  await mkdir(llm);
  const models = ['a', 'b'].map(id => ({ id, model: id, provider: 'groq' }));
  const scenarios = [{ id: 's', input: 'Hello', context: { slide: 'intro', scriptId: 'intro' } }];
  const rows = models.map(m => ({ scenario: 's', facilitator: m.id, repeat: 0, status: 'ok',
    input: 'Hello', context: scenarios[0].context, acknowledgement: 'Hello.', latencyMs: 10,
    checks: { withinWordLimit: true, noQuestion: true },
    judgments: models.filter(j => j.id !== m.id).map(j => ({ judge: j.id, status: 'ok',
      result: { scores: Object.fromEntries(Object.keys(RUBRIC).map(k => [k, { score: 5, evidence: 'Hello.' }])), criticalFailures: [] } })),
  }));
  const report = { models, repeats: 1, rows, rubric: RUBRIC, summary: summarize(rows, models) };
  const manifest = { models, scenarios, repeats: 1, fixtureHash: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex') };
  for (const [name, data] of Object.entries({ 'manifest.json': manifest, 'report.json': { ...report, rubric: null },
    'human-review.json': [], 'disagreements.json': [] })) await writeFile(resolve(llm, name), JSON.stringify(data));
  await writeFile(resolve(llm, 'rows.jsonl'), rows.map(r => JSON.stringify(r)).join('\n'));
  const args = ['scripts/publish-evaluation.js', '--llm-run', llm, '--date', '2026-10-15', '--out', out];
  const run = () => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  // Invalid rubric fails in the summary subprocess, after staging files were written.
  assert.equal(run().status, 1);
  await assert.rejects(access(out), { code: 'ENOENT' });
  assert.equal((await readdir(dir)).some(name => name.startsWith('.evaluation-export-')), false);
  await writeFile(resolve(llm, 'report.json'), JSON.stringify(report));
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  const exported = JSON.parse(await readFile(resolve(out, 'evaluation.json'), 'utf8'));
  assert.equal(exported.source, 'llm/report.json');
  const hashes = JSON.parse(await readFile(resolve(out, 'checksums.json'), 'utf8'));
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(await readFile(resolve(out, name))).digest('hex'), hash);
  }
  assert.equal(run().status, 1); // Never replace a completed collection.
  assert.deepEqual(JSON.parse(await readFile(resolve(out, 'checksums.json'), 'utf8')), hashes);
});

test('collector setup failures finalize empty or previously collected rows', async t => {
  const dir = await workspace(t), target = resolve(dir, 'target.json');
  await writeFile(target, JSON.stringify({ api: 'https://synthetic.invalid/api' }));
  for (const stage of ['users', 'sessions']) for (const failOn of [1, 2]) {
    const out = resolve(dir, `${stage}-${failOn}`);
    const script = `
      const timer = globalThis.setTimeout;
      globalThis.setTimeout = fn => timer(fn, 0);
      let calls = 0;
      globalThis.fetch = async url => {
        const path = new URL(url).pathname;
        if (path === '/api/${stage}' && ++calls === ${failOn}) return new Response('Setup failed', {status:503});
        if (path === '/api/users' || path === '/api/sessions') return Response.json({_id:'synthetic'});
        if (path === '/api/sessions/pipeline') return Response.json({mode:'synthetic'});
        if (path === '/audio') return new Response('audio');
        return Response.json({assistantText:'Hello.', audioStatus:'ok', avatar:{audio:{segments:[
          {url:'/audio',rhubarbJson:{mouthCues:[{}]}}
        ]}}});
      };
      process.argv = ['node', 'collector', ${JSON.stringify(target)}, ${JSON.stringify(out)}];
      await import(${JSON.stringify(new URL('../../scripts/collect-deployed-voice-latency.js', import.meta.url).href)});
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1, result.stderr);
    const summary = JSON.parse(await readFile(resolve(out, 'deployed-summary.json'), 'utf8'));
    assert.equal(summary.complete, false);
    assert.match(summary.stoppedReason, /HTTP 503: Setup failed/);
    assert.equal(summary.rows.length, failOn === 1 ? 0 : 4);
    assert.ok(summary.rows.every(r => r.status === 'ok'));
    if (summary.rows.length) {
      const checkpoint = (await readFile(resolve(out, 'deployed-voice-rows.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      assert.deepEqual(summary.rows, checkpoint);
    }
  }
});
