# LLM evaluation pilot

The [completed application-model comparison](published/2026-10-18-production-model-comparison/README.md) evaluates gpt-5.4-mini, GPT-OSS 120B, Qwen, Claude Sonnet and Claude Haiku across 30 scenarios: 150 responses and 600 valid critiques. It reuses retained-model evidence and documents targeted new collection. GPT-OSS 20B is excluded. Raw evidence remains local; the PR contains concise reports, score CSVs, settings and provenance.

A dedicated automatic latency benchmark provides warmups, percentiles, failure analysis and research CSV exports. See [latency collection protocol](LATENCY.md); run `npm run eval:latency` for a dry run.

How latency, errors and degraded responses change with many simultaneous users is covered in [the concurrent-user load test](CONCURRENCY.md); run `npm run eval:concurrency -- --api http://localhost:5000/api` for a dry run.

Speech-to-text accuracy on DementiaBank recordings (word error rate, Groq vs OpenAI, before/after the STT prompt change) is covered in [STT word error rate](STT-WER.md); run `npm run eval:stt` for a dry run.

The offline runner rotates each configured model through facilitator and critic roles. It uses the real `buildCstAdaptiveResponseInstructions` prompt builder and LLM service, without a database or live participant session.

## Run

From `backend`:

```powershell
npm run eval:llm
npm run eval:llm -- --live --limit 1
npm run eval:llm -- --live --repeats 3
```

The default command is a dry run: validates configuration and prints call counts without contacting providers. `--live` uses keys from backend/.env and incurs provider usage. Start with one scenario to check access and limits.

Options: `--models path.json`, `--scenarios path.json`, `--limit N`, `--repeats N` (1–20), `--out directory`, `--delay-ms N` (0–300000; default 61000 per provider/model), `--quota-retries N` (0–5; default 2). Relative paths resolve from the current directory. There are 30 synthetic Session 1 scenarios; one repetition of three models makes 90 generation calls and 180 critic calls, before retries. No real participant records are read.

Ordinary requests use the configured interval between starts for the same model, defaulting to 61 seconds, across facilitator and critic roles. HTTP 429 failures receive at most two retries, waiting the longer of the configured interval or the provider's stated retry time plus one second (61 seconds when no timing is supplied). Quota events, including recovered failures, are retained in `report.json`. Ordinary pacing happens before generation timing; retry waits remain included in generation latency. Run benchmarks separately so they do not compete for account quotas. Pacing does not guarantee success if a single request exceeds a quota or daily limits are exhausted. A full 30-scenario run can take several hours depending on request order and retries.

## Model research, checked 22 September 2026

| Model | Purpose | Caveat |
|---|---|---|
| Groq openai/gpt-oss-120b | Existing application's default; baseline facilitator and critic | Shares its family with the 20B candidate |
| Groq openai/gpt-oss-20b | Smaller same-family comparison for quality and latency | Not an independent model family |
| Groq qwen/qwen3.8-27b | Different-family comparison on the same provider | Preview model; account rate limits can be restrictive |

These are practical candidates, not a claim that they are equally capable or validated for CST. Keeping the provider constant removes one infrastructure difference; it does not remove model bias. Qwen runs with reasoning disabled, while GPT-OSS retains the app's low reasoning setting. Report this distinction when interpreting results.

