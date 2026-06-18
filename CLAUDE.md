# AvatarCST - Current Project Context

## Product Goal

AvatarCST is a prototype iCST (individual Cognitive Stimulation Therapy) facilitator for people living with dementia or memory changes. The core experience is a structured, adult-to-adult therapy-style session where:

- A slide deck sits in the background as the session structure.
- Aria, the avatar facilitator, speaks the session script and adapts gently to the patient's responses.
- Patient input can be typed or recorded through the microphone.
- The avatar output should eventually be low-latency speech with lip-syncable mouth movement.
- The system should use a patient memory bank so Aria can personalize sessions without making the user feel tested.

The project has moved beyond the old "basic backend foundation" phase. The main work now is polishing the scripted slide-led session flow, hardening memory save/query behavior, and making the audio pipeline switch cleanly between the free prototype path and OpenAI Realtime mini.

## Current State

### Implemented

- React/Vite frontend and Express/Mongo backend.
- Login flow that creates or loads a patient user by name.
- Landing flow with two test sessions:
  - `cst_intro_reminiscence` - Session 1: Introduction and Welcome.
  - `cst_childhood` - Session 2: Getting to Know You: Childhood.
- Scripted session orchestration through `POST /api/sessions/:id/respond`.
- Microphone input path through `POST /api/sessions/:id/respond-audio`.
- Slide-backed session UI using exported slide images under `frontend/public/slides/session1/` and `frontend/public/slides/session2/`.
- Local avatar rendering with:
  - male avatar path based on `frontend/public/models/harry.glb`,
  - experimental female/avatar mode path,
  - simple audio visualizer mode.
- Rhubarb JSON mouth cues mapped to Three.js morph targets in the frontend.
- Memory bank model, caregiver CRUD routes, and caregiver page UI.
- Groq-based prototype LLM/STT path and Edge TTS output.
- A partial OpenAI Realtime mini session-secret endpoint.

### Still Rough

- Memory is stored, reviewed, and injected, but retrieval is currently broad and simple: the orchestrator loads approved memory entries and passes a small slice back as `memoryUsed`. There is no semantic search or scoring yet.
- `suggestedMemoryUpdates` is heuristic only, based on simple regexes in `sessionOrchestratorService.js`, and is now saved as pending caregiver-review memory.
- Realtime mode is not fully wired in the frontend. The backend can mint a realtime client secret, but `SessionPage.jsx` currently disables the mic action when `PIPELINE_MODE=realtime`.
- The current free pipeline still creates a full backend turn before returning audio, so it is not genuinely real-time.
- The two sessions are useful test scripts, not polished clinical content.
- Docs other than this file may still be stale; prefer source files over README text when they disagree.

## Current Audio / LLM Pipeline

Pipeline mode is controlled by `PIPELINE_MODE` in `backend/src/config/pipeline.js` and `backend/.env.example`.

### `PIPELINE_MODE=free` (current working prototype)

For recorded microphone input:

1. Frontend records browser audio with `MediaRecorder`.
2. `SessionPage.jsx` posts the audio blob to `POST /api/sessions/:id/respond-audio`.
3. `sttService.js` sends the audio to Groq Whisper (`whisper-large-v3-turbo` by default).
4. `sessionOrchestratorService.js` uses the transcript, session script state, recent messages, and memory entries.
5. `llmService.js` calls Groq chat completions (`llama-3.3-70b-versatile` by default).
6. `ttsService.js` synthesizes speech with `msedge-tts`.
7. `rhubarbService.js` generates Rhubarb mouth cues for the produced audio file. It uses `RHUBARB_PATH` if set, otherwise it looks for the auto-installed binary under `backend/vendor/rhubarb/bin`.
8. The backend returns `assistantText`, slide state, audio URL, Rhubarb JSON, memory used, and suggested memory updates.
9. The frontend plays the audio and drives avatar mouth movement from the Rhubarb timeline plus audio energy.

For typed input, the flow skips STT and starts at `POST /api/sessions/:id/respond`.

### `PIPELINE_MODE=realtime` (planned official path)

The intended target is:

