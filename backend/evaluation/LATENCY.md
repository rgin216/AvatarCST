# Automated latency evaluation

For the deployed backend and browser speech playback, see [deployed latency collection](DEPLOYED-LATENCY.md).

This benchmark measures adaptive acknowledgement text generation through the application's real LLM adapter and prompt builder. It uses synthetic fixtures, no database or participant sessions, and no critic calls. The default is a dry run; only `--live` contacts providers. Live runs incur API usage.

From `backend`:

```powershell
# Validate the plan without API calls
npm run eval:latency -- --limit 2 --repeats 3
# Small connectivity pilot: 3 warmups + 9 measured generations
npm run eval:latency -- --live --limit 1 --repeats 3
# Main collection: 3 warmups + 900 measured generations
npm run eval:latency -- --live --repeats 10 --warmups 1 --delay-ms 1000 --label "local-wifi-run-1"
```

Keys are loaded from `backend/.env`; all roster credentials are checked before calls. Defaults use `evaluation/models.json` and all 30 fixtures in `evaluation/scenarios.json`. Options: `--models path.json`, `--scenarios path.json`, `--limit N`, `--repeats N` (1–1000), `--warmups N` (0–100 per model), `--delay-ms N` (0–60000), `--label text`, `--out directory`. Relative paths resolve from your shell's working directory. Models and fixtures use the existing LLM evaluation formats; at least two distinct models are required.

## Timing and experiment design

The measured interval uses Node's monotonic `performance.now()` around `generateResponse`: request preparation inside the adapter, network, provider processing, full response body, text cleanup and any internal adapter retry. It excludes prompt building, pacing delays and export writes. This is client completion latency, not time to first token or provider inference time. Character/word counts describe returned text; they are not token counts or throughput estimates.

Warmups exercise the first fixture for each model and remain in raw data, excluded from measurement summaries and paired comparisons. They do not establish that the remote provider is warm or control caching. Requests run sequentially. Model order rotates by scenario and repeat to distribute order effects. The same prepared prompt goes to every model in a scenario; prompt hashes are saved. Rotations are deterministic, not randomised. Use repetition counts divisible by roster size for balanced per-scenario positions.

Failures, timeouts and empty completions are retained. No benchmark-level retries or provider substitution are performed. Existing adapters may retry truncated generations; that time is included, but attempt counts within the adapter are not recorded. Pacing is fixed and is not adaptive rate-limit recovery. A failed request does not become a zero latency. A checkpoint write failure stops collection.

## Research exports

Each live run creates a unique ignored `evaluation/results/TIMESTAMP-latency-ID/` directory:

- `manifest.json`: run label, UTC times, revision, working-tree status, runtime/hardware, roster, fixture snapshot/hash, combined benchmark/LLM/prompt/Anthropic source hash and requested generation settings. No credentials are exported. Absence of `completedAt` means collection did not finish.
- `rows.jsonl`: checkpoint after every call, including warmups, failures, timestamps, request order and output. Interruption preserves completed rows; the in-flight attempt may be missing.
- `report.json`: exact prepared prompts, raw rows, overall and per-scenario statistics and paired comparisons.
- `samples.csv`: one row per attempt; filter `phase=measurement` and `status=ok` for successful timings. Error text and failed durations remain available for failure analysis.
- `summary.csv`: model and model/scenario success distributions plus total attempts and failure rates. `scenarioId=ALL` is the aggregate row.
- `paired-comparisons.csv`: successful matched scenario/repeat pairs. `deltaMs = modelA - modelB`; negative means A completed faster. JSON comparisons also give excluded block counts.

CSV cells are quoted; potentially executable string formulas are prefixed with an apostrophe for spreadsheet safety. JSON preserves original strings. CSV uses unrounded milliseconds. Summaries include count, mean, sample standard deviation (n−1), min/max and p50/p90/p95/p99 using linear interpolation at `(n−1) × p`. Empty statistics are null/blank; singleton standard deviation is null. Failures have separate duration distributions in JSON and never enter successful percentiles. Warmup failures also cause a nonzero exit after all outputs are saved.

## Collection and report protocol

1. Run a small pilot, inspect outputs and resolve credential/rate-limit problems before selecting the main protocol. Freeze the roster, fixtures, settings and code revision; retain source changes when the manifest reports a dirty working tree.
2. Choose repetition counts, pacing and collection conditions before the main run. Record network type, client location, deployment/provider region if known, dates and competing traffic in the run label or study notes. Collect independent runs at multiple times to inspect infrastructure variability; preserve each run separately.
3. Report attempted/successful/failed calls per model and scenario, including warmup failures. Present successful mean, median and p95 with sample counts and a separate failure-rate table. Small-sample tail percentiles are unstable; p99 from a handful of calls is not evidence of a reliable tail estimate.
4. Use paired deltas to compare identical scenario/repeat blocks. State how many pairs were excluded for failures. Inspect per-scenario distributions and request order rather than ranking solely on a pooled mean. Rows from repeated scenarios and one run are dependent; do not treat them as independent participants or infer significance from the summary. Confidence intervals and hypothesis tests are not implemented.
5. Record effective adapter settings from the saved revision: Groq GPT-OSS can raise the requested 256-token budget to 512 and uses low reasoning; Qwen uses its adapter's no-reasoning setting; OpenAI and Anthropic have different sampling controls. The manifest records requested options, not proof that providers applied identical settings. Pair latency with separately collected quality evaluation before arguing that a faster model is preferable.

Suggested methods wording (replace brackets with observed values):

> We measured client-observed completion latency for synthetic CST adaptive acknowledgement requests using AvatarCST revision [revision]. Each of [models] received the same [scenarios] prepared prompts across [repeats] repetitions. We excluded [warmups] warmup calls per model, rotated request order, and applied [delay] ms pacing outside the timed interval. Timing included network, provider processing and adapter retries. We report successful latency distributions and failure rates separately; comparisons use complete scenario/repetition pairs.

## Scope and next implementation chunks

This component benchmark does not measure microphone capture, STT, orchestration/database work, TTS, Rhubarb, browser audio onset or avatar rendering. It cannot support a claim of end-to-end conversational latency or therapeutic benefit. No live dataset is supplied by automated unit tests.

Next substantial chunks: instrument server voice stages with a common turn ID; add browser capture-stop/request/audio-onset timing; then automate synthetic audio/session runs and join stage records into end-to-end exports. Keep browser and server clock domains separate, and use durations or request correlation rather than subtracting unrelated clock timestamps.
