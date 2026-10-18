# Five-model LLM evaluation results

**150 successful responses and 600 valid critiques** across 30 synthetic Session 1 scenarios. Each model generated 30 adaptive acknowledgements; the other four models independently scored every response against seven criteria from 1 to 5. Models never judged themselves.

## Scores by judge

Each cell averages all seven criteria across 30 responses. Different judge panels and shared model families prevent an unqualified pooled ranking.

| Facilitator / judge | gpt-oss-120b | gpt-oss-20b | qwen-3.8-27b | claude-sonnet-5 | claude-haiku-5.5 |
| --- | --- | --- | --- | --- | --- |
| gpt-oss-120b | — | 5.00 | 4.90 | 4.17 | 4.14 |
| gpt-oss-20b | 4.85 | — | 4.86 | 4.14 | 4.07 |
| qwen-3.8-27b | 4.85 | 4.96 | — | 4.22 | 4.07 |
| claude-sonnet-5 | 4.91 | 4.97 | 4.86 | — | 4.10 |
| claude-haiku-5.5 | 4.56 | 4.81 | 4.68 | 3.88 | — |

## Local checks and critic flags

| Model | Responses | Word-limit/question failures | Responses flagged by any critic |
| --- | --- | --- | --- |
| gpt-oss-120b | 30 | 0 | 8 |
| gpt-oss-20b | 30 | 1 | 5 |
| qwen-3.8-27b | 30 | 0 | 4 |
| claude-sonnet-5 | 30 | 1 | 2 |
| claude-haiku-5.5 | 30 | 3 | 11 |

Local checks test a maximum of 25 words and no question marks. Critic flags are automated opinions, not verified safety failures. Sonnet had the fewest flagged responses (2/30), while Haiku had the most (11/30) and the most local-check violations (3/30). GPT-OSS 120B and Qwen had no local-check violations. Judges were systematically more or less generous; these results do not establish a single best model.

## Collection and limitations

- Final coverage is 150/150 responses and 600/600 valid critiques after actual retries. This does not mean 100% first-attempt reliability. Quota failures, malformed critic JSON and deliberate Qwen pauses occurred; successful later attempts filled the gaps.

- Exact prompts/model settings were retained across retry passes. Collection spans multiple times and Groq organizations, which limits controlled performance comparisons. All raw original attempts and retry provenance remain in the ignored local archive identified in study-metadata.json.

- Criteria: script adherence, relevance, accessibility, respect, grounding, handling difficulty and continuity. Human calibration has not been completed. These synthetic component tests do not establish therapeutic effectiveness or full-session behavior.

- The app is configured to use gpt-5.4-mini on the OpenAI pipeline. That model was not evaluated here. GPT-OSS 120B and 20B are Groq-hosted candidates, not proof of the deployed text-model configuration.

## Included evidence

- judge-scores.csv: criterion means and sample counts for every facilitator/judge pair.

- response-scores.csv: all 600 valid critic score vectors; no raw prompt/output log duplication.

- responses.csv: all 150 acknowledgements with local checks, critic-flag indicator and response latency.

- study-metadata.json: model roster, rubric, settings, source hashes, retry/account provenance and local raw archive reference.

Large raw API logs, duplicate reports, blinded review exports and disagreement dumps are intentionally excluded from this PR. They were archived locally before removal. The scores represent final selected successful attempts; initial operational reliability must not be inferred from the final coverage.

Latency is reported separately in the production pipeline collections. No first-attempt reliability percentage or end-user playback-onset claim is made.
