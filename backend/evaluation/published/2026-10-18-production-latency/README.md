# Production audio pipeline latency — 18 October 2026

**18/18 measured turns and six warmups succeeded.** Audio downloads were nonempty and every returned segment included Rhubarb cues. Collection exercised the deployed backend without changing its configuration.

## Actual STT configuration

After collection, the project owner supplied SSH output from `~/avatarcst-deploy/shared/backend.env` showing `STT_PROVIDER=groq`, `GROQ_WHISPER_MODEL=whisper-large-v3-turbo`, `OPENAI_TEXT_MODEL=gpt-5.4-mini` and an empty `OPENAI_FAST_TEXT_MODEL`. The declared deployment configuration therefore selects **Groq Whisper Large V3 Turbo for STT and GPT-5.4-mini for text**, retaining the advertised OpenAI TTS and Rhubarb path. The empty fast-text override falls back to `OPENAI_TEXT_MODEL`.

The deployed endpoint's `openai-transcribe` label is hardcoded to the base pipeline; audio handling separately honours `STT_PROVIDER`. It must not be treated as evidence that OpenAI STT was selected. The supplied configuration-file output was obtained after collection, not captured from the running process at each measured request. Per-turn fallback and the exact active deployment revision remain unverified; timings are not a controlled Groq-versus-OpenAI comparison.

This PR fixes the endpoint to report configured sttProvider, sttModel and sttFallbackProvider using the same routing helper as audio requests. That reports configuration, not the provider actually used after a per-turn fallback, and requires deployment before it can verify production configuration.

## Latency (seconds; measured turns only)

| Avatar | n | API mean | API median | API P95 | Mean through audio download | P95 through audio download |
| --- | --- | --- | --- | --- | --- | --- |
| all | 18 | 2.96 | 3.30 | 5.58 | 3.43 | 6.14 |
| female | 9 | 2.58 | 2.25 | 5.48 | 3.00 | 6.07 |
| male | 9 | 3.34 | 4.52 | 5.48 | 3.87 | 6.13 |

API completion covers uploaded WAV request through parsed response JSON. Audio-download completion adds sequential downloads of all returned audio segments. Neither measures microphone recording/finalization, browser decoding/playback, first audible output or avatar-frame onset.

## Server stages

Durations are seconds; n counts observed service timings. Missing cached-path durations are excluded, not zero-filled. Cache/prefetch remains enabled. Orchestration includes any LLM and database work; it is not isolated model inference. Parallel service durations must not be added as wall time.

| Stage | n | Mean | Median | P95 |
| --- | --- | --- | --- | --- |
| sttMs | 18 | 0.19 | 0.19 | 0.23 |
| orchestratorMs | 18 | 1.01 | 1.11 | 2.08 |
| audioMs | 18 | 1.59 | 1.23 | 3.97 |
| ttsMs | 9 | 1.70 | 1.72 | 2.13 |
| rhubarbMs | 9 | 1.48 | 1.31 | 1.93 |
| totalMs | 18 | 2.80 | 3.14 | 5.42 |

## All measured runs

| Run | n | Mean (s) | Median (s) | P95 (s) |
| --- | --- | --- | --- | --- |
| 15 October | 18 | 3.56 | 4.41 | 6.70 |
| 17 October first run | 18 | 5.68 | 4.34 | 12.85 |
| 17 October repeat | 18 | 3.32 | 3.95 | 7.04 |
| 18 October rerun | 18 | 2.96 | 3.30 | 5.58 |

All recorded turns, including slow ones, are retained. The prior runs cannot be assigned an STT provider solely from their advertised base-pipeline label either. Uncontrolled server load, cache state, provider behavior and potentially changed configuration prevent claiming these small pilots are a controlled provider comparison or a software regression test.

## Validation and evidence

Verified all 24 raw checkpoints against the completed report, six fresh sessions, the three fixture hashes, nonempty audio downloads and Rhubarb segments. Forty targeted tests passed, including STT fallback, pipeline configuration, controller reporting and latency statistics. The PR retains concise CSVs, metadata, this report and artifact checksums. Full raw evidence stays in the ignored local archive identified in manifest.json.
