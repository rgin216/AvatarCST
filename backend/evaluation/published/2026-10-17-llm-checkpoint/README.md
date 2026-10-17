# LLM evaluation checkpoint — 17 October 2026

**Incomplete collection: 132 of 150 planned entries saved.** There are 113 successful responses, five generation failures, 14 explicitly skipped Qwen generations and 18 unfinished entries. Successful responses have 354 valid critiques, 47 failed critiques and 51 explicitly skipped Qwen critiques. Failed/skipped calls have no numeric score.

The collection stopped when work switched to production latency and automatic LLM publication was cancelled. This export preserves the actual checkpoint; it does not claim the full experiment completed.

## Completion by facilitator

| Model | Successful responses | Generation failures | Skipped generations | Unfinished | Valid critiques | Failed critiques | Skipped critiques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-oss-120b | 26 | 0 | 0 | 4 | 77 | 13 | 14 |
| gpt-oss-20b | 23 | 4 | 0 | 3 | 77 | 4 | 11 |
| qwen-3.8-27b | 12 | 1 | 14 | 3 | 48 | 0 | 0 |
| claude-sonnet-5 | 26 | 0 | 0 | 4 | 76 | 15 | 13 |
| claude-haiku-5.5 | 26 | 0 | 0 | 4 | 76 | 15 | 13 |

## Scores separated by judge

Each cell is the mean across the seven rubric criteria for valid critiques only, followed by the number of critiques in parentheses. Scores range from 1 to 5. Models never judge themselves. Unequal scenarios/panels and same-family preferences prevent interpreting this table as a final ranking; no unqualified pooled ranking is reported.

| Facilitator / judge | gpt-oss-120b | gpt-oss-20b | qwen-3.8-27b | claude-sonnet-5 | claude-haiku-5.5 |
| --- | --- | --- | --- | --- | --- |
| gpt-oss-120b | — | 5.00 (n=16) | 4.86 (n=9) | 4.24 (n=26) | 4.15 (n=26) |
| gpt-oss-20b | 4.82 (n=23) | — | 4.93 (n=8) | 4.19 (n=23) | 4.06 (n=23) |
| qwen-3.8-27b | 4.86 (n=12) | 5.00 (n=12) | — | 4.30 (n=12) | 4.07 (n=12) |
| claude-sonnet-5 | 4.90 (n=26) | 4.95 (n=16) | 5.00 (n=8) | — | 4.13 (n=26) |
| claude-haiku-5.5 | 4.61 (n=24) | 4.76 (n=18) | 4.46 (n=8) | 3.90 (n=26) | — |

## Protocol and limitations

- Thirty synthetic Session 1 scenarios, one repetition, five facilitators and four independent critics per successful response. Rubric, exact prompts, raw critiques and source/fixture hashes are preserved.

- Qwen calls were disabled by user request after daily token quota failures. Completed Qwen evidence remains unchanged. Later calls are explicitly marked `SKIPPED_BY_USER`; no requests were made and no scores were assigned.

- GPT-OSS quota failures also occurred. Skips and failed calls are counted separately. Missing results are not zero scores. Response/critic samples differ and are incomplete; automated scores require independent human calibration.

- The resumed collector reused 63 checkpoint rows, retaining their IDs and content. Only the unsaved in-flight row could be repeated. The source manifest describes the initial collection; `qwen-stop.json` records the mid-run protocol change.

- `report.json` is an offline reconstruction explicitly marked `complete: false`; `unfinished.json` lists each missing scenario/model pair. This partial collection cannot pass the complete-plan exporter and is exported separately.

- The older 15 October collection remains separately dated. It used a different critic prompt and is not pooled into this checkpoint.

## Evidence and validation

The export verifies unique planned scenario/model/repetition pairs, fixture content/hash, prompt hashes, expected critic identities, and each valid critique against its saved raw JSON. Configured credentials are scanned and local checkout paths removed. `checksums.json` covers every exported artifact. No API calls were made during export.
