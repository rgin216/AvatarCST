# Deployed application latency collection

There are two collection paths. The CLI exercises the deployed backend now, using its existing response contract. Browser capture and corrected multi-segment server timing require deploying the changed frontend/backend first. Neither implementation publishes a deployment automatically.

## 1. Deployed API benchmark

Log in with a dedicated synthetic account and start a test session. Take the session ObjectId from `/session/ID` in the address bar. Find the backend API base URL in the browser Network panel's session request: use its origin plus `/api`, not the Vercel frontend URL unless requests actually use a same-origin API proxy.

From `backend`, replace BACKEND and TEST_SESSION_ID:

```powershell
# Validate configuration without contacting the deployment
npm run eval:latency:deployed -- --api https://BACKEND/api --session TEST_SESSION_ID --inputs evaluation/deployed-latency-inputs.json
# Execute three synthetic text turns against the deployed session
npm run eval:latency:deployed -- --live --api https://BACKEND/api --session TEST_SESSION_ID --inputs evaluation/deployed-latency-inputs.json --label "deployed-pilot-1"
```

Additional options: `--repeats N` (1–1000), `--delay-ms N` (default 1000), `--timeout-ms N` (default 120000), `--avatar male|female|visualizer`, `--lipsync rhubarb|energy`, `--out directory`, `--label text`. Runs are sequential. Live calls persist messages, advance the session and incur provider usage. Do not use a participant session. The CLI does not play audio; keep the session's browser closed during API collection to avoid concurrent turns/reminders.

The runner stops at the first HTTP/network/invalid-response error, or a turn indicating session completion. After a timeout, the server may still complete the write; do not retry that session blindly. Inspect its state first. `--repeats` repeats inputs against an advancing session; it does not reset state or replicate identical prompts. For comparable runs, create fresh synthetic sessions with the same script, pipeline, account settings and initial progression. The starter responses are only connectivity fixtures; prepare a script-specific sequence for a main study.

Outputs under a unique ignored `evaluation/results/*-deployed-*/` directory:

- `manifest.json`: API target, test session, synthetic input snapshot, options, client runtime, run label and completion summary.
- `rows.jsonl`: checkpoint per attempted turn, including errors and server stage durations.
- `samples.csv`: flattened request and server timings, pipeline/avatar settings and audio availability.
- `report.json`: samples and successful request count/mean/sample SD/percentiles. Missing audio is counted separately even when HTTP succeeds.

`requestMs` covers client POST through complete JSON parsing, including upload/network/server processing. No generated audio download, browser or avatar playback is measured. Error durations are retained but excluded from successful distributions. A failed call or missing audio produces a nonzero exit after saving results. Fewer attempted than planned calls means the run stopped early. An unfinished manifest has no completion timestamp. No credentials or API error bodies are exported. No authentication bypass is implemented; if the deployment requires credentials, use its normal browser session with the panel instead.

## 2. Browser and avatar pipeline collection

Three playable [synthetic WAV fixtures](audio/README.md) are included under `evaluation/audio/`. They mirror the starter text inputs. The runner uses a fixed sequence, including for follow-up questions; it does not generate an adaptive answer or default to “I don't know”. It stops when the queue is exhausted.

After deploying this branch's frontend, log in to the deployed app with a synthetic test account and start a session. Append `?latency=1` to its session URL, for example:

```text
https://avatar-cst.vercel.app/session/TEST_SESSION_ID?latency=1
```

Open **Deployment latency research** in the conversation panel and enable capture. Existing manual typed/microphone turns are now measured. Or enter one synthetic response per line and click **Run synthetic inputs**. You can select synthetic audio files instead; these are posted to the real transcription endpoint, then delivered to the existing avatar player. Automated audio fixtures measure upload-to-playback, without microphone capture time.

The automatic sequence waits until narration finishes before the next turn. Keep this tab foreground, avoid other controls during the run and use the manual Play button if autoplay is blocked. A blocked run waits up to three minutes before stopping. Stop aborts the browser request, but cannot guarantee cancellation of server processing. New server errors stop the sequence. Collection is limited to 100 inputs per sequence; use fresh sessions for independent runs. Session completion stops further inputs. Automated inputs appear as server messages, but the panel does not add synthetic user bubbles locally.

