# LLM evaluation pilot

The offline runner rotates each configured model through facilitator and critic roles. It uses the real `buildCstAdaptiveResponseInstructions` prompt builder and LLM service, without a database or live participant session.

## Run

From `backend`:

```powershell
npm run eval:llm
npm run eval:llm -- --live --limit 1
npm run eval:llm -- --live --repeats 3
```

The default command is a dry run: validates configuration and prints call counts without contacting providers. `--live` uses keys from backend/.env and incurs provider usage. Start with one scenario to check access and limits.

Options: `--models path.json`, `--scenarios path.json`, `--limit N`, `--repeats N` (1–20), `--out directory`. Relative paths resolve from the current directory. There are 30 synthetic Session 1 scenarios; one repetition of three models makes 90 generation calls and 180 critic calls, before truncation retries. No real participant records are read.

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

## What is measured

Seven criteria use integer scores from 1 (clear failure) through 5 (fully satisfies): script adherence, relevance, accessibility, respect, grounding, handling difficulty and continuity. Critics must supply evidence. Serious failures are counted separately. Local checks flag acknowledgement word limits and question marks.

Every candidate receives the same prepared prompt, input and history. Request order rotates across scenarios/repetitions. Each remaining model critiques independently without being told the facilitator identity or seeing other critiques. No model judges its own output. JSON is preserved verbatim and validated; malformed judgments never become zero scores or silently enter averages.

Scores remain separated by facilitator and critic because each candidate has a different judge panel. Do not rank candidates by an unqualified pooled average. The two GPT-OSS models may share preferences. Hidden authorship does not eliminate stylistic self-preference.

This design follows the bias concerns documented by [Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685). Independent model opinions are useful diagnostics, not ground truth.

## Outputs and human calibration

Each run gets a unique directory under ignored `evaluation/results/`:
- `manifest.json`: revision, roster, fixture snapshot/hash and start time.
- `rows.jsonl`: checkpoint after each candidate and its critiques, including failures.
- `report.json`: exact prompts and hashes, raw critic output, per-response generation latency, local checks, failure counts and scores broken down by judge.
- `human-review.json`: shuffled, anonymous candidate IDs with blank human score fields and no model scores. Join completed reviews to report rows by ID.

Have a CST-informed reviewer score a sample without consulting report.json. Include ordinary cases as well as flagged/disputed cases; do not review only failures. Compare criterion-level human/model agreement and inspect disagreements before trusting automated scores. The export supports manual calibration; automated agreement statistics and review ingestion are not implemented yet.

An API failure or invalid critique makes the command exit nonzero after saving completed results. Runs are sequential to reduce bursts. Rate-limit errors remain visible; there is no automatic throttling/resume or provider substitution. The underlying Groq client may retry a truncated generation once. A process interruption retains completed rows, but may lose the current row. Treat incomplete panels as incomplete experiments.

## Scope and next steps

This is a component benchmark for adaptive acknowledgements. `responsePreview` concatenates the acknowledgement and fixture's scripted continuation to help assess their fit. It is explicitly a preview: the full orchestrator's overlap filtering, progression decisions, fallback handling, special activities and persisted state are not executed. Generation failures are exposed, not replaced with a scripted fallback. The provided fixtures preselect answer state, so they do not evaluate the model's answer-state decision.

It does not yet rotate models in the live UI, evaluate complete sessions, measure speech/avatars, estimate API cost, or establish cognitive/clinical benefit. Generation latency includes client/network time and any retry; no provider token-usage or cost totals are claimed. Additional repetitions are stochastic, not deterministic replication; prompts and fixtures are saved to make differences inspectable.

Next implementation stages:
1. Replay complete application sessions with isolated state and record delivered text, progression and fallback provenance.
2. Expand beyond Session 1 to image-grounded activities, orientation and summaries.
3. Add human-review ingestion/agreement metrics, confidence intervals, judge-disagreement reports and held-out scenarios.
4. Add opt-in session-level live assignments and asynchronous critiques after offline calibration.

Use the synthetic starter set for development, then separate development cases from a held-out test set. Do not infer therapeutic effectiveness from judge scores; participant usability and outcome studies answer different questions.

## Initial verification

The backend regression suite passed 234 tests during implementation. After the final evaluation-only changes, all seven runner tests passed again. A one-scenario live smoke test completed all three generations and six validated critiques after reducing Qwen's critic budget. This verifies connectivity and output handling, not comparative model quality. Full benchmark results have not yet been collected.
