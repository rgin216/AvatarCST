import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { distribution, toCsv } from '../src/evaluation/latency.js';
import { findDisagreements } from '../src/evaluation/analysis.js';

const { values } = parseArgs({ options: { report: { type: 'string' }, latency: { type: 'string' }, out: { type: 'string' } } });
if (!values.report || !values.out) throw new Error('--report and --out are required');
const source = resolve(values.report);
const report = JSON.parse(await readFile(source, 'utf8'));
const latency = values.latency ? JSON.parse(await readFile(resolve(values.latency), 'utf8')) : null;
const out = resolve(values.out);
await mkdir(out, { recursive: true });
let deployed = null;
try { deployed = JSON.parse(await readFile(resolve(out, 'deployed-summary.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const criteria = Object.keys(report.rubric);
const groups = report.models.map(model => {
  const rows = report.rows.filter(row => row.facilitator === model.id);
  const successful = rows.filter(row => row.status === 'ok');
  const judgments = rows.flatMap(row => row.judgments);
  const valid = judgments.filter(j => j.status === 'ok');
  return { model: model.id, attempts: rows.length, successes: successful.length,
    generationFailures: rows.length - successful.length, validCritiques: valid.length,
    failedCritiques: judgments.length - valid.length,
    completePanels: successful.filter(row => row.judgments.length === report.models.length - 1 && row.judgments.every(j => j.status === 'ok')).length,
    localCheckFailures: successful.filter(row => !row.checks.withinWordLimit || !row.checks.noQuestion).length,
    criticalFlaggedResponses: successful.filter(row => row.judgments.some(j => j.status === 'ok' && j.result.criticalFailures.length)).length,
    latency: distribution(successful.map(row => row.latencyMs)),
    byJudge: report.summary.find(item => item.model === model.id).byJudge };
});
const judgments = groups.flatMap(group => Object.entries(group.byJudge).flatMap(([judge, stats]) =>
  criteria.map(criterion => ({ facilitator: group.model, judge, criterion, n: stats.count, meanScore: stats.means[criterion] }))));
const errors = report.rows.flatMap(row => [
  ...(row.status === 'error' ? [{ scenario: row.scenario, facilitator: row.facilitator, role: 'facilitator', model: row.facilitator, error: row.error }] : []),
  ...row.judgments.filter(j => j.status === 'error').map(j => ({ scenario: row.scenario, facilitator: row.facilitator, role: 'critic', model: j.judge, error: j.error })),
]);
const disagreements = findDisagreements(report.rows);
const criticValidity = report.models.map(model => {
  const own = report.rows.flatMap(row => row.judgments.filter(j => j.judge === model.id));
  const valid = own.filter(j => j.status === 'ok').length;
  return { model: model.id, attempts: own.length, valid, failed: own.length - valid,
    validRate: own.length ? valid / own.length : null };
});
const cell = value => value == null ? 'N/A' : String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const table = (headers, rows) => [headers.join(' | '), headers.map(() => '---').join(' | '), ...rows.map(row => row.map(cell).join(' | '))].join('\n');
const seconds = ms => ms == null ? 'N/A' : (ms / 1000).toFixed(3);
const text = [
  `# ${report.models.length}-model evaluation`,
  ...(report.complete === false ? [`**INTERIM — collection is still in progress. ${report.rows.length}/${report.plannedRows} planned facilitator rows are available. Do not describe this as a completed benchmark.**`] : []),
  '## Scope and method',
  `This report evaluates adaptive acknowledgements using synthetic Session 1 scenarios, rather than complete participant sessions. ${report.rows.length} facilitator attempts were collected. Each successful response was independently critiqued by the other ${report.models.length - 1} models against seven criteria scored 1–5. Models never judged themselves; facilitator identity was omitted from critic evidence. Request order rotated across scenarios.`,
  `Models: ${report.models.map(m => `${m.id} (${m.provider}/${m.model})`).join(', ')}. GPT-OSS used low reasoning; Claude and Qwen used reasoning disabled where present. Groq generation temperature was 0.4; Anthropic sampling controls were omitted. Critic output budgets differ by model. The run policy was ${JSON.stringify(report.requestPolicy)}. Quota events: ${report.quotaEvents?.length ?? 'not yet available'}.`,
  `Generators requested 256 completion tokens; the GPT-OSS adapter enforces a minimum of 512. Critics used temperature 0 and these requested completion budgets: ${report.models.map(m => `${m.id}: ${m.judgeMaxTokens ?? 4096}`).join('; ')}. Groq truncation retries may increase the budget and are included in elapsed generation time. These configuration differences should accompany model comparisons.`,
  '## Completion and failures',
  table(['Model', 'Generations attempted', 'Succeeded', 'Failed', 'Valid critiques', 'Failed critiques', 'Complete judge panels'], groups.map(g => [g.model, g.attempts, g.successes, g.generationFailures, g.validCritiques, g.failedCritiques, g.completePanels])),
  `Invalid critiques are retained as failures and excluded from score averages. Missing/failed scores are not zero. A complete response has ${report.models.length - 1} valid critics. Counts and denominators must accompany comparisons.`,
  '## Interpretation',
  `Generation reliability was ${groups.reduce((sum, g) => sum + g.successes, 0)}/${report.rows.length} under the tested configuration. Local contract failures were ${groups.map(g => `${g.model}: ${g.localCheckFailures}/${g.successes}`).join('; ')}. These checks cover word count and question marks, rather than all aspects of response quality.`,
  `Structured critic reliability was ${criticValidity.map(c => `${c.model}: ${c.valid}/${c.attempts}`).join('; ')}. Failed critiques reduce the evidence available for quality comparisons. This experiment supports reporting operational reliability and contract adherence separately from automated rubric scores.`,
  'Before selecting a model on quality, independently review the anonymous responses, local violations and judge disagreements. A successful API call alone does not establish an appropriate CST acknowledgement.',
  '## Critic role: structured-output validity',
  table(['Critic model', 'Critiques attempted', 'Valid', 'Failed', 'Valid percentage'], criticValidity.map(c => [c.model, c.attempts, c.valid, c.failed, c.validRate == null ? 'N/A' : (100 * c.validRate).toFixed(1) + '%'])),
  'Validity means the JSON and required rubric fields passed local validation; it does not establish accurate judgment. Groq JSON-object mode does not guarantee rubric-schema compliance. Provider failures and invalid structures remain visible in failures.csv and raw report rows.',
  '## Local checks and critic flags',
  table(['Model', 'Word-limit/question-check failures', 'Responses flagged by any valid critic'], groups.map(g => [g.model, g.localCheckFailures, g.criticalFlaggedResponses])),
  ...(() => {
    const examples = report.rows.filter(r => r.status === 'ok' && (!r.checks.withinWordLimit || !r.checks.noQuestion)).slice(0, 6);
    return examples.length ? ['Examples below are actual saved outputs that failed the local contract checks:',
      table(['Model', 'Scenario', 'Acknowledgement', 'Local violation'], examples.map(r => [r.facilitator, r.scenario, r.acknowledgement,
        [!r.checks.withinWordLimit ? 'Over 25 words' : '', !r.checks.noQuestion ? 'Contains question mark' : ''].filter(Boolean).join('; ')]))] : [];
  })(),
  `There were ${disagreements.length} responses with criterion differences of at least two points or critical-flag disagreement among valid critics. These are diagnostic flags requiring independent review, not confirmed clinical harms.`,
  '## Scores separated by critic',
  ...groups.map(g => `### ${g.model}\n\n${table(['Critic', 'Valid judgments', ...criteria], Object.entries(g.byJudge).map(([judge, s]) => [judge, s.count, ...criteria.map(c => s.means[c] == null ? 'N/A' : s.means[c].toFixed(2))]))}`),
  'Do not rank models by pooling these panels: every facilitator has a different critic panel, and models from the same family may share preferences. Human calibration has not been completed.',
  '## Successful generation latency within the rotation run',
  table(['Model', 'Successful n', 'Mean seconds', 'Median seconds', 'p95 seconds'], groups.map(g => [g.model, g.latency.n, seconds(g.latency.meanMs), seconds(g.latency.p50Ms), seconds(g.latency.p95Ms)])),
  'These are local-client completion times for successful generations only. Ordinary scheduled pacing is excluded; adapter retries and quota-retry waits are included. They measure neither first-token latency nor deployed speech/avatar latency. Quota events can confound comparisons. Percentiles use linear interpolation.',
  '## Separate latency benchmark',
  ...(latency ? [table(['Model', 'Attempts', 'Successful n', 'Failures', 'Mean seconds', 'Median seconds', 'p95 seconds'], latency.summary.map(s => [s.modelId, s.attempts, s.successes, s.failures, seconds(s.successfulLatency.meanMs), seconds(s.successfulLatency.p50Ms), seconds(s.successfulLatency.p95Ms)])), `Latency repetitions: ${latency.repeats}; warmups per model: ${latency.warmups}. Collection complete: ${latency.complete ?? 'unknown'}. Warmups are excluded from the displayed statistics. This benchmark also measures component completion, not the deployed voice/avatar pipeline.`,
    table(['Model A', 'Model B', 'Successful matched scenarios', 'Mean A minus B seconds', 'A faster scenarios'], latency.comparisons.map(c => [c.modelA, c.modelB, c.completePairs, seconds(c.meanDeltaMs), c.aFasterPairs])),
    'Matched comparisons use the same scenario and repetition. A positive difference means model B completed faster. These are descriptive comparisons under the recorded provider settings, not guarantees for other workloads.'
    , ...(latency.complete === false ? [(() => {
      const last = latency.rows.at(-1);
      const quota = last?.errorCategory === 'rate_limit';
      const daily = quota && /tokens per day|TPD/i.test(last.error);
      return `Collection stopped after ${latency.rows.filter(r => r.phase === 'measurement').length} measured attempts out of ${latency.models.length * latency.preparedScenarios.length * latency.repeats} planned. ${daily ? `${last.modelId} reached the provider's daily token limit.` : quota ? `${last.modelId} encountered a provider quota limit.` : 'See the raw report for the stop reason.'} The failed request is retained, excluded from successful-latency statistics, and no further requests were made in this benchmark. Remaining scenarios are unmeasured.`;
    })()] : [])
  ] : ['No separate latency report was available at report creation.']),
  '## Deployed voice/avatar pipeline pilot',
  ...(deployed ? [
    `This separate experiment exercised ${deployed.api} using the deployed OpenAI transcription/text/speech pipeline, uploaded synthetic Windows speech fixtures and Rhubarb avatars. Planned measured trials: ${deployed.plannedMeasurements}; excluded session-start turns: ${deployed.plannedWarmups}. Complete: ${deployed.complete}. Stop reason: ${deployed.stoppedReason ?? 'none'}.`,
    table(['Avatar', 'Measured attempts', 'Succeeded', 'Failed', 'Mean seconds', 'Median seconds', 'p95 seconds'], deployed.summary.map(s => [s.avatarMode, s.attempts, s.successes, s.failures, seconds(s.requestLatency.meanMs), seconds(s.requestLatency.p50Ms), seconds(s.requestLatency.p95Ms)])),
    '### Cache-sensitive repetitions',
    table(['Avatar', 'Repetition', 'Successful n', 'Mean seconds', 'Median seconds'], deployed.summary.flatMap(s => [0, 1, 2].map(repeat => {
      const stats = distribution(deployed.rows.filter(r => r.phase === 'measurement' && r.avatarMode === s.avatarMode && r.repeat === repeat && r.status === 'ok').map(r => r.requestMs));
      return [s.avatarMode, repeat + 1, stats.n, seconds(stats.meanMs), seconds(stats.p50Ms)];
    }))),
    ...deployed.summary.map(s => `### ${s.avatarMode} server stages\n\n${table(['Stage', 'Recorded n', 'Mean seconds', 'Median seconds'], Object.entries(s.stages).map(([key, stats]) => [key, stats.n, seconds(stats.meanMs), seconds(stats.p50Ms)]))}`),
    'Successful trials required nonempty audio retrieval and Rhubarb mouth cues for every returned speech segment. Requests advanced each fresh session using a fixed three-fixture sequence; they were not identical-prompt repetitions. Requests used a two-second gap without waiting for browser narration. Synthetic English Windows speech does not represent natural accents, background noise or microphone recordings. Cache and prefetch effects were retained. TTS/Rhubarb service times can overlap and must not be summed as wall time. Missing timing fields on cached paths are excluded from stage averages, not replaced with zero.',
    'These are upload-to-API-completion timings, not browser time to first audible speech or first visible lip movement. Browser playback onset, microphone capture/finalisation, acoustic onset and avatar rendering are unmeasured. Only three repetitions per configuration were planned; treat percentiles and configuration comparisons as descriptive pilot statistics. Deployed build revision was not independently verified.',
  ] : ['Deployed voice/avatar measurements are not yet available in this report.']),
  '## Limitations and report wording',
  'The LLM experiment is a synthetic component benchmark of generated text; its scores do not evaluate the orchestrator, speech recognition, synthesis, avatar playback or complete-session progression. The separate deployed pilot, if present, evaluates API latency only. One generated response per scenario is insufficient to estimate stochastic variation. Automated judges are diagnostic and require CST-informed human calibration. These results do not establish usability, therapeutic effectiveness or cognitive benefit.',
  `Suggested report wording: “We evaluated ${report.models.length} language models on a synthetic adaptive-acknowledgement benchmark. Each successful output was assessed independently by the remaining models, with malformed judgments excluded and failures reported separately. Completion latency was measured at the client. Results are exploratory component-level evidence; clinical effectiveness was outside this experiment.”`,
  '## Evidence files',
  `Rotation source: ${source}\n\nLatency source: ${values.latency ? resolve(values.latency) : 'not collected'}\n\nHuman review: use the rotation run’s anonymous human-review.json. Raw results remain in the associated run directory.`,
].join('\n\n') + '\n';
await writeFile(resolve(out, 'evaluation.md'), text);
if (deployed) {
  const section = text.slice(text.indexOf('## Deployed voice/avatar pipeline pilot'), text.indexOf('## Limitations and report wording'));
  await writeFile(resolve(out, 'deployed-voice-evaluation.md'), '# Deployed voice/avatar latency evaluation\n\n' + section +
    '\nEvidence: deployed-summary.json, deployed-voice-rows.jsonl and deployed-voice-samples.csv in this directory. This pilot measures latency and audio/lip-sync delivery, not therapeutic effectiveness.\n');
}
await writeFile(resolve(out, 'evaluation.json'), JSON.stringify({ source, complete: report.complete ?? true, plannedRows: report.plannedRows ?? report.rows.length, latencySource: values.latency ? resolve(values.latency) : null, groups, criticValidity, errors, disagreements, deployed: deployed ? { complete: deployed.complete, stoppedReason: deployed.stoppedReason, summary: deployed.summary } : null }, null, 2));
await writeFile(resolve(out, 'judge-scores.csv'), toCsv(judgments, ['facilitator', 'judge', 'criterion', 'n', 'meanScore']));
await writeFile(resolve(out, 'failures.csv'), toCsv(errors, ['scenario', 'facilitator', 'role', 'model', 'error']));
console.log('Saved evaluation to ' + out);
