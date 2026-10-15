# Evaluation collection — 2026-10-15

Completed LLM plan: 30 scenarios × 3 models × 1 repetition(s). 0 generation failures; 0 failed critiques.

Models: gpt-oss-120b, gpt-oss-20b, qwen-3.8-27b. Read [evaluation.md](evaluation.md) for scores separated by critic and generation latency.

- `llm/`: manifest, raw responses/critiques, checkpoints, disagreements, and anonymous human-review sheet.
- `judge-scores.csv` and `failures.csv`: derived score and failure tables.
- [Deployed speech latency](deployed-voice-evaluation.md): 18 measured turns and 6 warmups. Complete: true. Raw JSON/JSONL and CSV included.
- No separate text-only latency benchmark was collected; generation times above come from the quality run.

All inputs are synthetic. Cache/prefetch effects remain enabled in the deployed pilot. Service durations can overlap; API completion excludes microphone capture and browser playback/rendering onset. Missing service timings on cached paths are excluded, not zero-filled.

The manifest records HEAD; older runs do not capture working-tree status or source hashes, so HEAD alone does not identify the exact evaluated source. Saved prompts document the evaluated configuration. Deployed build revision was not independently verified. Automated scores require independent human calibration; these results do not establish clinical effectiveness. Keep disagreements and model scores hidden from reviewers until they score `llm/human-review.json`.

This collection was exported offline with `scripts/publish-evaluation.js`; export made no API calls. `checksums.json` hashes the portable exported artifacts. Runtime originals remain under ignored `evaluation/results/`.
