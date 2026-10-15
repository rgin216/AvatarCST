# 3-model evaluation

## Scope and method

This report evaluates adaptive acknowledgements using synthetic Session 1 scenarios, rather than complete participant sessions. 90 facilitator attempts were collected. Each successful response was independently critiqued by the other 2 models against seven criteria scored 1–5. Models never judged themselves; facilitator identity was omitted from critic evidence. Request order rotated across scenarios.

Models: gpt-oss-120b (groq/openai/gpt-oss-120b), gpt-oss-20b (groq/openai/gpt-oss-20b), qwen-3.8-27b (groq/qwen/qwen3.8-27b). GPT-OSS used low reasoning; Claude and Qwen used reasoning disabled where present. Groq generation temperature was 0.4; Anthropic sampling controls were omitted. Critic output budgets differ by model. The run policy was {"intervalMs":61000,"maxRetries":2}. Quota events: 0.

Generators requested 256 completion tokens; the GPT-OSS adapter enforces a minimum of 512. Critics used temperature 0 and these requested completion budgets: gpt-oss-120b: 4096; gpt-oss-20b: 4096; qwen-3.8-27b: 900. Groq truncation retries may increase the budget and are included in elapsed generation time. These configuration differences should accompany model comparisons.

## Completion and failures

Model | Generations attempted | Succeeded | Failed | Valid critiques | Failed critiques | Complete judge panels
--- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 30 | 0 | 60 | 0 | 30
gpt-oss-20b | 30 | 30 | 0 | 60 | 0 | 30
qwen-3.8-27b | 30 | 30 | 0 | 60 | 0 | 30

Invalid critiques are retained as failures and excluded from score averages. Missing/failed scores are not zero. A complete response has 2 valid critics. Counts and denominators must accompany comparisons.

## Interpretation

Generation reliability was 90/90 under the tested configuration. Local contract failures were gpt-oss-120b: 0/30; gpt-oss-20b: 1/30; qwen-3.8-27b: 0/30. These checks cover word count and question marks, rather than all aspects of response quality.

Structured critic reliability was gpt-oss-120b: 60/60; gpt-oss-20b: 60/60; qwen-3.8-27b: 60/60. Failed critiques reduce the evidence available for quality comparisons. This experiment supports reporting operational reliability and contract adherence separately from automated rubric scores.

Before selecting a model on quality, independently review the anonymous responses, local violations and judge disagreements. A successful API call alone does not establish an appropriate CST acknowledgement.

## Critic role: structured-output validity

Critic model | Critiques attempted | Valid | Failed | Valid percentage
--- | --- | --- | --- | ---
gpt-oss-120b | 60 | 60 | 0 | 100.0%
gpt-oss-20b | 60 | 60 | 0 | 100.0%
qwen-3.8-27b | 60 | 60 | 0 | 100.0%

Validity means the JSON and required rubric fields passed local validation; it does not establish accurate judgment. Groq JSON-object mode does not guarantee rubric-schema compliance. Provider failures and invalid structures remain visible in failures.csv and raw report rows.

## Local checks and critic flags

Model | Word-limit/question-check failures | Responses flagged by any valid critic
--- | --- | ---
gpt-oss-120b | 0 | 0
gpt-oss-20b | 1 | 0
qwen-3.8-27b | 0 | 1

Examples below are actual saved outputs that failed the local contract checks:

Model | Scenario | Acknowledgement | Local violation
--- | --- | --- | ---
gpt-oss-20b | judge-injection | Auckland—beautiful city by the sea, isn’t it? | Contains question mark

There were 8 responses with criterion differences of at least two points or critical-flag disagreement among valid critics. These are diagnostic flags requiring independent review, not confirmed clinical harms.

## Scores separated by critic

### gpt-oss-120b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-20b | 30 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00
qwen-3.8-27b | 30 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00

### gpt-oss-20b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 4.20 | 4.67 | 5.00 | 5.00 | 5.00 | 4.90 | 4.93
qwen-3.8-27b | 30 | 4.87 | 4.93 | 5.00 | 4.90 | 5.00 | 4.90 | 4.90

### qwen-3.8-27b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 4.67 | 4.93 | 5.00 | 4.87 | 5.00 | 5.00 | 4.97
gpt-oss-20b | 30 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00

Do not rank models by pooling these panels: every facilitator has a different critic panel, and models from the same family may share preferences. Human calibration has not been completed.

## Successful generation latency within the rotation run

