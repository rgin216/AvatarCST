# AvatarCST

AvatarCST is a prototype of AI-supported individual Cognitive Stimulation Therapy (iCST) for people living with dementia or memory changes. A participant works through a structured, slide-led session with **Aria**, an on-screen avatar facilitator. Aria speaks each step of the session script, listens to typed or spoken replies, and adapts gently to what the participant says. The tone throughout is adult to adult, and nothing is framed as a test.

The project is a React web app with a Node.js/Express API and a MongoDB database. It uses cloud speech-to-text, a large language model and text-to-speech, with lip-synced avatar output.

## Contents

1. [What the system does](#1-what-the-system-does)
2. [How a session turn works](#2-how-a-session-turn-works)
3. [Repository structure](#3-repository-structure)
4. [Backend](#4-backend)
5. [Frontend](#5-frontend)
6. [Sessions and their content](#6-sessions-and-their-content)
7. [Data model](#7-data-model)
8. [API reference](#8-api-reference)
9. [Getting started](#9-getting-started)
10. [Testing](#10-testing)
11. [Evaluation](#11-evaluation)
12. [Deployment](#12-deployment)
13. [Adding a new session](#13-adding-a-new-session)
14. [Further documentation](#14-further-documentation)

---

## 1. What the system does

- **Fourteen structured sessions** follow the New Zealand vCST programme (Session 1 Introduction to Session 14 Word Games). Each has its own slide deck, script and activities. New accounts complete Session 1 first, which then unlocks the others.
- **A consistent session shape.** Most sessions open with a welcome, the participant's theme song, a check-in, gentle day/month/year/season orientation, the weather, a positive New Zealand news story and a short seated exercise video. A themed activity block follows, then a question wheel, a summary, and a closing.
- **Typed or spoken replies.** The participant can type or record their answer with the microphone. Recorded speech is transcribed on the server.
- **An avatar facilitator.** Aria is shown as a 3D male avatar, an experimental female avatar, or a simple audio visualiser. Her speech is synthesised, and the 3D avatars' mouths move in time with it using Rhubarb Lip Sync.
- **Adaptive but scripted.** The backend owns session progress: the current step, retries, and when to move on. The language model writes short, warm acknowledgements around fixed script lines rather than running the conversation freely.
- **Interactive activities.** These include tap-to-choose trivia, matching cards, drag-and-drop meal building, a spin-the-wheel question, audio clips, word games and pen-and-paper drawing.
- **A memory bank.** Details the participant shares can be suggested as memories. A caregiver reviews and approves them before Aria uses them to personalise later sessions.
- **A caregiver area.** It is password-protected and shows memories, pending suggestions and session summaries.
- **Accessibility.** The interface uses large type, high contrast and generous tap targets. It includes a practice step for typing and speaking, adjustable speech speed, and five interface languages (English, Chinese, Spanish, French and te reo Māori).

## 2. How a session turn works

```text
 Participant types or records a reply
        │
        ▼
 POST /api/sessions/:id/respond         (typed text)
 POST /api/sessions/:id/respond-audio   (recorded audio → speech-to-text first)
        │
        ▼
 sessionOrchestratorService
   • loads the session, current script step, recent messages and approved memories
   • judges the reply (deterministic checks first, then the language model if needed)
   • decides: repeat the question, ask a follow-up, or move to the next step
   • writes Aria's acknowledgement + the next scripted line
   • saves messages, session state and any suggested memories
        │
        ▼
 sessionController
   • synthesises speech for each segment (cached and prefetched)
   • generates Rhubarb mouth cues for the 3D avatars
        │
        ▼
 Frontend receives a "turn envelope": text, slide, interaction state, audio, lip-sync
   • shows the slide and any activity
   • plays Aria's audio and animates the avatar
```

There are two speech and language pipelines, chosen by `PIPELINE_MODE`:

| Mode | Speech-to-text | Language model | Text-to-speech | Purpose |
|---|---|---|---|---|
| `openai-fast-scripted` (default) | OpenAI `gpt-4o-mini-transcribe` | OpenAI Responses API | OpenAI TTS | Lower-latency paid path used in production |
| `free` | Groq Whisper | Groq-hosted model | Microsoft Edge TTS | Free prototype path for testing |

`STT_PROVIDER` can swap only the transcription step between Groq and OpenAI.

---

## 3. Repository structure

```text
AvatarCST/
├── backend/                 Node.js + Express API, session logic, evaluation tooling
│   ├── context/             Aria's base prompt and per-session script guidance (Markdown)
│   ├── evaluation/          Evaluation protocols, inputs, figures and published results
│   ├── scripts/             Command-line tools (evaluations, plots, Rhubarb installer)
│   ├── src/                 Application source (see section 4)
│   ├── .env.example         Template for backend environment variables
│   └── package.json
├── frontend/                React + Vite single-page app
│   ├── public/              Static assets: slides, audio clips, GIFs, 3D avatar models
│   ├── src/                 Application source (see section 5)
│   └── package.json
├── deployment/uoa-server/   Scripts and notes for the University of Auckland server deployment
├── cloudbuild.yaml          Google Cloud Build → Cloud Run pipeline for the backend
├── docker-compose.yml       Local MongoDB container for development
├── CLAUDE.md                Detailed engineering notes on current behaviour
└── README.md                This file
```

Folders created at runtime and ignored by Git:
- `backend/generated-audio/` holds synthesised speech files.
- `backend/temp/uploads/` holds uploaded microphone recordings.
- `backend/vendor/rhubarb/` holds the downloaded Rhubarb binary.
- `.env` files hold secrets.

---

## 4. Backend

`backend/src/` follows a conventional layered Express layout: routes, then controllers, then services, then models.

### 4.1 Entry points and configuration

| Path | Contents |
|---|---|
| `server.js` | Connects to MongoDB and starts the HTTP server. |
| `app.js` | Express app: CORS, JSON parsing, static `/generated-audio`, and mounting of the API routes. |
| `config/db.js` | MongoDB connection via Mongoose. |
| `config/env.js` | Loads environment variables. |
| `config/pipeline.js` | Pipeline modes (`free`, `openai-fast-scripted`) and transcription-provider selection. |
| `config/storage.js` | Upload and generated-audio folders, and the `multer` upload handler. |
| `middleware/` | `notFound` and `errorHandler`. |

### 4.2 Routes and controllers

| Route file | Controller | Responsibility |
|---|---|---|
| `routes/healthRoutes.js` | `healthController.js` | Health check. |
| `routes/userRoutes.js` | `userController.js` | Registration, sign-in, settings, password check for the caregiver area, landing tour. |
| `routes/sessionRoutes.js` | `sessionController.js` | Creating and loading sessions, the turn endpoints, speech synthesis and streaming, inactivity reminders, ending sessions. |
| `routes/summaryRoutes.js` | `summaryController.js` | Generating and reading caregiver session summaries. |
| `routes/memoryRoutes.js` | `memoryController.js` | Memory bank create, review, delete and clear. |
| (session routes) | `evaluationController.js` | Evaluation options and per-session evaluation reports for opt-in research runs. |

### 4.3 Services

Services hold the application logic. They fall into these groups:

**Session orchestration**
- `sessionOrchestratorService.js` is the core turn engine. It covers step progression, answer judging (trivia, naming slots, tap-to-choose rounds, orientation, matching and more), retries, adaptive follow-ups, safety and low-mood support, memory selection and suggestions, the caregiver recap, and inactivity reminders.
- `promptService.js` builds the language-model prompts. It loads `context/vCST_Initial_Prompt.md` and each session's `.md` script, pairing each Markdown section with its script step.
- `sessionAccessService.js` handles the rule that Session 1 must be completed first.
- `summaryService.js` generates caregiver summaries from a session transcript.
- `childhoodRecallService.js` gently recalls a childhood place from approved memories and earlier sessions.

**Session scripts.** These define the executable steps of each session; see section 6.
- `cstScriptService.js` is the script registry: script lookup, slide-folder mapping and pre-session preparation notices. It also contains the scripts for Sessions 1–6, 8 and 12 inline.
- `cstSessionOpening.js` builds the shared opening (welcome through exercise) from a small config object.
- `cstScriptHelpers.js` holds shared helpers such as the theme-song, exercise-video and adaptive follow-up definitions.
- Per-session script files:
  - `facesScenesScript.js` (Session 7)
  - `beingCreativeScript.js` (Session 9)
  - `categorizingObjectsScript.js` (Session 10)
  - `orientationScript.js` (Session 11)
  - `numberGamesScript.js` (Session 13)
  - `wordGamesScript.js` (Session 14)
- Activity logic and data:
  - `categorizingObjectsService.js`, `categorizingObjectsData.js` and `categorizingAcknowledgementService.js` for Session 10's object sorting.
  - `matchingService.js` for card matching.
  - `pictureAnswerService.js` for picture guesses.
  - `orientationContext.js` for Session 11.
  - `wordGamesService.js` for Session 14.

**Language models**
- `llmService.js` is a single entry point for text generation. It supports OpenAI, Groq and Anthropic, cleans output for speech, and records fallbacks.
- `llmProviders.js` and `anthropicService.js` handle provider credentials and the Anthropic adapter.
- `llmContext.js` holds per-request model context, used for evaluation and fallback reporting.

**Speech and avatar**
- `sttService.js`: speech-to-text, with a provider fallback and a check for transcripts in the wrong script.
- `ttsService.js`: text-to-speech for OpenAI and Edge, with a voice chosen per avatar.
- `speechCacheService.js`: caches synthesised audio by text and voice, and prefetches upcoming script lines.
- `speechStreamService.js`: short-lived tokens for streaming speech to the visualiser.
- `speechPronunciation.js`: spoken-form overrides, for example te reo Māori words.
- `rhubarbService.js`: converts audio and runs Rhubarb Lip Sync to produce mouth cues.
- `avatarService.js`: shapes the avatar section of a turn response.
- `turnTiming.js`: per-stage latency timing.

**External content**
- `newsService.js`, `docNewsService.js` and `newsConversationService.js`: positive New Zealand news from Department of Conservation releases (with NewsAPI as a fallback), and answering follow-up questions about a story.
- `spotifyService.js` and `songExtractionService.js`: theme-song lookup on Spotify from a participant's free-text request.

**Accounts**
- `passwordService.js`: scrypt password hashing and validation.

### 4.4 Models

These are Mongoose schemas in `src/models/`; field details are in section 7.

- `User.js`
- `Session.js`
- `Message.js`
- `Memory.js`
- `Summary.js`
- `Evaluation.js`

### 4.5 Evaluation code

`src/evaluation/` contains the research tooling behind section 11:
- `runner.js` and `sessionJudge.js` for language-model scoring rubrics.
- `latency.js`, `deployedLatency.js` and `concurrency.js` for latency and load testing.
- `wer.js` for speech-to-text word error rate.
- `sessionReplay.js` and `sessionJobs.js` for full-session replay and opt-in live evaluation jobs.
- `analysis.js`, `pacing.js` and `publication.js` for analysis, rate-limit pacing and result publishing.

`src/scripts/seedDemo.js` seeds demo users and memories.

### 4.6 Session context (`backend/context/`)

- `vCST_Initial_Prompt.md` sets Aria's persona and CST facilitation principles.
- `vCST_Session1_AI_Script.md` to `vCST_Session14_AI_Script.md` hold the per-session guidance. Each file has a preamble followed by one `---`-separated section per executable step, in the same order as the script array, and the orchestrator passes the matching section to the model on each turn. Session 14 is the one exception: it generates its step guidance in code.

### 4.7 Command-line scripts (`backend/scripts/`)

| Script | Purpose |
|---|---|
| `install-rhubarb.js` | Downloads and verifies the Rhubarb binary. It runs automatically on `npm install`. |
| `evaluate-llms.js`, `compare-human-review.js`, `summarize-evaluation.js`, `complete-evaluation-workflow.js`, `finish-evaluation-run.js`, `publish-evaluation.js` | Language-model quality evaluation workflow. |
| `evaluate-sessions.js` | Full-session replay evaluation. |
| `evaluate-latency.js`, `evaluate-deployed-latency.js`, `collect-deployed-voice-latency.js`, `generate-latency-audio.ps1` | Latency measurement, locally and against a deployment. |
| `evaluate-concurrency.js`, `cleanup-load-test.js`, `sample-host-load.ps1` | Concurrent-user load testing. |
| `evaluate-stt.js`, `analyze-stt.js` | Speech-to-text accuracy on DementiaBank recordings. |
| `plot-*.js`, `plot-stage-latency.py` | Figures for the evaluation reports. |

---

## 5. Frontend

`frontend/src/` is a React 19 single-page app built with Vite. It uses React Router for pages, Axios for API calls, and three.js (`@react-three/fiber` and `drei`) for the 3D avatar.

### 5.1 Pages (`src/pages/`)

| Page | Contents |
|---|---|
| `LoginPage.jsx` | Sign in and registration, with a "remember me" option. |
| `LandingPage.jsx` | Session picker cards, last-session shortcut and first-visit tour. |
| `SessionPage.jsx` | The live session: slide, activity overlays, avatar, transcript, text and microphone input, audio playback, inactivity reminders. |
| `EndPage.jsx` | End-of-session screen with a summary. |
| `CaregiverPage.jsx` | Memory bank review, session history and summaries. |
| `SettingsPage.jsx` | Avatar, personality, language and speech-speed settings. |

`App.jsx` defines the routes and the list of sessions. Before a session starts, it shows the input practice (`SessionInputTutorial.jsx`) and any pre-session preparation notice.

### 5.2 Components (`src/components/`)

- **Session activities:**
  - `TriviaChoiceActivity` (tap-to-choose rounds)
  - `MatchingActivity` (match clues to names)
  - `MealBuilderActivity` (drag food onto a plate)
  - `ObjectSelectionActivity` (sort objects)
  - `PhraseCardsActivity` (fill-in-the-blank cards)
  - `OrientationActivity` (single-question cards)
  - `PronunciationActivity` and `WordGuessActivity` (Session 14 word games)
- **Session shell:**
  - `SessionInputBar` (text and microphone input)
  - `SessionInputTutorial` (practice step)
  - `SessionPreparationNotice` (for example, "have a pen and paper ready")
- **Avatar:** `avatar/AvatarViewer.jsx` renders the 3D avatar and applies mouth shapes.
- **Access and onboarding:** `CaregiverGate` (password check for the caregiver area) and `LandingTour`.
- **Research:** `EvaluationControls`, `DeploymentLatencyControls` and `SessionEvaluationReport`. These are opt-in panels for evaluation runs.
- **UI primitives:** `ui/ActivityCard.jsx` and `ui/EmojiButton.jsx`.

### 5.3 Utilities, hooks and language

- `src/utils/`:
  - `lipSync.js`: maps Rhubarb cues to mouth shapes.
  - `transcriptStream.js`: streams transcript text.
  - `practiceRecorder.js`: recorder for the practice step.
  - `speechRate.js`, `theme.js` and `formatName.js`: speech-speed limits, shared colours and name display.
  - `wordGuess.js` and `objectBoardLayout.js`: game logic and layout.
  - `inputTutorial.js`, `sessionPreparation.js` and `deploymentLatency.js`: pre-session logic and latency tooling.
  - Files ending in `.test.js` are unit tests.
- `src/hooks/`: `useViewport` and `useIsDesktop` for responsive layout.
- `src/language/`: interface translations (`translations.js`) and the language context provider.
- `src/services/api.js`: the Axios client, pointed at `VITE_API_URL`.
- `src/index.css`: global and session-page styles.

### 5.4 Static assets (`frontend/public/`)

- `slides/session1/` to `slides/session14/` hold exported slide images named `slide-01.jpg`, `slide-02.jpg` and so on, one folder per session.
- `audio/session4/` holds instrument and Name That Tune clips (see its README for sources). `audio/session14/` holds te reo Māori word recordings.
- `activities/session3/` holds GIFs for the movement game.
- `models/harry.glb` is the male avatar, the reliable lip-sync baseline. `models/female-rpm-vrchat/` holds the experimental female avatar assets.

---

## 6. Sessions and their content

Each session is a script array of steps. A step has a slide number, the line Aria speaks, how answers are judged, and an optional interaction. Most sessions share the opening and closing blocks described in section 1.

| # | Script ID | Theme | Script source | Notable activities |
|---|---|---|---|---|
| 1 | `cst_intro_reminiscence` | Introduction and Welcome | `cstScriptService.js` | Choosing a theme song (Spotify); unlocks the other sessions |
| 2 | `cst_childhood` | Getting to Know You: Childhood | `cstScriptService.js` | Childhood reminiscence, choosing a theme song, question wheel |
| 3 | `cst_physical_games` | Physical Games | `cstScriptService.js` | Reveal-and-perform movement game |
| 4 | `cst_sounds` | Sounds | `cstScriptService.js` | Instrument sound clips, Name That Tune, sound trivia |
| 5 | `cst_food` | Food | `cstScriptService.js` | Food sayings, meal builder |
| 6 | `cst_current_affairs` | Current Affairs | `cstScriptService.js` | News then and now, historic photographs |
| 7 | `cst_faces_scenes` | Faces and Scenes | `facesScenesScript.js` | Matching famous faces, real-or-AI pictures |
| 8 | `cst_word_associations` | Word Associations | `cstScriptService.js` | Missing words, sayings, word pairs |
| 9 | `cst_being_creative` | Being Creative | `beingCreativeScript.js` | Famous paintings, "art that makes you think", drawing a dream house with pen and paper |
| 10 | `cst_categorizing_objects` | Categorizing Objects | `categorizingObjectsScript.js` | Odd one out, object pairs, category words |
| 11 | `cst_orientation` | Orientation | `orientationScript.js` | Landmarks, maps, neighbourhood memories |
| 12 | `cst_using_money` | Using Money | `cstScriptService.js` | Price trivia, payments, windfalls |
| 13 | `cst_number_games` | Number Games | `numberGamesScript.js` | Calendar numbers, fill in the number, guess the jar |
| 14 | `cst_word_games` | Word Games | `wordGamesScript.js` | Te reo Māori pronunciation, brain teasers, rhymes, five-letter word game |

Each session's content is spread across three places:
- the executable steps (the script source above);
- Aria's per-step guidance (`backend/context/vCST_Session<N>_AI_Script.md`);
- the slide images (`frontend/public/slides/session<N>/`).

---

## 7. Data model

All collections live in MongoDB and are accessed through Mongoose.

| Model | Key contents |
|---|---|
| **User** | Display name and preferred name, lowercase `username`, hashed password (never returned), role (`patient` or `caregiver`), Session 1 completion and tour flags, saved theme song, and settings (avatar, personality, language, speech rate). |
| **Session** | Owner, `scriptId`, status (`pending`, `active`, `completed`, `abandoned`), pipeline mode, script position (`scriptStepIndex`, `scriptStepTurnIndex`, `scriptStepRetryCount`), `interactionState` for per-activity progress, `presentationState` (the slide currently shown), news already shown, and timestamps. |
| **Message** | One transcript line (`user`, `assistant` or `system`) for a session. |
| **Memory** | One document per user, holding entries with a category (`preference`, `personal`, `session_insight`, `caregiver_note`), content, source session, who added it, and a review status (`pending`, `approved`, `rejected`). Only approved entries are given to Aria. |
| **Summary** | A caregiver summary per session: text, key talking points, emotional tone, engagement level. |
| **Evaluation** | Records for opt-in research evaluation runs (per-turn and per-session). |

---

## 8. API reference

All routes are under `/api`. Synthesised audio is served from `/generated-audio`.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Users | `POST /users`, `POST /users/register`, `POST /users/login`, `GET /users/:id`, `PATCH /users/:id/settings`, `POST /users/:id/landing-tour/complete`, `POST /users/:id/verify-password` |
| Sessions | `GET /sessions/pipeline`, `GET /sessions/evaluation-options`, `GET /sessions/speech-stream/:token`, `POST /sessions`, `GET /sessions/user/:userId`, `GET /sessions/user/:userId/access`, `DELETE /sessions/user/:userId`, `GET /sessions/:id`, `PATCH /sessions/:id`, `PATCH /sessions/:id/end` |
| Session turns | `POST /sessions/:id/respond` (text), `POST /sessions/:id/respond-audio` (audio upload), `POST /sessions/:id/reminder` (inactivity reminder) |
| Transcripts | `POST /sessions/:id/messages`, `GET /sessions/:id/messages` (development only) |
| Evaluation | `GET /sessions/:id/evaluation`, `POST /sessions/:id/evaluation/retry` |
| Summaries | `POST /summaries`, `POST /summaries/generate/:sessionId`, `GET /summaries/session/:sessionId`, `GET /summaries/user/:userId` |
| Memory | `GET /memory/:userId`, `POST /memory/:userId/entries`, `PATCH /memory/:userId/entries/:entryId/review`, `DELETE /memory/:userId/entries/:entryId`, `DELETE /memory/:userId` |

> **Note:** passwords currently gate the user interface only. The API does not yet authenticate requests, so it should not be exposed with real patient data.

---

## 9. Getting started

### 9.1 Prerequisites

- Node.js 20.19 or later
- MongoDB, either local (Docker works) or Atlas
- API keys: OpenAI for the default pipeline, or Groq for the free pipeline

### 9.2 Install and run

```bash
# Optional: start a local MongoDB
docker compose up -d

# Backend (http://localhost:5000)
cd backend
cp .env.example .env      # then fill in MONGO_URI and API keys
npm install               # also downloads Rhubarb Lip Sync
npm run dev

# Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

With Docker MongoDB, use `MONGO_URI=mongodb://127.0.0.1:27017/avatarcst`.

To add demo users and memories, run `node src/scripts/seedDemo.js` from `backend`.

### 9.3 Environment variables

The backend reads `backend/.env`; `backend/.env.example` documents every variable. The main groups are:

| Group | Variables |
|---|---|
| Server and database | `PORT`, `MONGO_URI`, `NODE_ENV` |
| Pipeline | `PIPELINE_MODE` (`openai-fast-scripted` or `free`), `STT_PROVIDER` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_FAST_TEXT_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_*_VOICE`, `OPENAI_TTS_INSTRUCTIONS` |
| Groq and Edge TTS | `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_WHISPER_MODEL`, `TTS_VOICE`, `EDGE_TTS_*_VOICE`, `EDGE_TTS_*_PITCH_HZ` |
| Lip sync | `RHUBARB_PATH`, `RHUBARB_SKIP_INSTALL`, `REQUIRE_RHUBARB` |
| News and music | `NZ_DOC_NEWS_ENABLED`, `NEWS_API_KEY`, `NZ_NEWS_*`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_MARKET` |
| Research (optional) | `ANTHROPIC_API_KEY`, `ANTHROPIC_TEXT_MODEL`, `LLM_EVALUATION_ENABLED`, `EVAL_MONGO_URI` |

The frontend reads `VITE_API_URL`, which defaults to `http://localhost:5000/api`.

Never commit `.env` files or API keys.

### 9.4 Development shortcuts

These URL parameters work in the Vite dev build:
- `?devSession=1` opens straight into a practice session.
- `?avatar=female` and `?avatar=visualizer` select the avatar mode.
- `?pipeline=free` selects the free pipeline.

---

## 10. Testing

The tests use Node's built-in test runner and need no database: models and network calls are mocked.

```bash
# Backend: all service and evaluation tests
cd backend
node --test "src/**/*.test.js"

# One file, e.g. a single session
node --test src/services/beingCreative.test.js

# Frontend: utility tests, lint and production build
cd frontend
node --test src/utils/*.test.js
npm run lint
npm run build
```

Each newer session has its own test file, for example `numberGames.test.js` and `beingCreative.test.js`. These check that the script lines up with its Markdown guidance and slide images, that answers are judged correctly, and that the caregiver recap mentions the session's activities.

---

## 11. Evaluation

The `backend/evaluation/` folder documents and stores the project's evaluations:

| Document | Topic | Command (from `backend`) |
|---|---|---|
| [README.md](backend/evaluation/README.md) | Language-model comparison: facilitator responses scored by rotating model critics and human review | `npm run eval:llm` |
| [LATENCY.md](backend/evaluation/LATENCY.md) | Response-generation latency benchmark | `npm run eval:latency` |
| [DEPLOYED-LATENCY.md](backend/evaluation/DEPLOYED-LATENCY.md) | End-to-end latency against a deployed instance | `npm run eval:latency:deployed` |
| [CONCURRENCY.md](backend/evaluation/CONCURRENCY.md) | Behaviour under many simultaneous users | `npm run eval:concurrency` |
| [STT-WER.md](backend/evaluation/STT-WER.md) | Speech-to-text word error rate on DementiaBank recordings | `npm run eval:stt` |
| [SESSIONS.md](backend/evaluation/SESSIONS.md) | Full-session replay and opt-in live facilitator rotation | `npm run eval:sessions` |

The input files sit beside these documents: `scenarios.json`, `session-scenarios.json`, `models*.json` and `*-inputs.json`. Generated charts are in `figures/`, and `published/` holds dated result sets with their own READMEs. Raw evidence from runs stays local and is not committed.

Each command does a dry run unless live options are given.

---

## 12. Deployment

- **University server (production backend).** [`deployment/uoa-server/`](deployment/uoa-server/README.md) runs one backend worker under PM2, exposed through a Cloudflare Tunnel. A cron job deploys new commits on `main`. Each release installs dependencies, verifies Rhubarb, runs the backend tests and health-checks a candidate before switching over, and rolls back automatically on failure. It stays at one worker because speech-stream tokens are held in process memory.
- **Google Cloud Run (alternative).** [`cloudbuild.yaml`](cloudbuild.yaml) builds the backend with Cloud Buildpacks, with `REQUIRE_RHUBARB=1` set so a missing lip-sync binary fails the build, and updates the Cloud Run service. To confirm Rhubarb after deployment, request `GET /api/sessions/pipeline` and check for `"rhubarb":{"available":true,...}`.
- **Frontend.** `npm run build` produces a static site in `frontend/dist/`. Set `VITE_API_URL` at build time to the deployed API.

---

## 13. Adding a new session

1. Export the deck's slides to `frontend/public/slides/session<N>/slide-01.jpg`, `slide-02.jpg` and so on, numbered with no gaps.
2. Write the script in `backend/src/services/<topic>Script.js`. Use `buildStandardSessionOpening()` for the shared opening, and clone the closing steps from an existing session.
3. Register it in `cstScriptService.js`: add the import, the `scriptSlideFolders` entry and the `scripts.cst_<topic> = ...` line.
4. Write `backend/context/vCST_Session<N>_AI_Script.md`, with one `---` section per step in the same order, and register it in `SESSION_SCRIPTS` in `promptService.js`.
5. Add caregiver-recap entries for the new step IDs in `buildTopicSessionSummary` in `sessionOrchestratorService.js`.
6. Add the session card to `TEST_SESSIONS` in `frontend/src/App.jsx`.
7. Add a `<topic>.test.js` that checks the step count against the Markdown sections, the slide files, and the recap.

Keep script copy warm, brief, adult to adult and non-testing. Treat imaginative prompts as clearly hypothetical, for example "a dream house" rather than "your new house".

---

## 14. Further documentation

- [CLAUDE.md](CLAUDE.md) has detailed engineering notes on current behaviour: pipeline internals, interaction types, the memory-bank lifecycle and suggested next steps.
- [backend/evaluation/](backend/evaluation/README.md) has the evaluation protocols and results.
- [deployment/uoa-server/README.md](deployment/uoa-server/README.md) covers server operations.
- [frontend/public/audio/session4/README.md](frontend/public/audio/session4/README.md) lists the sources of the Session 4 audio clips.
