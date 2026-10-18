# Production speech pipeline latency — repeat after LLM collection

Live measurements against the university-hosted AvatarCST backend through its public Cloudflare tunnel. All 18 measured audio turns and six warmup turns succeeded; returned audio files were downloaded and nonempty, with Rhubarb mouth cues present for every returned segment.

## Measured latency

Times are seconds. Warmups and inter-turn pacing are excluded. P95 uses linear interpolation; nine measurements per avatar make tail estimates descriptive.

| Avatar | n | API mean | API median | API P95 | Mean through audio download | P95 through audio download |
| --- | --- | --- | --- | --- | --- | --- |
| all | 18 | 3.32 | 3.95 | 7.04 | 3.77 | 7.71 |
| female | 9 | 3.60 | 4.60 | 6.81 | 4.04 | 7.48 |
| male | 9 | 3.04 | 3.91 | 6.32 | 3.49 | 6.98 |

API completion measures uploaded WAV request start through parsed response JSON. The audio-download measure adds subsequent sequential downloads of every returned audio segment. It does not measure first audible playback.

## Server stages

Measured turns only, pooled across avatars. n counts observed durations; omitted service durations are not zero-filled. Cache/prefetch is enabled. Orchestration includes database and any LLM work; it is not a standalone LLM inference timer. Parallel TTS/Rhubarb durations must not be summed into wall time.

| Stage | n | Mean (s) | Median (s) | P95 (s) |
| --- | --- | --- | --- | --- |
| sttMs | 18 | 0.48 | 0.20 | 0.98 |
| orchestratorMs | 18 | 1.01 | 1.08 | 2.37 |
| audioMs | 18 | 1.66 | 2.17 | 3.63 |
| ttsMs | 10 | 1.48 | 1.45 | 2.10 |
| rhubarbMs | 10 | 1.51 | 1.56 | 1.81 |
| totalMs | 18 | 3.16 | 3.79 | 6.88 |

## Protocol and provenance

- Pipeline: `openai-fast-scripted`; public pipeline endpoint reported OpenAI transcription, Responses API, OpenAI TTS and Rhubarb for avatars. Provider model IDs are not exposed by this endpoint and are not asserted.

- Six independent synthetic users/sessions: three female and three male. Each receives one text warmup then the same three WAV fixtures, advancing normal Session 1 state. Avatar order alternates between repetitions; turns run sequentially with a two-second delay.

- Fixture provenance and timing samples are retained in the manifest and CSV tables. Full raw responses, transcripts and delivery evidence were validated and archived locally before removal from the PR. Cached and prefetched production paths remain enabled.

- The local collector revision, source hashes and client runtime are in `manifest.json`. The deployed commit was not independently verified; the healthy endpoint and reported pipeline are operational evidence, not build provenance.

- This is a production audio pipeline benchmark, not a full therapy-session replay, concurrency test, or browser playback-onset study. It excludes microphone recording/finalization, browser decoding/playback, acoustic onset and avatar-render onset. Three repetitions per avatar are a pilot, not a robust capacity or tail-latency study.

## Reproduce and validate

From `backend`, create a target JSON containing the current public API base in its `api` field, then run:

```sh
node scripts/collect-deployed-voice-latency.js TARGET_JSON NEW_OUTPUT_DIRECTORY
node --test src/evaluation/deployedLatency.test.js src/evaluation/latency.test.js
```

Live collection creates synthetic records and incurs provider usage. Never use participant sessions. The offline export verified all 24 checkpoints against the completed report, fixture hashes, audio/lip-sync delivery, secret scanning and artifact SHA-256 checksums. Eleven relevant timing tests passed.

No LLM quality-evaluation results are included in this collection.

See [all-runs comparison](all-runs-comparison.md), including earlier slower results and repetition-level means.

Large raw JSON/JSONL and redundant statistics were archived under the ignored local evaluation/results directory. This PR retains the summary, manifest, per-turn timing samples and stage-statistics CSV. All recorded slow trials remain included.
