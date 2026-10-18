# Application-model LLM evaluation

**150 successful responses and 600 valid critiques**, covering 30 synthetic Session 1 scenarios. GPT-OSS 20B was replaced with **gpt-5.4-mini**, the application-configured OpenAI text model. The other models remain Sonnet 5, Haiku 5.5, GPT-OSS 120B and Qwen 3.8 27B.

## Results by independent judge

Each cell is the mean across seven criteria and 30 responses, scored 1–5. Models never judge themselves. Different judge panels and shared model families preclude treating pooled means as an unqualified ranking.

| Facilitator / judge | gpt-oss-120b | gpt-5.4-mini | qwen-3.8-27b | claude-sonnet-5 | claude-haiku-5.5 |
| --- | --- | --- | --- | --- | --- |
| gpt-oss-120b | — | 4.59 | 4.90 | 4.17 | 4.14 |
| gpt-5.4-mini | 4.99 | — | 5.00 | 4.44 | 4.14 |
| qwen-3.8-27b | 4.85 | 4.46 | — | 4.22 | 4.07 |
| claude-sonnet-5 | 4.91 | 4.53 | 4.86 | — | 4.10 |
| claude-haiku-5.5 | 4.56 | 4.22 | 4.68 | 3.88 | — |

## Contract checks and critic flags

| Model | Responses | Word-limit/question failures | Responses flagged by any critic |
| --- | --- | --- | --- |
| gpt-oss-120b | 30 | 0 | 8 |
| gpt-5.4-mini | 30 | 0 | 3 |
| qwen-3.8-27b | 30 | 0 | 4 |
| claude-sonnet-5 | 30 | 1 | 1 |
| claude-haiku-5.5 | 30 | 3 | 12 |

Local checks cover at most 25 words and no question marks. Flags are unverified automated judgments, not established safety failures. Human calibration remains outstanding.

## Reuse and new collection

- Reused 120 saved responses from the retained four models and their 360 mutual critiques verbatim. Removed every GPT-OSS 20B response and judgment from this comparison.

- Collected 30 new mini responses, 120 independent critiques of mini by the other four models, and 120 mini critiques of retained responses: 270 planned new calls before retries.

- Used the exact saved scenario prompts and critic prompt, explicit model IDs and the application provider adapters. New Groq calls use the user-supplied organization key; historical reused evidence spans earlier time windows/account changes. This is a linked reused-data study, not a synchronized full rerun.

- Failed attempts are retained in the ignored local archive, not counted as zero or imputed. Final coverage is not first-attempt reliability. Provider sampling/reasoning and token-budget differences are in study-metadata.json.

- Only adaptive acknowledgement components are tested, not full therapy sessions or clinical efficacy. Production latency is measured separately. Compare judge-specific scores, contract violations and human-reviewed examples before choosing a model.

## Included result evidence

- responses.csv: all 150 acknowledgements, local checks and reused/new indicator.

- response-scores.csv: all 600 valid critic score vectors.

- judge-scores.csv: criterion means and counts by facilitator/judge.

- study-metadata.json and models.json: provenance, settings, roster and source/fixture hashes.

Full prompts, raw API outputs, failure/retry logs and reuse mappings remain locally under the ignored archive recorded in metadata. Bulky logs and duplicate reports are excluded from the PR.
