import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runDeployedLatency, validateDeploymentPlan } from '../src/evaluation/deployedLatency.js';
import { distribution, toCsv } from '../src/evaluation/latency.js';

try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean', default: false }, api: { type: 'string' }, session: { type: 'string' }, inputs: { type: 'string' },
    repeats: { type: 'string', default: '1' }, 'delay-ms': { type: 'string', default: '1000' },
    'timeout-ms': { type: 'string', default: '120000' }, avatar: { type: 'string', default: 'visualizer' },
    lipsync: { type: 'string', default: 'energy' }, label: { type: 'string', default: '' },
    out: { type: 'string', default: 'evaluation/results' },
  } });
  if (!values.api || !values.session || !values.inputs) throw new Error('Required: --api https://BACKEND/api --session TEST_SESSION_ID --inputs responses.json');
  const config = { apiUrl: values.api, sessionId: values.session, inputs: JSON.parse(await readFile(resolve(values.inputs), 'utf8')),
    repeats: Number(values.repeats), delayMs: Number(values['delay-ms']), timeoutMs: Number(values['timeout-ms']),
    avatarMode: values.avatar, lipSyncMode: values.lipsync };
  validateDeploymentPlan(config);
  console.log(JSON.stringify({ mode: values.live ? 'live' : 'dry-run', plannedCalls: config.inputs.length * config.repeats,
    apiUrl: config.apiUrl, note: 'Live calls advance the selected session, persist messages and incur provider usage. No browser playback is measured.' }, null, 2));
  if (values.live) {
    const out = resolve(values.out, `${new Date().toISOString().replace(/[:.]/gu, '-')}-deployed-${randomUUID().slice(0, 8)}`);
    await mkdir(out, { recursive: true });
    const manifest = { schemaVersion: 1, scope: 'deployed-api-client-completion', startedAt: new Date().toISOString(),
      label: values.label, node: process.version, ...config,
      caveat: 'Server stage timings on deployments predating this instrumentation contain only the last TTS/Rhubarb segment. No deployed build revision is asserted.' };
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Saving to ' + out);
    const rows = await runDeployedLatency({ ...config, onRow: async row => {
      await appendFile(resolve(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
      console.log(`Turn ${row.sequence + 1}: ${row.status} ${row.requestMs.toFixed(1)} ms`);
    } });
    const summary = { attempts: rows.length, plannedCalls: config.inputs.length * config.repeats,
      failures: rows.filter(r => r.status === 'error').length,
      missingAudio: rows.filter(r => r.status === 'ok' && !r.audioSegments).length,
      successfulRequestLatency: distribution(rows.filter(r => r.status === 'ok').map(r => r.requestMs)) };
    await writeFile(resolve(out, 'report.json'), JSON.stringify({ manifest, rows, summary }, null, 2));
    await writeFile(resolve(out, 'samples.csv'), toCsv(rows.map(row => ({ ...row, ...row.serverTimings })),
      ['sequence', 'repeat', 'inputIndex', 'sessionId', 'turnId', 'startedAt', 'status', 'httpStatus', 'pipelineMode',
        'avatarMode', 'lipSyncMode', 'requestMs', 'sttMs', 'orchestratorMs', 'ttsMs', 'rhubarbMs', 'totalMs', 'audioStatus', 'audioSegments', 'error']));
    manifest.completedAt = new Date().toISOString(); manifest.summary = summary;
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failures || summary.missingAudio) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