Click **Export JSON + CSV** after the last narration. Allow multiple downloads if the browser asks. Capture stays only in browser memory; export before navigating away or reloading. Clear capture after any warmup turns and before measured collection, while narration is idle. The exported JSON includes frontend/backend URLs, browser user agent, attempt timestamps, session IDs and server/client correlation IDs, without response text or audio. Preserve your synthetic fixture sequence separately with study notes.

Browser columns:

| Field | Interval or meaning |
| --- | --- |
| `requestMs` | Axios request interceptor to parsed JSON response; includes client/network/server work |
| `responseToPlayingMs` | Parsed response to the first media `playing` event |
| `requestToPlayingMs` | Request start to first media `playing` event |
| `stopToPlayingMs` | Manual microphone stop click to first media `playing` event, including recording tail/finalisation; null for uploaded fixtures/text |
| `autoplayBlocked` | True if manual intervention was needed; exclude those rows from automatic onset comparisons |
| `playbackStatus` | Pending, playing, completed, missing audio, playback error, superseded request or blocked autoplay |
| `turnId` | Server-generated correlation ID after backend update; null on older deployments |

`playing` is a browser playback-onset proxy. It does not measure acoustic output at speakers, first non-silent sample, first lip-sync frame or completion of avatar rendering. Only the first speech segment's onset is measured; later segments do not overwrite it. Pending/missing/error values remain null, never zero. Do not silently discard them. Exported playback status can still be `playing` if you export before speech finishes. Autoplay intervention remains flagged after manual playback.

## 3. Server timing interpretation

Deploy the backend update to accumulate `ttsMs` and `rhubarbMs` across all speech segments. Older deployed code reports only the last segment, making stage breakdowns incomplete. Use presence of `turnId`/`audioStatus` as a compatibility signal; record the actual deployed revision separately. Backend `audioStatus=error` distinguishes speech failure from HTTP success.

- `sttMs`: transcription call; audio requests only.
- `orchestratorMs`: full session turn orchestration, including database, prompting and any LLM work. It is not an isolated inference duration.
- `ttsMs` and `rhubarbMs`: accumulated durations for speech/lip-sync generation, including a failing stage's elapsed time.
- `totalMs`: response-controller processing up to preparing the JSON response. It excludes Express upload parsing before the controller, response transmission, audio download and browser playback.

Client and server clocks are separate. Compare durations; do not subtract absolute timestamps across machines. `requestMs - totalMs` contains several kinds of overhead and is not a pure network measurement. The server ID joins the returned stage timings to a browser attempt, not a persisted server telemetry store.

## Research protocol

Freeze and record frontend/backend revisions, public URLs, pipeline, model/voice settings, avatar/lip-sync mode, script, account language, browser/OS, network/client location, fixture audio format/duration, session starting state and collection time. Separate warmups from measured rows. Use independent fresh sessions and repeated collection windows to inspect variability. Account memory and progression can affect prompts; resets must be defined in the study protocol.

Report attempted calls, HTTP failures, missing audio, playback errors, blocked-autoplay counts, and successful request/onset means, medians and p95 with sample sizes. Analyse pipelines and input modes separately. Use successful onset rows with no autoplay intervention for automatic response-time distributions. Keep a separate accounting of failures and pending rows. Preserve row order and session IDs: turns within one session are dependent, so do not treat them as independent participants or assert statistical significance from descriptive summaries. No confidence intervals or inferential tests are supplied.

Example methods statement:

> We exercised the deployed AvatarCST application at [frontend/backend URLs and revisions] using [N] synthetic sessions with [fixture sequence], [pipeline], [avatar mode] and [browser/network conditions]. Client request completion and first media-playing onset were measured using browser monotonic time. Server stage durations were joined using turn IDs. Warmups and autoplay interventions were excluded from successful onset distributions and reported separately, along with request and speech failures.

Automated tests verify timing arithmetic, failure handling, rotation and export logic with controlled clocks and mocked requests. They do not constitute a live deployment dataset. A live pilot must be collected against the selected deployment before reporting measured values.
