import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  checkCriteria, highestPassingLevel, nameForUser, parseLevels, parseRange, registerLoadTestUser, runStage,
  summarizeStage, validateConcurrencyPlan, LOAD_TEST_SCRIPT_ID,
} from '../src/evaluation/concurrency.js';
import { toCsv } from '../src/evaluation/latency.js';

const SAMPLE_COLUMNS = ['stage', 'vu', 'userId', 'sessionId', 'kind', 'sequence', 'turnIndex', 'contentKind', 'startedAt',
  'startOffsetMs', 'inFlightAtStart', 'status', 'httpStatus', 'errorCategory', 'requestMs', 'pipelineMode', 'slideId',
  'orchestratorMs', 'ttsMs', 'rhubarbMs', 'audioMs', 'speechCacheHits', 'llmFallbacks', 'totalMs', 'audioStatus',
  'audioSegments', 'audioFetchMs', 'audioBytes', 'audioFetchError', 'error'];
const STAGE_COLUMNS = ['concurrency', 'users', 'completedUsers', 'failedUsers', 'stuckUsers', 'maxTurnUsers', 'wallMs', 'peakInFlight',
  'meanInFlightAtStart', 'turnsAttempted', 'turnsOk', 'turnsFailed', 'errorRate', 'timeouts', 'degradedTurns', 'degradedRate',
  'missingAudio', 'audioFetchFailures', 'speechCacheHits', 'throughputTurnsPerMin', 'requestP50Ms', 'requestP95Ms',
  'requestP99Ms', 'requestMaxMs', 'serverTotalP50Ms', 'serverTotalP95Ms', 'orchestratorP50Ms', 'orchestratorP95Ms',
  'audioWaitP50Ms', 'audioWaitP95Ms', 'criteriaPassed', 'criteriaFailures'];

const optionalNumber = value => (value === undefined ? undefined : Number(value));
const ms = value => (Number.isFinite(value) ? `${Math.round(value)}` : '-');
const pct = value => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-');

const stageRecord = s => ({ ...s, requestP50Ms: s.requestLatency.p50Ms, requestP95Ms: s.requestLatency.p95Ms,
  requestP99Ms: s.requestLatency.p99Ms, requestMaxMs: s.requestLatency.maxMs, serverTotalP50Ms: s.serverTotal.p50Ms,
  serverTotalP95Ms: s.serverTotal.p95Ms, orchestratorP50Ms: s.orchestrator.p50Ms, orchestratorP95Ms: s.orchestrator.p95Ms,
  audioWaitP50Ms: s.audioWait.p50Ms, audioWaitP95Ms: s.audioWait.p95Ms,
  criteriaPassed: s.criteria.checked ? s.criteria.passed : null, criteriaFailures: s.criteria.failures.join('; ') });

