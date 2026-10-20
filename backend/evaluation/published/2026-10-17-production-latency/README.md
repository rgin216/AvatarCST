# Production speech pipeline latency — 17 October 2026

Live measurements against the university-hosted AvatarCST backend through its public Cloudflare tunnel. All 18 measured audio turns and six warmup turns succeeded; returned audio files were downloaded and nonempty, with Rhubarb mouth cues present for every returned segment.

## Measured latency

Times are seconds. Warmups and inter-turn pacing are excluded. P95 uses linear interpolation; nine measurements per avatar make tail estimates descriptive.

| Avatar | n | API mean | API median | API P95 | Mean through audio download | P95 through audio download |
| --- | --- | --- | --- | --- | --- | --- |
| all | 18 | 5.68 | 4.34 | 12.85 | 6.20 | 13.22 |
| female | 9 | 5.68 | 3.91 | 12.94 | 6.18 | 13.43 |
| male | 9 | 5.68 | 4.67 | 11.90 | 6.22 | 12.57 |

API completion measures uploaded WAV request start through parsed response JSON. The audio-download measure adds subsequent sequential downloads of every returned audio segment. It does not measure first audible playback.

## Server stages

Measured turns only, pooled across avatars. n counts observed durations; omitted service durations are not zero-filled. Cache/prefetch is enabled. Orchestration includes database and any LLM work; it is not a standalone LLM inference timer. Parallel TTS/Rhubarb durations must not be summed into wall time.

| Stage | n | Mean (s) | Median (s) | P95 (s) |
| --- | --- | --- | --- | --- |
| sttMs | 18 | 0.37 | 0.20 | 0.69 |
| orchestratorMs | 18 | 0.79 | 0.92 | 1.51 |
| audioMs | 18 | 4.34 | 2.66 | 12.47 |
| ttsMs | 14 | 1.34 | 1.29 | 1.71 |
| rhubarbMs | 14 | 2.81 | 1.43 | 10.91 |
| totalMs | 18 | 5.50 | 4.11 | 12.68 |

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

## Previous-run comparison

See [comparison with 15 October](comparison-with-2026-10-15.md) for the lower previous mean/P95, repetition-level variation, cache differences and stage evidence.

Large raw JSON/JSONL and redundant statistics were archived under the ignored local evaluation/results directory. This PR retains the summary, manifest, per-turn timing samples and stage-statistics CSV. All recorded slow trials remain included.

## STT reporting correction

The historical pipeline endpoint label was derived from the base pipeline and ignored STT_PROVIDER. It does not independently establish whether this run used OpenAI transcription, a Groq Whisper override, or a fallback. See the [18 October rerun](../2026-10-18-production-latency/README.md) for the configuration-reporting fix and verification limits.
