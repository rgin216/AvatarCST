# Full-session evaluation and live rotation

The application can pin one facilitator for a complete session, then ask each remaining model to critique the final text and progression independently. The default roster uses three Groq models and requires no Anthropic key. The existing Claude adapter remains optional for offline runs with a configured key and roster.

## Live application

Set `LLM_EVALUATION_ENABLED=true` alongside `GROQ_API_KEY` in `backend/.env`, then restart the backend. On the landing page, expand **Research evaluation** and choose **Rotate** or a specific facilitator before starting a session. Off preserves ordinary sessions. Rotation advances per user across the roster; a session keeps its original assignment through refreshes. The other models become critics. The live session shows the selected facilitator.

Ending a session queues background critiques. The completion page polls for results and shows each critic's scores, evidence and critical flags, plus failed calls, recorded fallbacks and forced progression. Early-ended sessions are explicitly incomplete. Failed reviews can be retried. Assignments and evaluation progression cannot be overwritten through the generic session update endpoint; development slide skipping is disabled for evaluated sessions.

The worker checks every five seconds. Jobs and transcripts survive restarts; abandoned running jobs have a ten-minute lease and at most three claim attempts. Active workers renew their lease every 30 seconds during long reviews. A restart can repeat a provider request whose result was not saved. Missing captures or a mismatch with persisted assistant messages fail the review instead of scoring a partial transcript. Ending a session waits for any in-flight text turn to finish capture.

Evaluation stores participant input, final assistant text, selected memory, progression, model-call provenance and critic evidence in MongoDB. Opt-in sends this evidence to the configured critics. The UI feature stays disabled by default in `.env.example`.

## Synthetic replay

From `backend`, preview the run without API calls:

```powershell
npm run eval:sessions
```

Configure `EVAL_MONGO_URI` for a MongoDB instance where synthetic databases may be created. This command never reads `MONGO_URI`: each run creates and retains a uniquely named `avatarcst_eval_...` database, with separate users, sessions and memories.

```powershell
$env:EVAL_MONGO_URI = 'mongodb://127.0.0.1:27017'
npm run eval:sessions -- --live --scenario introduction-engaged --facilitator gpt-oss-120b
```

Omit the scenario and facilitator filters to replay both supplied Session 1 personas with every model. The real orchestrator handles answers, follow-ups, progression, memory and fallback behavior. A 50-turn bound prevents endless sessions; reaching the bound is a failed, incomplete run. `--max-turns` accepts 1–200. `--delay-ms` defaults to 25000 between facilitator requests to reduce free-tier rate limits; it accepts 0–60000 and does not guarantee quota availability. Live UI sessions do not use this artificial replay delay.

Each ignored `evaluation/results/sessions-.../` directory contains a manifest with revision/configuration, checkpointed `turns.jsonl`, and `report.json` with full evidence and separate critic results. Failures remain explicit and cause a nonzero CLI exit. Critic identities and scores remain separate because different facilitators have different judge panels. There is no automatic resume.

## Interpretation and verification

The seven criteria assess script adherence, relevance, accessibility, respect, grounding, handling difficulty and continuity. Critics receive final text and session context without facilitator identity or raw generation output. Each critic must return valid scores and evidence; invalid responses never become zero scores.

Long transcripts are partitioned chronologically into requests of at most 10,000 UTF-8 bytes of evidence and relevant script context. Every turn is included, retaining original turn numbers. Each critic reviews each section and combines its own section judgments through bounded synthesis requests. Section and synthesis outputs remain in the report. This changes the evaluation method: cross-section continuity is assessed indirectly, and scores should not be treated as directly equivalent to a single whole-transcript review. One failed section fails that critic's overall review. Oversized individual turns fail explicitly rather than being truncated.

Groq requests within a critic's review wait 61 seconds between calls to accommodate per-minute quotas. Each request has a 60-second timeout. A long review can take many minutes; other application traffic and daily quotas can still cause failures. The UI identifies request-size and quota failures and supports retrying a saved transcript without replaying the participant session.

A live Groq verification completed all eight Session 1 steps in 16 turns, with both critiques valid, zero failed model calls, zero recorded fallbacks and zero forced progress. This verifies the workflow, not comparative model quality. The initial unpaced run encountered quota errors, motivating the replay delay. Browser verification covered opt-in, assignment persistence after refresh and the completion report for an early-ended session.

The synthetic fixtures currently cover Session 1 only. Live capture follows the common session orchestrator, but other activities need their own replay fixtures and validation. These evaluations measure generated text and progression, not speech, avatar delivery, cost or therapeutic benefit. Full-session reports do not yet support the component benchmark's human-review import; a CST-informed human should independently review transcripts before interpreting automated scores as evidence of application effectiveness.
