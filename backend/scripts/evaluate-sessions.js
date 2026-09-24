import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean', default: false },
    models: { type: 'string', default: resolve(root, 'evaluation/models.json') },
    scenarios: { type: 'string', default: resolve(root, 'evaluation/session-scenarios.json') },
    'max-turns': { type: 'string', default: '50' },
    scenario: { type: 'string' }, facilitator: { type: 'string' },
    'delay-ms': { type: 'string', default: '25000' },
    out: { type: 'string', default: resolve(root, 'evaluation/results') },
  } });
  dotenv.config({ path: resolve(root, '.env'), quiet: true });
  const models = JSON.parse(await readFile(values.models, 'utf8'));
  const allScenarios = JSON.parse(await readFile(values.scenarios, 'utf8'));
  const scenarios = values.scenario ? allScenarios.filter(s => s.id === values.scenario) : allScenarios;
  const facilitators = values.facilitator ? models.filter(m => m.id === values.facilitator) : models;
  if (!facilitators.length) throw new Error('Unknown facilitator');
  const maxTurns = Number(values['max-turns']);
  const minimumIntervalMs = Number(values['delay-ms']);
  if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < 0 || minimumIntervalMs > 60000) throw new Error('delay-ms must be 0–60000');
  const { validateInputs } = await import('../src/evaluation/runner.js');
  validateInputs(models, [{ id: 'session', input: '', context: { slide: {}, scriptId: 'cst_intro_reminiscence' } }], 1);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 200) throw new Error('max-turns must be 1–200');
  if (!Array.isArray(scenarios) || !scenarios.length || scenarios.some(s => !s.id || !s.scriptId || !s.user?.name || !s.answers || typeof s.followUpAnswer !== 'string')) throw new Error('Invalid session scenarios');
  console.log(JSON.stringify({ live: values.live, sessions: scenarios.length * facilitators.length,
    maxTurnsPerSession: maxTurns, criticsPerSession: models.length - 1, minimumIntervalMs,
    note: 'Real orchestrator and Mongo persistence; synthetic input only. Number of generation calls depends on progression. No speech/avatar calls.' }, null, 2));
  if (values.live) {
    const { assertProviderCredentials } = await import('../src/services/llmProviders.js');
    assertProviderCredentials(models);
    if (!process.env.EVAL_MONGO_URI) throw new Error('Set EVAL_MONGO_URI for isolated synthetic replay; MONGO_URI is never used');
    const runId = randomUUID().replaceAll('-', '');
    const databaseName = 'avatarcst_eval_' + runId;
    const out = resolve(values.out, 'sessions-' + runId);
    await mkdir(out, { recursive: true });
    let revision = 'unknown';
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify({ databaseName, models, scenarios, maxTurns, minimumIntervalMs, revision, startedAt: new Date().toISOString() }, null, 2));
    await mongoose.connect(process.env.EVAL_MONGO_URI, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    const { default: Session } = await import('../src/models/Session.js');
    const { default: User } = await import('../src/models/User.js');
    const { EvaluationTurn } = await import('../src/models/Evaluation.js');
    const { respondToSessionTurn } = await import('../src/services/sessionOrchestratorService.js');
    const { replaySession } = await import('../src/evaluation/sessionReplay.js');
    const { judgeFullSession } = await import('../src/evaluation/sessionJudge.js');
    const { describeScript } = await import('../src/evaluation/sessionJobs.js');
    const reports = [];
    for (const scenario of scenarios) {
      for (const facilitator of facilitators) {
        const user = await User.create(scenario.user);
        const assignment = { version: 1, facilitator, critics: models.filter(m => m.id !== facilitator.id), selection: 'replay', requestPolicy: { minimumIntervalMs } };
        const session = await Session.create({ userId: user._id, scriptId: scenario.scriptId, status: 'active',
          pipelineMode: 'free', evaluation: assignment, startedAt: new Date() });
        console.log('Replaying ' + scenario.id + ' / ' + facilitator.id);
        try {
          const replay = await replaySession({ sessionId: session._id, scenario, maxTurns,
            loadSession: id => Session.findById(id).lean(), respond: respondToSessionTurn,
            onTurn: async (turn, index) => {
              await appendFile(resolve(out, 'turns.jsonl'), JSON.stringify({ scenario: scenario.id, facilitator: facilitator.id, index, turn }) + '\n');
              console.log('  turn ' + (index + 1) + ': ' + turn.scriptStep?.id);
            },
          });
          const turns = await EvaluationTurn.find({ sessionId: session._id }).sort({ revision: 1 }).lean();
          if (turns.length !== replay.turns.length) throw new Error('Incomplete turn capture; no partial transcript was judged');
          const report = await judgeFullSession({ turns, assignment, script: describeScript(scenario.scriptId), naturalCompletion: replay.naturalCompletion });
          reports.push({ scenario: scenario.id, sessionId: session._id, stopReason: replay.stopReason, ...report });
          if (!replay.naturalCompletion || report.failedModelCalls || report.judgments.some(j => j.status === 'error')) process.exitCode = 1;
        } catch (error) {
          reports.push({ scenario: scenario.id, facilitator, sessionId: session._id, error: error.message });
          process.exitCode = 1;
        }
        await writeFile(resolve(out, 'report.json'), JSON.stringify(reports, null, 2));
      }
    }
    console.log('Reports: ' + out + '; synthetic database retained: ' + databaseName);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