`patient audio -> OpenAI Realtime mini (STT + LLM + TTS) -> avatar audio playback + Rhubarb/lip-sync or realtime mouth animation`

Current backend support:

- `POST /api/sessions/:id/realtime-session` calls `createRealtimeSessionForTurn`.
- `realtimeService.js` posts to `https://api.openai.com/v1/realtime/client_secrets`.
- It builds session instructions from the same CST prompt, slide, script, memory, and recent message context.

Current frontend gap:

- The frontend detects `PIPELINE_MODE=realtime` via `GET /api/sessions/pipeline`.
- The mic button currently logs that realtime is not configured and does not start a WebRTC session.

## Session Orchestration

The canonical turn endpoint is:

```text
POST /api/sessions/:id/respond
POST /api/sessions/:id/respond-audio
```

The orchestration service owns:

- session status checks,
- current script step,
- per-step turn counts,
- recent transcript retrieval,
- answer-quality checking,
- retry/progress decisions,
- adaptive response generation,
- slide state updates,
- assistant/user message persistence,
- memory context injection,
- suggested memory updates.

Important files:

- `backend/src/services/sessionOrchestratorService.js`
- `backend/src/services/cstScriptService.js`
- `backend/src/services/promptService.js`
- `backend/src/controllers/sessionController.js`
- `backend/src/models/Session.js`
- `backend/src/models/Message.js`

The session state fields that matter most are:

- `scriptId`
- `scriptStepIndex`
- `scriptStepTurnIndex`
- `scriptStepRetryCount`
- `presentationState`

## Scripts and Slides

Script data is currently split across two layers:

- `backend/src/services/cstScriptService.js` contains executable session steps used by the app.
- `context/vCST_Session1_AI_Script.md` and `context/vCST_Session2_AI_Script.md` hold fuller source script text and adaptation guidance.
- `context/vCST_Initial_Prompt.md` defines Aria's tone and CST facilitation principles.

Slide images live in:

- `frontend/public/slides/session1/`
- `frontend/public/slides/session2/`

When adding a session:

1. Add or update a script ID in `cstScriptService.js`.
2. Make sure the slide folder is registered in `scriptSlideFolders`.
3. Export slide images to `frontend/public/slides/<session-folder>/slide-XX.jpg`.
4. Add the session option in `frontend/src/App.jsx`.
5. Keep script copy warm, brief, adult-to-adult, and non-testing.

## Memory Bank

Current model:

- `backend/src/models/Memory.js`
- One memory document per user.
- Entries have `category`, `content`, `addedBy`, and timestamps.
- Entries also have a review `status`: `pending`, `approved`, or `rejected`.
- Categories: `preference`, `personal`, `session_insight`, `caregiver_note`.

Current routes:

- `GET /api/memory/:userId`
- `POST /api/memory/:userId/entries`
- `PATCH /api/memory/:userId/entries/:entryId/review`
- `DELETE /api/memory/:userId/entries/:entryId`
- `DELETE /api/memory/:userId`

Current frontend:

- `frontend/src/pages/CaregiverPage.jsx` lets a caregiver view, add, and delete memory entries.
- The caregiver page separates approved memories from pending suggestions, and pending items can be approved or rejected.
- `frontend/src/pages/LoginPage.jsx` seeds a few starter memories when it creates a new user.

Current orchestrator behavior:

- Loads approved memory entries for the session user. Older entries without a `status` field are treated as approved for compatibility.
- Injects memory into prompt instructions as quoted data.
- Returns the first few entries in `memoryUsed`.
- Generates basic `suggestedMemoryUpdates` when the patient states a favorite or life-history place, saves new ones as pending memory entries, and deduplicates against non-rejected entries.

Recommended next memory work:

1. Replace broad approved-memory injection with query/relevance filtering.
2. Improve memory suggestion extraction beyond regexes.
3. Track why approved memories were selected so caregiver review is explainable.
4. Add tests around memory suggestion, review, saving, deletion, and prompt injection safety.

## API Overview

Mounted in `backend/src/app.js`:

- `/api/health`
- `/api/users`
- `/api/sessions`
- `/api/summaries`
- `/api/memory`
- `/generated-audio`

Useful session endpoints:

