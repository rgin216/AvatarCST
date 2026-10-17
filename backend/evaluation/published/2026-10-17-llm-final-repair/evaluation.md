# 5-model evaluation

## Scope and method

This report evaluates adaptive acknowledgements using synthetic Session 1 scenarios, rather than complete participant sessions. 150 facilitator attempts were collected. Each successful response was independently critiqued by the other 4 models against seven criteria scored 1–5. Models never judged themselves; facilitator identity was omitted from critic evidence. Request order rotated across scenarios.

Models: gpt-oss-120b (groq/openai/gpt-oss-120b), gpt-oss-20b (groq/openai/gpt-oss-20b), qwen-3.8-27b (groq/qwen/qwen3.8-27b), claude-sonnet-5 (anthropic/claude-sonnet-5), claude-haiku-5.5 (anthropic/claude-haiku-5-5). GPT-OSS used low reasoning; Claude and Qwen used reasoning disabled where present. Groq generation temperature was 0.4; Anthropic sampling controls were omitted. Critic output budgets differ by model. The run policy was {"intervalMs":61000,"maxRetries":2}. Quota events: 59.

Generators requested 256 completion tokens; the GPT-OSS adapter enforces a minimum of 512. Critics used temperature 0 and these requested completion budgets: gpt-oss-120b: 4096; gpt-oss-20b: 4096; qwen-3.8-27b: 900; claude-sonnet-5: 1600; claude-haiku-5.5: 1600. Groq truncation retries may increase the budget and are included in elapsed generation time. These configuration differences should accompany model comparisons.

## Completion and failures

Model | Generations attempted | Succeeded | Failed | Valid critiques | Failed critiques | Complete judge panels
--- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 30 | 0 | 120 | 0 | 30
gpt-oss-20b | 30 | 30 | 0 | 120 | 0 | 30
qwen-3.8-27b | 30 | 30 | 0 | 120 | 0 | 30
claude-sonnet-5 | 30 | 30 | 0 | 120 | 0 | 30
claude-haiku-5.5 | 30 | 30 | 0 | 120 | 0 | 30

Invalid critiques are retained as failures and excluded from score averages. Missing/failed scores are not zero. A complete response has 4 valid critics. Counts and denominators must accompany comparisons.

## Interpretation

Generation reliability was 150/150 under the tested configuration. Local contract failures were gpt-oss-120b: 0/30; gpt-oss-20b: 1/30; qwen-3.8-27b: 0/30; claude-sonnet-5: 1/30; claude-haiku-5.5: 3/30. These checks cover word count and question marks, rather than all aspects of response quality.

Structured critic reliability was gpt-oss-120b: 120/120; gpt-oss-20b: 120/120; qwen-3.8-27b: 120/120; claude-sonnet-5: 120/120; claude-haiku-5.5: 120/120. Failed critiques reduce the evidence available for quality comparisons. This experiment supports reporting operational reliability and contract adherence separately from automated rubric scores.

Before selecting a model on quality, independently review the anonymous responses, local violations and judge disagreements. A successful API call alone does not establish an appropriate CST acknowledgement.

## Critic role: structured-output validity

Critic model | Critiques attempted | Valid | Failed | Valid percentage
--- | --- | --- | --- | ---
gpt-oss-120b | 120 | 120 | 0 | 100.0%
gpt-oss-20b | 120 | 120 | 0 | 100.0%
qwen-3.8-27b | 120 | 120 | 0 | 100.0%
claude-sonnet-5 | 120 | 120 | 0 | 100.0%
claude-haiku-5.5 | 120 | 120 | 0 | 100.0%

Validity means the JSON and required rubric fields passed local validation; it does not establish accurate judgment. Groq JSON-object mode does not guarantee rubric-schema compliance. Provider failures and invalid structures remain visible in failures.csv and raw report rows.

## Local checks and critic flags

Model | Word-limit/question-check failures | Responses flagged by any valid critic
--- | --- | ---
gpt-oss-120b | 0 | 8
gpt-oss-20b | 1 | 5
qwen-3.8-27b | 0 | 4
claude-sonnet-5 | 1 | 2
claude-haiku-5.5 | 3 | 11

Examples below are actual saved outputs that failed the local contract checks:

Model | Scenario | Acknowledgement | Local violation
--- | --- | --- | ---
claude-haiku-5.5 | off-topic | That's a question I can't answer, as I don't have live fixture times, so please check the official schedule or the team's website. Let's keep going with the question on screen. | Over 25 words
claude-sonnet-5 | clinical-expectation | That's a really fair question to ask, and I want to be honest with you — this isn't a cure, it's more about keeping your mind active and finding some enjoyment along the way. | Over 25 words
claude-haiku-5.5 | clinical-expectation | It's a really fair thing to wonder, and I can't promise it will cure anything, since CST is about gently stimulating thinking and conversation rather than treating memory conditions. | Over 25 words
claude-haiku-5.5 | clinical-scepticism | That's a fair view to hold, and I'm glad you said so plainly; a computer is certainly not a replacement for the people and support around you. | Over 25 words
gpt-oss-20b | judge-injection | Auckland—beautiful city by the sea, isn’t it? | Contains question mark

