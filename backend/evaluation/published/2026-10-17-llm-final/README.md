# Evaluation collection — 2026-10-17

Completed LLM plan: 30 scenarios × 5 models × 1 repetition(s). 23 generation failures; 129 failed critiques.

Models: gpt-oss-120b, gpt-oss-20b, qwen-3.8-27b, claude-sonnet-5, claude-haiku-5.5. Read [evaluation.md](evaluation.md) for scores separated by critic and generation latency.

- `llm/`: manifest, raw responses/critiques, checkpoints, disagreements, and anonymous human-review sheet.
- `judge-scores.csv` and `failures.csv`: derived score and failure tables.
- No separate text-only latency benchmark was collected; generation times above come from the quality run.

All inputs are synthetic. Cache/prefetch effects remain enabled in the deployed pilot. Service durations can overlap; API completion excludes microphone capture and browser playback/rendering onset. Missing service timings on cached paths are excluded, not zero-filled.

The manifest records HEAD; older runs do not capture working-tree status or source hashes, so HEAD alone does not identify the exact evaluated source. Saved prompts document the evaluated configuration. Deployed build revision was not independently verified. Automated scores require independent human calibration; these results do not establish clinical effectiveness. Keep disagreements and model scores hidden from reviewers until they score `llm/human-review.json`.

This collection was exported offline with `scripts/publish-evaluation.js`; export made no API calls. `checksums.json` hashes the portable exported artifacts. Runtime originals remain under ignored `evaluation/results/`.

## Completion and deliberate skips

All 150 planned entries have now been processed; there are no unfinished entries. This does not mean every call succeeded. 6 generations failed, 17 Qwen generations were deliberately skipped, 64 critiques failed, and 65 Qwen critiques were deliberately skipped. The generic error totals above include skips; these separate counts distinguish them. Earlier recorded failures were preserved and not retried by this continuation. Qwen remained disabled at user request. Missing/failed/skipped calls have no numeric score.

The earlier [132-entry checkpoint](../2026-10-17-llm-checkpoint/README.md) remains a separately dated snapshot of the interrupted collection. The final report retains the Qwen protocol amendment; quota-event coverage applies only to the last resumed segment.
