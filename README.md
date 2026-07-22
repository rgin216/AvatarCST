# AvatarCST

An AI-driven conversational system supporting elderly individuals through structured, Cognitive Stimulation Therapy (CST)-inspired interactions via voice, chat, and avatar.

## Project Overview

AvatarCST combines conversational AI with therapeutic structure to deliver:
- **Personalised sessions** with session-specific memory
- **Low-latency interaction** via voice and avatar
- **Caregiver insights** through session summaries
- **Accessible UX** designed for elderly users

## Tech Stack

### Frontend
- React 19 + Vite
- React Router
- Axios
- ESLint

### Backend
- Node.js + Express
- MongoDB (local dev, Atlas production)
- Mongoose
- Nodemon (dev)

### External Services (Integration Planned)
- OpenAI Realtime API (audio + text)
- HeyGen (avatar rendering)

## Project Structure

```
avatarcst/
├── frontend/          # React UI
│  ├── src/pages/      # Landing, Dashboard, Session
│  ├── src/components/ # UI components
│  └── src/services/   # API calls
├── backend/           # Express API
│  ├── src/models/     # Mongoose schemas
│  ├── src/routes/     # API endpoints
│  ├── src/controllers/ # Business logic
│  └── src/services/   # LLM, Avatar, Memory stubs
└── CLAUDE.md          # Architecture & phases
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`  
Backend runs on `http://localhost:5000`

### Cloud Run Rhubarb support

The backend's npm `postinstall` hook downloads the pinned Rhubarb Lip Sync 1.14.0
binary for Windows or Linux, verifies its SHA-256 checksum, extracts it into
`backend/vendor/rhubarb`, and runs `rhubarb --version` before completing.

For a Cloud Run source deployment, make Rhubarb a required build dependency so
the deployment fails instead of silently using audio-energy fallback when the
binary cannot be installed:

```bash
gcloud run deploy avatarcst-backend \
  --source ./backend \
  --region australia-southeast1 \
  --set-build-env-vars REQUIRE_RHUBARB=1
```

After deployment, request `GET /api/sessions/pipeline` and confirm the response
contains `"rhubarb":{"available":true,"source":"vendored"}`. A custom binary
can instead be selected at runtime with `RHUBARB_PATH`.

## Development Phases

- **Phase 1** ✅ Setup (repo, deps, basic server)
- **Phase 2** 🔄 Backend Foundation (MongoDB, models, controllers)
- **Phase 3** Frontend Foundation (pages, routing)
- **Phase 4** Core Functionality (sessions, messages)
- **Phase 5** AI Integration (OpenAI Realtime)
- **Phase 6** Avatar Integration (HeyGen)
- **Phase 7** Summaries (generation & display)
- **Phase 8** Caregiver Features (dashboard, analytics)

See [CLAUDE.md](./CLAUDE.md) for full architecture and decisions.

## API Keys

API keys are shared via Discord and loaded via `.env`:
- `OPENAI_API_KEY`
- `HEYGEN_API_KEY`

Never commit `.env` — use `.env.example` as a template.

## Next Steps

Currently in Phase 2 planning. Next: Set up MongoDB connection and build database models.

See CLAUDE.md Section 14 for detailed next steps. 