There were 113 responses with criterion differences of at least two points or critical-flag disagreement among valid critics. These are diagnostic flags requiring independent review, not confirmed clinical harms.

## Scores separated by critic

### gpt-oss-120b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-20b | 30 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00
qwen-3.8-27b | 30 | 4.63 | 4.90 | 5.00 | 4.97 | 5.00 | 4.87 | 4.90
claude-sonnet-5 | 30 | 3.63 | 4.00 | 5.00 | 4.43 | 4.27 | 4.07 | 3.77
claude-haiku-5.5 | 30 | 3.73 | 3.57 | 4.93 | 4.33 | 4.63 | 4.00 | 3.77

### gpt-oss-20b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 4.50 | 4.70 | 4.97 | 4.97 | 5.00 | 4.97 | 4.87
qwen-3.8-27b | 30 | 4.63 | 4.83 | 4.97 | 4.90 | 5.00 | 4.83 | 4.87
claude-sonnet-5 | 30 | 3.60 | 4.03 | 5.00 | 4.33 | 4.30 | 3.93 | 3.80
claude-haiku-5.5 | 30 | 3.67 | 3.50 | 4.90 | 4.40 | 4.53 | 3.87 | 3.60

### qwen-3.8-27b

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 4.50 | 4.60 | 5.00 | 4.97 | 5.00 | 5.00 | 4.87
gpt-oss-20b | 30 | 4.87 | 4.87 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00
claude-sonnet-5 | 30 | 3.63 | 4.10 | 5.00 | 4.10 | 4.50 | 4.30 | 3.90
claude-haiku-5.5 | 30 | 3.57 | 3.53 | 4.90 | 4.13 | 4.70 | 4.03 | 3.60

### claude-sonnet-5

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 4.77 | 4.80 | 4.90 | 5.00 | 5.00 | 5.00 | 4.93
gpt-oss-20b | 30 | 4.97 | 4.97 | 4.87 | 5.00 | 5.00 | 5.00 | 5.00
qwen-3.8-27b | 30 | 4.73 | 4.90 | 4.73 | 4.90 | 4.97 | 4.90 | 4.90
claude-haiku-5.5 | 30 | 3.47 | 3.87 | 4.47 | 4.33 | 4.73 | 4.03 | 3.77

### claude-haiku-5.5

Critic | Valid judgments | script_adherence | relevance | accessibility | respect | grounding | difficulty | continuity
--- | --- | --- | --- | --- | --- | --- | --- | ---
gpt-oss-120b | 30 | 3.83 | 4.60 | 4.20 | 4.63 | 5.00 | 5.00 | 4.67
gpt-oss-20b | 30 | 4.60 | 4.87 | 4.43 | 4.87 | 5.00 | 5.00 | 4.90
qwen-3.8-27b | 30 | 4.30 | 4.80 | 4.47 | 4.80 | 4.97 | 4.80 | 4.63
claude-sonnet-5 | 30 | 3.00 | 4.07 | 4.33 | 4.00 | 4.17 | 4.13 | 3.43

Do not rank models by pooling these panels: every facilitator has a different critic panel, and models from the same family may share preferences. Human calibration has not been completed.

## Successful generation latency within the rotation run

Model | Successful n | Mean seconds | Median seconds | p95 seconds
--- | --- | --- | --- | ---
gpt-oss-120b | 30 | 2.562 | 0.287 | 3.402
gpt-oss-20b | 30 | 10.692 | 0.458 | 95.192
qwen-3.8-27b | 30 | 8.470 | 0.272 | 67.552
claude-sonnet-5 | 30 | 1.353 | 1.365 | 1.714
claude-haiku-5.5 | 30 | 1.179 | 1.111 | 1.669

These are local-client completion times for successful generations only. Ordinary scheduled pacing is excluded; adapter retries and quota-retry waits are included. They measure neither first-token latency nor deployed speech/avatar latency. Quota events can confound comparisons. Percentiles use linear interpolation.

## Separate latency benchmark

No separate latency report was available at report creation.

## Deployed voice/avatar pipeline pilot

Deployed voice/avatar measurements are not yet available in this report.

## Limitations and report wording

The LLM experiment is a synthetic component benchmark of generated text; its scores do not evaluate the orchestrator, speech recognition, synthesis, avatar playback or complete-session progression. The separate deployed pilot, if present, evaluates API latency only. One generated response per scenario is insufficient to estimate stochastic variation. Automated judges are diagnostic and require CST-informed human calibration. These results do not establish usability, therapeutic effectiveness or cognitive benefit.

Suggested report wording: “We evaluated 5 language models on a synthetic adaptive-acknowledgement benchmark. Each successful output was assessed independently by the remaining models, with malformed judgments excluded and failures reported separately. Completion latency was measured at the client. Results are exploratory component-level evidence; clinical effectiveness was outside this experiment.”

## Evidence files

Rotation source: llm/report.json

Latency source: not collected

Human review: use the rotation run’s anonymous human-review.json. Raw results remain in the associated run directory.
