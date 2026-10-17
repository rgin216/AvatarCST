# Evaluation collection — 2026-10-17

Completed LLM plan: 30 scenarios × 5 models × 1 repetition(s). 2 generation failures; 25 failed critiques.

Models: gpt-oss-120b, gpt-oss-20b, qwen-3.8-27b, claude-sonnet-5, claude-haiku-5.5. Read [evaluation.md](evaluation.md) for scores separated by critic and generation latency.

- `llm/`: manifest, raw responses/critiques, checkpoints, disagreements, and anonymous human-review sheet.
- `judge-scores.csv` and `failures.csv`: derived score and failure tables.
- No separate text-only latency benchmark was collected; generation times above come from the quality run.

All inputs are synthetic. Cache/prefetch effects remain enabled in the deployed pilot. Service durations can overlap; API completion excludes microphone capture and browser playback/rendering onset. Missing service timings on cached paths are excluded, not zero-filled.

The manifest records HEAD; older runs do not capture working-tree status or source hashes, so HEAD alone does not identify the exact evaluated source. Saved prompts document the evaluated configuration. Deployed build revision was not independently verified. Automated scores require independent human calibration; these results do not establish clinical effectiveness. Keep disagreements and model scores hidden from reviewers until they score `llm/human-review.json`.

This collection was exported offline with `scripts/publish-evaluation.js`; export made no API calls. `checksums.json` hashes the portable exported artifacts. Runtime originals remain under ignored `evaluation/results/`.

## Linked GPT-OSS 20B retry pass

This is a derived view of the original 150-entry evaluation plus a later GPT-OSS 20B-only repair pass. This pass uses the current Groq account, as in the preceding Qwen retry; no credential is exported. 43/43 planned GPT-OSS 20B retry blocks were processed and 43 returned successful outputs. Quota stop: false. Existing successful results were retained; only successful GPT-OSS 20B replacements enter the combined view. Successful new GPT-OSS 20B generations receive new independent critic panels; Qwen critiques remain explicitly unavailable after its earlier quota stop. Original attempts remain in base-report.json, with linked new attempts in retry-attempts.jsonl. Earlier failures/skips and differing collection times are preserved, not erased.

The plan-completion statement above refers to the combined 150-row structure; it is not proof that every API call succeeded or every retry was attempted. Read report.json retryPass for exact completion, remaining failures and quota-stop details. No scores are imputed.