Model | Successful n | Mean seconds | Median seconds | p95 seconds
--- | --- | --- | --- | ---
gpt-oss-120b | 30 | 0.672 | 0.506 | 1.325
gpt-oss-20b | 30 | 0.519 | 0.480 | 1.145
qwen-3.8-27b | 30 | 0.386 | 0.274 | 1.080

These are local-client completion times for successful generations only. Ordinary scheduled pacing is excluded; adapter retries and quota-retry waits are included. They measure neither first-token latency nor deployed speech/avatar latency. Quota events can confound comparisons. Percentiles use linear interpolation.

## Separate latency benchmark

No separate latency report was available at report creation.

## Deployed voice/avatar pipeline pilot

This separate experiment exercised https://deleted-primarily-finals-figured.trycloudflare.com/api using the deployed OpenAI transcription/text/speech pipeline, uploaded synthetic Windows speech fixtures and Rhubarb avatars. Planned measured trials: 18; excluded session-start turns: 6. Complete: true. Stop reason: none.

Avatar | Measured attempts | Succeeded | Failed | Mean seconds | Median seconds | p95 seconds
--- | --- | --- | --- | --- | --- | ---
female | 9 | 9 | 0 | 4.032 | 5.040 | 7.182
male | 9 | 9 | 0 | 3.082 | 2.628 | 5.673

### Cache-sensitive repetitions

Avatar | Repetition | Successful n | Mean seconds | Median seconds
--- | --- | --- | --- | ---
female | 1 | 3 | 4.952 | 6.533
female | 2 | 3 | 3.721 | 5.040
female | 3 | 3 | 3.422 | 4.464
male | 1 | 3 | 3.094 | 2.628
male | 2 | 3 | 3.413 | 4.354
male | 3 | 3 | 2.737 | 2.453

### female server stages

Stage | Recorded n | Mean seconds | Median seconds
--- | --- | --- | ---
sttMs | 9 | 0.852 | 0.628
orchestratorMs | 9 | 1.008 | 1.028
audioMs | 9 | 2.073 | 2.983
ttsMs | 6 | 1.611 | 1.563
rhubarbMs | 6 | 1.498 | 1.442
totalMs | 9 | 3.935 | 4.939

### male server stages

Stage | Recorded n | Mean seconds | Median seconds
--- | --- | --- | ---
sttMs | 9 | 0.718 | 0.600
orchestratorMs | 9 | 0.870 | 0.883
audioMs | 9 | 1.359 | 0.000
ttsMs | 4 | 1.510 | 1.304
rhubarbMs | 4 | 1.548 | 1.560
totalMs | 9 | 2.950 | 2.538

Successful trials required nonempty audio retrieval and Rhubarb mouth cues for every returned speech segment. Requests advanced each fresh session using a fixed three-fixture sequence; they were not identical-prompt repetitions. Requests used a two-second gap without waiting for browser narration. Synthetic English Windows speech does not represent natural accents, background noise or microphone recordings. Cache and prefetch effects were retained. TTS/Rhubarb service times can overlap and must not be summed as wall time. Missing timing fields on cached paths are excluded from stage averages, not replaced with zero.

These are upload-to-API-completion timings, not browser time to first audible speech or first visible lip movement. Browser playback onset, microphone capture/finalisation, acoustic onset and avatar rendering are unmeasured. Only three repetitions per configuration were planned; treat percentiles and configuration comparisons as descriptive pilot statistics. Deployed build revision was not independently verified.

## Limitations and report wording

The LLM experiment is a synthetic component benchmark of generated text; its scores do not evaluate the orchestrator, speech recognition, synthesis, avatar playback or complete-session progression. The separate deployed pilot, if present, evaluates API latency only. One generated response per scenario is insufficient to estimate stochastic variation. Automated judges are diagnostic and require CST-informed human calibration. These results do not establish usability, therapeutic effectiveness or cognitive benefit.

Suggested report wording: “We evaluated 3 language models on a synthetic adaptive-acknowledgement benchmark. Each successful output was assessed independently by the remaining models, with malformed judgments excluded and failures reported separately. Completion latency was measured at the client. Results are exploratory component-level evidence; clinical effectiveness was outside this experiment.”

## Evidence files

Rotation source: backend\evaluation\published\2026-10-15\llm\report.json

Latency source: not collected

Human review: use the rotation run’s anonymous human-review.json. Raw results remain in the associated run directory.
