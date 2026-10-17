# All production latency runs
All measurements are retained. This repeat ran after the LLM continuation and Qwen retry workflow terminated. It uses the same synthetic fixtures, two avatars, fresh sessions, repetitions and default production cache/prefetch behavior. It does not prove another run incorrect; time, cache and uncontrolled production conditions can change latency.
| Run | n | Mean (s) | Median (s) | P95 (s) | Cache-hit segments |
| --- | --- | --- | --- | --- | --- |
| 15 October | 18 | 3.56 | 4.41 | 6.70 | 20 |
| 17 October first run | 18 | 5.68 | 4.34 | 12.85 | 16 |
| Repeat after LLM | 18 | 3.32 | 3.95 | 7.04 | 20 |

## Repetition means (seconds)

| Run | First six turns | Second six turns | Third six turns |
| --- | --- | --- | --- |
| 15 October | 4.02 | 3.57 | 3.08 |
| 17 October first run | 11.13 | 3.07 | 2.85 |
| Repeat after LLM | 3.88 | 3.12 | 2.96 |

Warmups and inter-turn delays are excluded. API completion is not browser playback onset. All runs are small descriptive pilots; no best-run-only selection, controlled-host-load claim or deployed-code regression claim is made.