try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean', default: false }, api: { type: 'string' },
    levels: { type: 'string', default: '1,2,4' }, inputs: { type: 'string', default: 'evaluation/concurrency-inputs.json' },
    'max-turns': { type: 'string', default: '40' }, 'timeout-ms': { type: 'string', default: '120000' },
    'think-ms': { type: 'string', default: '2000-6000' }, 'skip-listen': { type: 'boolean', default: false },
    'skip-audio-download': { type: 'boolean', default: false }, 'ramp-ms': { type: 'string', default: '5000' },
    'cooldown-ms': { type: 'string', default: '15000' }, 'skip-warmup': { type: 'boolean', default: false },
    avatar: { type: 'string', default: 'male' }, lipsync: { type: 'string', default: 'rhubarb' }, pipeline: { type: 'string' },
    'p95-ms': { type: 'string' }, 'max-error-rate': { type: 'string' }, 'max-degraded-rate': { type: 'string' },
    'stop-error-rate': { type: 'string', default: '0.5' }, label: { type: 'string', default: '' },
    out: { type: 'string', default: 'evaluation/results' },
  } });
  if (!values.api) throw new Error('Required: --api http://localhost:5000/api (or a dedicated test deployment)');
  if (!['male', 'female', 'visualizer'].includes(values.avatar) || !['rhubarb', 'energy'].includes(values.lipsync)) throw new Error('Invalid --avatar or --lipsync');
  const config = {
    apiUrl: values.api.replace(/\/$/u, ''), levels: parseLevels(values.levels),
    inputs: JSON.parse(await readFile(resolve(values.inputs), 'utf8')),
    maxTurns: Number(values['max-turns']), timeoutMs: Number(values['timeout-ms']), think: parseRange(values['think-ms']),
    listen: !values['skip-listen'], downloadAudio: !values['skip-audio-download'], rampMs: Number(values['ramp-ms']),
    cooldownMs: Number(values['cooldown-ms']), warmup: !values['skip-warmup'], avatarMode: values.avatar,
    lipSyncMode: values.lipsync, pipelineMode: values.pipeline, stopErrorRate: Number(values['stop-error-rate']),
  };
  const criteria = { p95Ms: optionalNumber(values['p95-ms']), maxErrorRate: optionalNumber(values['max-error-rate']),
    maxDegradedRate: optionalNumber(values['max-degraded-rate']) };
  validateConcurrencyPlan(config);
  const accounts = config.levels.reduce((a, b) => a + b, 0) + (config.warmup ? 1 : 0);
  console.log(JSON.stringify({ mode: values.live ? 'live' : 'dry-run', apiUrl: config.apiUrl, levels: config.levels,
    script: LOAD_TEST_SCRIPT_ID, accountsToCreate: accounts, sessionsToRun: accounts,
    maxTurnRequests: accounts * config.maxTurns, avatarMode: config.avatarMode, lipSyncMode: config.lipSyncMode, criteria,
    note: 'Live runs create loadtest-<run>-<n> accounts and sessions in the target database, call paid LLM/TTS providers, '
      + 'and write generated audio to the server disk. Remove the accounts afterwards with scripts/cleanup-load-test.js.' }, null, 2));

  if (values.live) {
    const runId = randomUUID().slice(0, 8);
    const out = resolve(values.out, `${new Date().toISOString().replace(/[:.]/gu, '-')}-concurrency-${runId}`);
    await mkdir(out, { recursive: true });
    const pipelineInfo = await fetch(`${config.apiUrl}/sessions/pipeline`, { signal: AbortSignal.timeout(10000) })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
    const manifest = { schemaVersion: 1, scope: 'concurrent-virtual-users-session1', runId, usernamePrefix: `loadtest-${runId}-`,
      startedAt: new Date().toISOString(), label: values.label, node: process.version, ...config, criteria, pipelineInfo,
      caveat: 'Client-observed timings from one load-generating machine. Server CPU/memory and provider quota usage are not captured.' };
    const saveManifest = () => writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await saveManifest();
    console.log('Saving to ' + out);

    let accountIndex = 0;
    const createUsers = async count => {
      const users = [];
      for (let i = 0; i < count; i++, accountIndex++) {
        users.push(await registerLoadTestUser({ apiUrl: config.apiUrl, username: `loadtest-${runId}-${accountIndex}`,
          name: nameForUser(accountIndex), password: randomBytes(12).toString('hex'), timeoutMs: config.timeoutMs }));
      }
      return users;
    };
    const allRows = [];
    const runOne = async (stage, users) => {
      const rows = [];
      const result = await runStage({ ...config, users, stage, onRow: async row => {
        rows.push(row); allRows.push(row);
        await appendFile(resolve(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
      } });
      return { ...result, rows };
    };

    if (config.warmup) {
      console.log('Warmup: one virtual user (excluded from results)...');
      const warm = await runOne('warmup', await createUsers(1));
      console.log(`Warmup ${warm.outcomes[0].outcome} after ${warm.outcomes[0].turns} turns`);
    }

    const stages = [];
    let stoppedEarly = null;
    console.log('\nusers | done/failed/stuck | turns ok/failed | p50 ms | p95 ms | max ms | degraded | turns/min | peak in-flight');
    for (const [index, level] of config.levels.entries()) {
      if (index || config.warmup) await new Promise(r => setTimeout(r, config.cooldownMs));
      const users = await createUsers(level);
      const result = await runOne(level, users);
      const summary = summarizeStage({ concurrency: level, ...result });
      summary.criteria = checkCriteria(summary, criteria);
      stages.push(summary);
      console.log([level, `${summary.completedUsers}/${summary.failedUsers}/${summary.stuckUsers}`, `${summary.turnsOk}/${summary.turnsFailed}`,
        ms(summary.requestLatency.p50Ms), ms(summary.requestLatency.p95Ms), ms(summary.requestLatency.maxMs),
        pct(summary.degradedRate), summary.throughputTurnsPerMin?.toFixed(1) ?? '-', summary.peakInFlight].join(' | ')
        + (summary.criteria.checked && !summary.criteria.passed ? `   criteria not met: ${summary.criteria.failures.join('; ')}` : ''));
      if (summary.errorRate !== null && summary.errorRate >= config.stopErrorRate) {
        stoppedEarly = `Error rate ${pct(summary.errorRate)} at ${level} users reached --stop-error-rate; higher levels skipped.`;
        console.log(stoppedEarly);
        break;
      }
    }

    const result = { stages, stoppedEarly,
      highestLevelMeetingCriteria: Object.values(criteria).some(Number.isFinite) ? highestPassingLevel(stages) : null };
    await writeFile(resolve(out, 'report.json'), JSON.stringify({ manifest, ...result, rows: allRows }, null, 2));
    await writeFile(resolve(out, 'samples.csv'), toCsv(allRows.map(row => ({ ...row, ...row.serverTimings })), SAMPLE_COLUMNS));
    await writeFile(resolve(out, 'stages.csv'), toCsv(stages.map(stageRecord), STAGE_COLUMNS));
    Object.assign(manifest, { completedAt: new Date().toISOString(), accountsCreated: accountIndex, stoppedEarly,
      highestLevelMeetingCriteria: result.highestLevelMeetingCriteria });
    await saveManifest();
    if (Object.values(criteria).some(Number.isFinite)) {
      console.log(`\nHighest level where it and all lower levels met the stated criteria: ${result.highestLevelMeetingCriteria ?? 'none'}`);
    }
    console.log(`\nCreated ${accountIndex} accounts with prefix loadtest-${runId}-. Clean up with:\n  node scripts/cleanup-load-test.js --run ${runId}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
