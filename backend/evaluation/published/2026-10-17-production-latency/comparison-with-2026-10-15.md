# Comparison with the 15 October production latency pilot

The earlier run had a lower overall mean and P95. Both runs saved 18 successful measured turns plus six successful warmups, using the same three WAV fixtures, two avatars, three repetitions per avatar, the OpenAI fast scripted pipeline, Rhubarb and enabled cache/prefetch. Warmups are excluded below.

| API completion metric | 15 October | 17 October |
| --- | --- | --- |
| Measured turns | 18 | 18 |
| Mean (s) | 3.56 | 5.68 |
| Median (s) | 4.41 | 4.34 |
| P95 (s) | 6.70 | 12.85 |
| Maximum (s) | 7.61 | 14.04 |
| Cache-hit segments | 20 | 16 |

The mean increased by 2.13 seconds (59.8%). The median decreased slightly. A slower first repetition dominates the new mean and upper tail; all rows remain included in the primary result.

## Variation across repetitions

| Repetition (six measured turns each) | 15 October mean (s) | 17 October mean (s) |
| --- | --- | --- |
| 1 | 4.02 | 11.13 |
| 2 | 3.57 | 3.07 |
| 3 | 3.08 | 2.85 |

Later repetitions in the new run were faster than their earlier-run counterparts, but this is descriptive evidence and does not justify discarding the first repetition or claiming a general speedup.

## Recorded server stage means

Values are seconds, followed by observed sample counts. These stages overlap and must not be added together. Missing cached-path durations are not zero-filled.

| Stage | 15 October | 17 October |
| --- | --- | --- |
| sttMs | 0.78 (n=18) | 0.37 (n=18) |
| orchestratorMs | 0.94 (n=18) | 0.79 (n=18) |
| audioMs | 1.72 (n=18) | 4.34 (n=18) |
| ttsMs | 1.57 (n=10) | 1.34 (n=14) |
| rhubarbMs | 1.52 (n=10) | 2.81 (n=14) |

The new run recorded greater audio-wait time and two long Rhubarb durations (10.26 s and 12.10 s). Transcription and orchestration means were lower. It also reported fewer cache-hit segments. These observations locate delays in the recorded speech path; they do not establish a cause such as host contention, a provider change or a software regression.

The public pipeline responses differ: 15 October advertised both free and OpenAI modes; 17 October advertised only the OpenAI mode and `transcriptsAvailable: false`. Both collectors explicitly selected `openai-fast-scripted`, and transcripts were returned for the measured audio turns. Neither collection independently verified the deployed commit or exact provider model IDs.

The tests ran at different times without controlled host load, provider conditions or a reset speech cache. With only 18 measured turns each, report this as observed run-to-run variability rather than proof that production became slower. Browser playback/acoustic onset was not measured in either run.

Sources: [15 October raw evidence](../2026-10-15/deployed-summary.json) and [17 October raw evidence](deployed-summary.json). No LLM quality scores are pooled into this latency comparison.