- `GET /api/sessions/pipeline`
- `POST /api/sessions`
- `GET /api/sessions/user/:userId`
- `DELETE /api/sessions/user/:userId`
- `GET /api/sessions/:id`
- `PATCH /api/sessions/:id`
- `PATCH /api/sessions/:id/end`
- `POST /api/sessions/:id/respond`
- `POST /api/sessions/:id/respond-audio`
- `POST /api/sessions/:id/realtime-session`
- `POST /api/sessions/:id/messages`
- `GET /api/sessions/:id/messages`

## Development Setup

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Defaults:

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- Frontend API base: `VITE_API_URL` or `http://localhost:5000/api`

Mongo:

- Set `MONGO_URI` in `backend/.env`.
- `docker-compose.yml` provides a local Mongo option.
- If using local Docker Mongo, use a URI like `mongodb://127.0.0.1:27017/avatarcst`.

Demo data:

- `backend/src/scripts/seedDemo.js` creates Margaret and Sarah, links caregiver/patient, and seeds memory entries.
- If a package script is not present, run it directly from `backend` with:

```powershell
node src/scripts/seedDemo.js
```

## Environment Variables

Backend variables from `backend/.env.example`:

- `PORT`
- `MONGO_URI`
- `NODE_ENV`
- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_VOICE`
- `RHUBARB_PATH`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GROQ_WHISPER_MODEL`
- `PIPELINE_MODE`
- `TTS_VOICE`

Frontend variables:

- `VITE_API_URL`
- Optional fixed demo user ID if using seeded data: `VITE_DEMO_USER_ID`

`backend/package.json` runs `scripts/install-rhubarb.js` on `npm install`. The script downloads the latest platform-specific Rhubarb release into `backend/vendor/rhubarb/bin`; that folder is git-ignored. Set `RHUBARB_SKIP_INSTALL=1` to skip the download, `REQUIRE_RHUBARB=1` to make install fail if Rhubarb cannot be fetched, or `RHUBARB_PATH` to point at a manually installed binary.

Never commit real `.env` files or API keys.

## Avatar and Lip Sync

Main files:

- `frontend/src/components/avatar/AvatarViewer.jsx`
- `frontend/src/utils/lipSync.js`
- `frontend/src/pages/SessionPage.jsx`
- `backend/src/services/rhubarbService.js`
- `backend/src/services/avatarService.js`

The proven lip-sync path is the Harry/male avatar with Rhubarb mouth cues mapped to morph targets. The female avatar path is experimental because prior inspected assets did not expose the same reliable viseme targets. The visualizer mode is useful as a low-risk fallback when avatar rigging is not the focus.

Dev URL helpers:

- `?devSession=1` opens straight into session mode in Vite dev.
- `?avatar=female` selects the female mode.
- `?avatar=visualizer` selects the audio visual mode.

## Engineering Principles

- Keep the backend as the source of truth for session progression.
- Keep the frontend thin: display the slide, avatar, transcript, and input controls based on backend turn envelopes.
- Prefer small, testable changes around session orchestration; it touches script state, messages, memory, slides, audio, and avatar behavior.
- Do not make the patient feel quizzed. Scripts should invite, reflect, reassure, and move on gently.
- Treat memory as sensitive patient context. Avoid injecting too much, and make future memory writes reviewable.
- Prefer real source files over stale docs when investigating current behavior.

## Suggested Next Steps

The proposed order sounds right:

1. Memory bank hardening.
   - Decide the memory schema and lifecycle.
   - Add relevance/query behavior.
   - Add reviewable memory suggestions.
   - Add focused tests.

2. Realtime mini integration.
   - Wire the frontend WebRTC/client-secret flow.
   - Decide how to keep Rhubarb/lip sync compatible with realtime audio, or use an interim audio-energy mouth animation.
   - Keep the free Groq/Edge/Rhubarb path as a fallback.

3. Session polish.
   - Improve the two test sessions' scripts.
   - Add caregiver-visible session summaries.
   - Reduce visible dev/debug chrome before demos.

4. Avatar polish.
   - Keep Harry as the reliable baseline.
   - Treat female avatar work as separate rig/asset work unless a better viseme-ready model is added.
