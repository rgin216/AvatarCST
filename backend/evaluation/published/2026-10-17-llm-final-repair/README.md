# Evaluation collection — 2026-10-17

Completed LLM plan: 30 scenarios × 5 models × 1 repetition(s). 0 generation failures; 0 failed critiques.

Models: gpt-oss-120b, gpt-oss-20b, qwen-3.8-27b, claude-sonnet-5, claude-haiku-5.5. Read [evaluation.md](evaluation.md) for scores separated by critic and generation latency.

- `llm/`: manifest, raw responses/critiques, checkpoints, disagreements, and anonymous human-review sheet.
- `judge-scores.csv` and `failures.csv`: derived score and failure tables.
- No separate text-only latency benchmark was collected; generation times above come from the quality run.

All inputs are synthetic. Cache/prefetch effects remain enabled in the deployed pilot. Service durations can overlap; API completion excludes microphone capture and browser playback/rendering onset. Missing service timings on cached paths are excluded, not zero-filled.

The manifest records HEAD; older runs do not capture working-tree status or source hashes, so HEAD alone does not identify the exact evaluated source. Saved prompts document the evaluated configuration. Deployed build revision was not independently verified. Automated scores require independent human calibration; these results do not establish clinical effectiveness. Keep disagreements and model scores hidden from reviewers until they score `llm/human-review.json`.

This collection was exported offline with `scripts/publish-evaluation.js`; export made no API calls. `checksums.json` hashes the portable exported artifacts. Runtime originals remain under ignored `evaluation/results/`.

## Linked final repair pass

Actual completion: 150/150 successful responses and 600/600 valid critiques. All gaps filled: true. This is a derived view using successful linked retry attempts; it is not a single uninterrupted run. Previous successes are preserved, and original failures, prior credential changes and earlier raw attempts remain available in attempt-history/. The exact original prompts and options were reused; up to three non-quota failures per gap and provider-directed quota waits were allowed. Every new attempt is retained in repair-attempts.jsonl. No scores were imputed. Human calibration remains outstanding.

## Consolidated final collection

Collection began on 17 October and finished at 12:37 am on 18 October 2026 (Pacific/Auckland). Superseded intermediate report folders were removed. Original failed/skipped attempts and credential/protocol changes are retained in [attempt-history/index.json](attempt-history/index.json), the linked base report, and repair logs. The 150 successful responses and 600 valid critiques reflect successful retries; they do not imply a failure-free first pass. Earlier completed latency runs remain separately available for comparison.
