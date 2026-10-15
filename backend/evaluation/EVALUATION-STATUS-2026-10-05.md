# Evaluation status — 5 October 2026 (NZ time)

## Scope
The requested primary latency experiment is the deployed voice/avatar pipeline. Three Groq candidates are configured: GPT-OSS 120B, GPT-OSS 20B and Qwen 3.8 27B. Claude is excluded.

## Collected evidence
- Connectivity pilot: `results/2026-10-05T00-35-23-912Z-63ff6986/report.json`. All three generations succeeded; four of six critiques validated. Two critiques failed the critical-failure schema. This is connectivity evidence only.
- Rotation attempt: `results/2026-10-05T00-37-35-669Z-90aaa442/report.json`. Of 90 planned generations, 5 succeeded and 85 failed. Only one critique validated. Groq HTTP 429 token-per-minute errors dominate this attempt. This is an unusable quality comparison.
- Interrupted component latency attempt: `results/latency-2026-10-05T00-37-06-072Z-7b893df1/rows.jsonl`. Raw completed calls are preserved. This overlapped the rotation run and encountered quota failures; do not report these as a controlled latency benchmark.

Do not use the rotation report's meanGenerationLatencyMs as successful-response latency: its implementation includes failed calls. Fast quota rejections are not fast model responses.

## Deployment access
SSH to the documented university server timed out. The active deployment revision and public tunnel URL could not be verified. Local frontend configuration points to localhost. The current deployed URL is needed before production pipeline measurements can begin.

## Planned deployed latency protocol
1. Record deployed revision, health, pipeline configuration, avatar/lip-sync settings, client location and browser version. Use a dedicated synthetic user and synthetic Session 1 input.
2. Use the same recorded audio samples and scripted answers for each tested avatar configuration. Record audio duration and answer content. Separate warm-up and measured turns, and distinguish acknowledgement turns from scripted-only turns.
3. Record server STT, orchestration, TTS, lip-sync and total timings where available. Inspect how timing fields aggregate across audio segments before interpreting them.
4. Measure browser upload start to response arrival and to first audible playback. Separately capture end-of-input to audible playback if microphone/recording interaction is included. Backend totalMs alone is not perceived latency.
5. Require returned audio and expected lip-sync data for successful trials. Preserve transcription errors, missing audio, fallbacks and HTTP failures separately even when the endpoint returns success.
6. Run trials sequentially. Summarize successful trials with sample counts, median, mean, p95 and range; report failures separately. Preserve raw rows and distinguish warm-up, activity, avatar and pipeline groups.

## Next model experiment
Run latency and critic experiments separately with pacing. The added `scripts/evaluate-latency.js` defaults to a dry run; `--live` enables calls, defaults to a 25-second gap and stops on the first quota error while saving completed results. This delay is a starting setting, not a guarantee of account capacity. Its dry run was verified.

The existing rotation runner needs quota-aware pacing before a full rerun. Retain malformed critic output without converting it to scores. Keep judge panels separate and independently review an anonymous sample before reporting model-quality claims. The component benchmark does not measure full-session progression or therapeutic effectiveness.

## Paced verification
The runner now defaults to 61 seconds between requests to each provider/model, shared across facilitator and critic roles, with at most two HTTP 429 retries. Retry timing respects a longer provider message. Quota events and request policy are recorded. Ordinary pre-call waits are excluded from latency; retry waits are included. The component latency runner uses the same spacing without quota retries and stops on a quota failure.

A one-scenario live verification is saved in `results/2026-10-05T02-35-57-914Z-1087a79f/report.json`: all three generations succeeded, no quota events were recorded, and four of six critiques validated. Two critiques still failed validation; slower requests do not resolve malformed critic output. All 28 evaluation tests passed. This establishes pacing connectivity only, not a comparative benchmark. The earlier unpaced attempts remain unusable for comparative conclusions.

## PR integration — 6 October 2026
These notes describe the 5 October local experiments, not the current deployment state. When preparing the PR, main already contained a newer latency runner with warmups, repeated trials and CSV exports. That runner is preserved. The earlier local latency script is retained only as an ignored historical backup under results/. This PR applies quota-aware pacing to the facilitator/critic runner; it does not replace or change main's latency runner. All 38 evaluation tests and the facilitator/critic CLI dry run passed on current main.