Groq lists the two GPT-OSS models as production models and Qwen as preview. Llama 3.3 70B and Qwen3 32B were considered but their standard-tier endpoints were retired; Llama remains enterprise-only. Check provider availability again before a study:
- [Supported models](https://console.groq.com/docs/models)
- [Deprecations and replacement models](https://console.groq.com/docs/deprecations)
- [Reasoning controls](https://console.groq.com/docs/reasoning)

The existing OpenAI route can also participate through an explicit `{"id":"...","provider":"openai","model":"..."}` roster entry and OPENAI_API_KEY. Explicit model IDs keep experiments independent of the application's environment defaults. Duplicate provider/model pairs are rejected. `judgeMaxTokens` optionally controls a critic's output budget; Qwen defaults to 900 here after a live account-limit failure with the larger budget.

### Adding Claude (23 September 2026)

The supplied `models-with-claude.json` roster adds Anthropic Claude Sonnet 5 as a fourth facilitator/critic, providing a third model family and a second provider. Set `ANTHROPIC_API_KEY` in `backend/.env` locally; do not commit it. The ordinary Groq-only roster still works without that key. The command checks all required keys before making any generation calls; a missing key never silently removes a candidate.

From `backend`:

```powershell
npm run eval:llm -- --models evaluation/models-with-claude.json --limit 1
npm run eval:llm -- --models evaluation/models-with-claude.json --live --limit 1
```

One four-model scenario makes four generation calls and twelve critiques. All 30 scenarios make 120 generations and 360 critiques per repetition, before any Groq truncation retries. Each remaining model judges the facilitator independently.

The adapter uses Anthropic's Messages API, separates system instructions, disables extended thinking, and omits sampling controls because Sonnet 5 rejects custom temperature settings. Critiques use `output_config.format` with a JSON schema plus local score/evidence validation. Refusals, truncated responses and non-text completions become visible failures. The timeout covers both response headers and body. These settings differ from Groq's low-reasoning GPT-OSS configuration and should be reported in comparisons.

`claude-sonnet-5` was selected from Anthropic's current documentation. The roster explicitly pins the model ID; `ANTHROPIC_TEXT_MODEL` controls only calls without an explicit model. Another supported Claude model can be tested by editing a copied roster, subject to account availability and structured-output support.

Sources: [model lineup](https://platform.claude.com/docs/en/models/overview), [Messages API](https://platform.claude.com/docs/en/api/messages/create), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Sonnet 5 configuration changes](https://platform.claude.com/docs/en/models/sonnet-5/migration-guide).

### Balanced GPT-OSS/Claude roster (13 October 2026)

`models-balanced.json` compares GPT-OSS 120B and 20B (hosted on Groq) with Claude Sonnet 5 and Haiku 5.5 (hosted on Anthropic). It replaces Qwen only in this separate roster; previous rosters are preserved. Both Claude models use the existing `ANTHROPIC_API_KEY`, disabled thinking, and schema-constrained critiques with a 1600-token output budget.

```powershell
npm run eval:llm -- --models evaluation/models-balanced.json --limit 1
npm run eval:llm -- --models evaluation/models-balanced.json --live --limit 1
```

One scenario makes four generation calls and twelve critiques. For all 30 scenarios, omit `--limit 1`. Equal model counts do not remove shared-family judge preferences or provider differences; retain scores by judge and calibrate against human review. Haiku 5.5's ID is `claude-haiku-5-5`, documented in the [Anthropic model overview](https://platform.claude.com/docs/en/models/overview). Account access must be verified with a live pilot before the main study.

## What is measured

Seven criteria use integer scores from 1 (clear failure) through 5 (fully satisfies): script adherence, relevance, accessibility, respect, grounding, handling difficulty and continuity. Critics must supply evidence. Serious failures are counted separately. Local checks flag acknowledgement word limits and question marks.

Every candidate receives the same prepared prompt, input and history. Request order rotates across scenarios/repetitions. Each remaining model critiques independently without being told the facilitator identity or seeing other critiques. No model judges its own output. JSON is preserved verbatim and validated; malformed judgments never become zero scores or silently enter averages.

Scores remain separated by facilitator and critic because each candidate has a different judge panel. Do not rank candidates by an unqualified pooled average. The two GPT-OSS models may share preferences. Hidden authorship does not eliminate stylistic self-preference.

This design follows the bias concerns documented by [Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685). Independent model opinions are useful diagnostics, not ground truth.

## Outputs and human calibration

New collections prepared for version control live under `published/YYYY-MM-DD/`, with a collection README, Markdown summaries, raw evidence and CSV tables. Runtime checkpoints remain ignored under `results/`. Failed calls and invalid critiques remain in the published reports. Publication here means writing local repository files, not committing or pushing Git changes.

The [15 October 2026 collection](published/2026-10-15/README.md) contains the default three-model roster: 30 scenarios, 90 successful generations and 180 valid critiques. The separate deployed OpenAI speech pilot completed 18 measured turns and six warmups. Generation timing is retained from the quality run; no separate text-only latency benchmark was collected. The deployed pilot ran before the quality evaluation and measures API completion and audio delivery, excluding browser playback/rendering onset. No human calibration has been completed.

### Export completed runs without API calls

From `backend`, supply the completed run directories (relative to the current directory):

```powershell
node scripts/publish-evaluation.js --llm-run evaluation/results/current-2026-10-15/llm/2026-10-14T23-36-07-829Z-271b9fcf --deployed-run evaluation/results/current-2026-10-15/deployed --date 2026-10-15
```

The command validates the full scenario/model/repetition plan, checks the fixture hash and critique attempts, scans for configured credentials, removes local checkout paths, and writes checksums for the exported files. The destination must be new: the example collection already exists in this branch. An optional `--latency-run directory` includes a separate text-only benchmark and requires the same model roster. Failed attempts are preserved, not repaired or hidden. Older manifests record HEAD without working-tree status/source hashes; their saved prompts remain the authoritative prompt evidence. New LLM runs also record working-tree status and source hashes.

`complete-evaluation-workflow.js --llm-run directory --api https://BACKEND/api --date YYYY-MM-DD` is a **live** workflow: it waits for a completed quality run under `results/current-DATE/`, runs separate text latency using the saved roster and scenarios, collects fresh deployed speech turns, then calls the offline exporter. `finish-evaluation-run.js REPORT_JSON OUTPUT_DIRECTORY` is an alternative live text-latency/report helper. Neither helper is needed to export already-collected results. Run provider benchmarks sequentially to avoid quota contention.

To collect a fresh deployed speech pilot, write `{"api":"https://BACKEND/api"}` to a local target JSON and run `node scripts/collect-deployed-voice-latency.js TARGET_JSON NEW_OUTPUT_DIRECTORY`. This is live, creates six synthetic users/sessions, persists messages, and consumes speech/text provider usage; existing participant sessions are not used. Existing output directories are rejected to prevent mixing checkpoints from separate runs.

For optional chart exports, install `reportlab` and `pypdfium2` in your Python environment and run `python scripts/plot-stage-latency.py --report COLLECTION/deployed-summary.json --out NEW_CHART_DIRECTORY`. The chart derives its date, sample counts, avatars and axis range from the report; exported CSV preserves each stage's sample count.

Each run gets a unique directory under ignored `evaluation/results/`:
- `manifest.json`: revision, roster, fixture snapshot/hash and start time.
- `rows.jsonl`: checkpoint after each candidate and its critiques, including failures.
- `report.json`: exact prompts and hashes, raw critic output, per-response generation latency, local checks, failure counts and scores broken down by judge.
- `human-review.json`: shuffled, anonymous candidate IDs with blank human score fields and no model scores. Join completed reviews to report rows by ID.
- `disagreements.json`: rows where valid critics differ by at least two score points on a criterion, or disagree on whether any critical failure exists. Failed critics are excluded. Keep this file hidden from reviewers until their independent scoring is complete.

Have a CST-informed reviewer score a sample without consulting report.json. Include ordinary cases as well as flagged/disputed cases; do not review only failures. Compare criterion-level human/model agreement and inspect disagreements before trusting automated scores.

Fill `humanScores` with integers 1–5; leave unreviewed criteria as null. Preserve the exported IDs, input and acknowledgement text. Then run:

```powershell
npm run eval:calibrate -- --report evaluation/results/RUN/report.json --review evaluation/results/RUN/human-review.json --out evaluation/results/RUN/calibration.json
```

Replace RUN with the generated directory name. This command makes no API calls. It reports exact agreement, agreement within one point, mean absolute error and mean signed error for each judge/criterion, with sample counts. Positive signed error means the judge scores more generously than the reviewer. Blank ratings and failed judgments are excluded; duplicate IDs, mismatched source text and invalid ratings fail validation. The output path must be new to prevent overwriting a report/review. These are descriptive comparisons with one reviewer, not reliability estimates or clinical validation. Human critical-failure annotations remain for manual review; the comparison currently measures numeric rubric scores only.

An unrecovered API failure or invalid critique makes the command exit nonzero after saving completed results. Runs are sequential and paced. Rate-limit events remain visible; there is no automatic resume or provider substitution. The underlying Groq client may retry a truncated generation once. A process interruption retains completed rows, but may lose the current row. Treat incomplete panels as incomplete experiments.

## Scope and next steps

This is a component benchmark for adaptive acknowledgements. `responsePreview` concatenates the acknowledgement and fixture's scripted continuation to help assess their fit. It is explicitly a preview: the full orchestrator's overlap filtering, progression decisions, fallback handling, special activities and persisted state are not executed. Generation failures are exposed, not replaced with a scripted fallback. The provided fixtures preselect answer state, so they do not evaluate the model's answer-state decision.

Full-session replay and opt-in live UI rotation are now available separately: see [the session evaluation guide](SESSIONS.md). Neither benchmark measures speech/avatars, estimates API cost, or establishes cognitive/clinical benefit. Generation latency includes client/network time and any retry; no provider token-usage or cost totals are claimed. Additional repetitions are stochastic, not deterministic replication; prompts and fixtures are saved to make differences inspectable.

Next implementation stages:
1. Expand replay fixtures beyond Session 1 to image-grounded activities, orientation and summaries.
2. Extend human-review comparisons to full sessions, multiple reviewers, confidence intervals and held-out scenarios.
3. Calibrate live-session critiques against independent human review.

Use the synthetic starter set for development, then separate development cases from a held-out test set. Do not infer therapeutic effectiveness from judge scores; participant usability and outcome studies answer different questions.

## Initial verification

The backend regression suite and evaluation runner tests passed during initial implementation. A one-scenario live smoke test completed all three generations and six validated critiques after reducing Qwen's critic budget. This verified connectivity and output handling, not comparative model quality. Completed benchmark evidence is now available in the dated collection linked above.

Claude integration has mocked API coverage for headers, system instructions, schema preservation, refusals, truncation, credential checks, HTTP errors and aborted body reads. Live Claude verification requires an Anthropic API key; no key was configured during implementation, so the four-model live command stopped in preflight without API calls.
