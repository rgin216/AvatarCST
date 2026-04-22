# AvatarCST – Project Context & Repository Plan

---

## 0. Current Status

**Phase:** Phase 1 ✅ → Phase 2 (Next)

### Completed
- Folder structure (frontend/backend) ✅
- Dependencies installed ✅
- Basic backend server running (port 5000) ✅
- Health endpoint (`/api/health`) ✅
- Frontend basic health check ✅
- Git initialized ✅

### Next Priority
- Phase 2: Backend Foundation
  - MongoDB local connection setup
  - Database models (User, Session, Message, Summary)
  - Controllers and routes scaffolding
  - Error handling middleware
  - `.env.example` template

---

## 1. Project Overview

AvatarCST is an AI-driven conversational system designed to support elderly individuals, particularly those experiencing cognitive decline, through structured, Cognitive Stimulation Therapy (CST)-inspired interactions.

The system aims to:
- Deliver structured, guided conversational sessions
- Maintain user-specific memory across sessions
- Provide personalised interactions (e.g. using name, preferences)
- Generate summaries for caregivers
- Enable accessible, low-latency interaction through voice and avatar

The system follows a real-time conversational pipeline:

User → Audio → LLM → Response → Avatar → User  
                              ↓  
                       Database

---

## 2. Key Objectives

### Functional Objectives
- Conversational AI delivering CST-inspired sessions
- Personalised interaction (name, preferences, cultural context)
- Persistent memory across sessions

### Performance Objectives
- Low latency (< 2–4 seconds)
- Efficient retrieval of session/memory data

### User Experience Objectives
- High satisfaction for elderly users
- Simple, intuitive interface
- Accessible interaction (voice + visual avatar)

---

## 3. System Architecture (High-Level)

### Core Components

#### Frontend (React)
- Landing page
- Dashboard / session start
- Session interface (chat + avatar)
- Caregiver summary views
- Accessibility controls

#### Backend (Node.js + Express)
- API layer
- Session management
- User profiles & caregiver relationships
- Memory/context handling
- Summary generation
- Integration with external services (LLM, avatar)

#### External Services
- Realtime LLM (audio + text processing)
- Avatar system (e.g. HeyGen)

#### Database (MongoDB)
- **Initial:** Local MongoDB for development/testing
- **Future:** MongoDB Atlas for production
- Data: User data, Sessions, Messages, Summaries, Memory (future)

---

## 4. Technology Stack

### Frontend
- React
- Vite
- React Router
- Axios

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- dotenv
- nodemon

### AI / Integrations
- OpenAI Realtime API (audio + text)
- Avatar API (e.g. HeyGen)
- **OpenAI Realtime API** (audio + text processing)
  - Integration points stubbed out initially
  - API keys will be shared via Discord (no repo storage)
- **Avatar system (HeyGen)**
  - Integration points stubbed out initially
  - API keys will be shared via Discord (no repo storage)

### Note on Python
Python is NOT included initially.

Reason:
- All required logic (prompting, memory injection, API calls) can be handled in Node
- Keeps architecture simple
- Can be added later if needed for:
  - advanced preprocessing
  - ML pipelines
  - embeddings/vector search

### Integration Approach
- Services will have **placeholder/stub implementations** initially
- Actual API integration deferred to Phase 5-6
- This allows Phase 2-4 to focus on backend structure & core conversation flow

## 5. Repository Structure

### Top-Level

avatarcst/
├─ frontend/
├─ backend/
├─ .gitignore
├─ README.md
└─ docker-compose.yml (optional)

---

## 6. Frontend Structure

frontend/
├─ public/
├─ src/
│  ├─ assets/
│  ├─ components/
│  │  ├─ layout/
│  │  ├─ ui/
│  │  └─ session/
│  ├─ pages/
│  │  ├─ LandingPage.jsx
│  │  ├─ DashboardPage.jsx
│  │  ├─ SessionPage.jsx
│  │  └─ CaregiverPage.jsx
│  ├─ hooks/
│  ├─ services/
│  │  ├─ api.js
│  │  ├─ sessionService.js
│  │  └─ summaryService.js
│  ├─ context/
│  ├─ utils/
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ routes.jsx
├─ .env.example
├─ package.json
└─ vite.config.js

### Responsibilities
- UI rendering
- User interaction
- Session interface
- Avatar display
- API communication

---

## 7. Backend Structure

backend/
├─ src/
│  ├─ config/
│  │  ├─ db.js
│  │  └─ env.js
│  ├─ controllers/
│  │  ├─ sessionController.js
│  │  ├─ summaryController.js
│  │  └─ healthController.js
│  ├─ routes/
│  │  ├─ sessionRoutes.js
│  │  ├─ summaryRoutes.js
│  │  └─ healthRoutes.js
│  ├─ services/
│  │  ├─ llmService.js
│  │  ├─ memoryService.js
│  │  ├─ summaryService.js
│  │  └─ avatarService.js
│  ├─ models/
│  │  ├─ User.js
│  │  ├─ Session.js
│  │  ├─ Message.js
│  │  └─ Summary.js
│  ├─ middleware/
│  │  ├─ errorHandler.js
│  │  └─ notFound.js
│  ├─ utils/
│  ├─ app.js
│  └─ server.js
├─ .env.example
├─ package.json
└─ nodemon.json

### Responsibilities
- Business logic
- Session orchestration
- Memory/context injection
- Database interaction
- External API integration

---

## 8. Data Model (Initial)

### Session
- id
- userId
- title
- startedAt
- endedAt
- status

### Message
- id
- sessionId
- role (user / assistant)
- content
- timestamp

### Summary
- id
- sessionId
- userId
- summaryText
- createdAt

### Future (Optiona ✅ COMPLETE
- Create repo structure ✅
- Initialise frontend and backend ✅
- Add basic configs (health endpoint) ✅
- Git initialization ✅

---

## 9. Development Phases

### Phase 1 – Setup
- Create repo structure
- Initialise frontend and backend
- Add basic configs
 🔄 NEXT
- Express server setup ✅ (partial)
- MongoDB connection (local for dev, Atlas later)
- Database models (User, Session, Message, Summary)
- Controllers (session, summary, health)
- Routes (session, summary)
- Error handling middleware
- `.env.example` template
- Stub services (LLM, Avatar, Memory)
- Basic error handling

### Phase 3 – Frontend Foundation
- Landing page
- Dashboard
- Session page
- API connectivity

### Phase 4 – Core Functionality
- Create session
- Store meOpenAI Realtime API
- Inject session context into prompts
- Generate conversational responses

### Phase 6 – Avatar Integration
- Connect HeyGen API
- Sync speech output + avatar animation
- Real-time audio/video streaming

### Phase 7 – Summaries
- Generate session summaries (backend)
- Store summaries in DB
- Display summaries to caregivers (frontend)

### Phase 8 – Caregiver Features (Future)
- Caregiver dashboard
- Session history & insights
- User preferences & management

---

## 10. Design Principles

### 1. Start Simple
Avoid overengineering. Focus on:
- working pipeline
- clean structure
- incremental features

### 2. Feature-Based Thinking
Structure code around:
- sessions
- conversations
- summaries
- users

### 3. Backend as Source of Truth
- All logic flows through backend
- Frontend stays thin

### 4. Expand Only When Needed
- Add Python or microservices later only if required

---

## 11. Literature Review Summary

### Dementia Context
- Increasing global prevalence
- Significant impact on cognition and quality of life
- Need for scalable, accessible interventions

### Cognitive Stimulation Therapy (CST)
- Evidence-based intervention
- Improves cognition and quality of life
- Typically delivered in structured group sessions

### Limitations of Traditional CST
- Requires trained facilitators
- Limited scalability
- Requires physical attendance
- Limited personalisation
- Hard to retain session-specific user details

### Digital Interventions
Examples include:
- ElliQ
- Sunny (Newdays)
- Other AI companions

Limitations:
- Often not structured like CST
- Lack therapeutic grounding
- Limited personalisation depth
- Weak long-term memory handling

### Role of AI and LLMs
- Enable natural conversation
- Context-aware responses
- Real-time interaction
- Potential to simulate structured therapy sessions

### Research Gap
Current systems:
- Are conversational but not therapeutic
- Lack CST structure
- Do not combine:
  - structured therapy
  - personal memory
  - real-time avatar interaction

### Proposed Contribution
AvatarCST aims to:
- Combine CST structure with AI conversation
- Deliver personalised sessions
- Provide continuity via memory
- Enable caregiver insights through summaries

---

## 12. Final Direction

The project will begin with:
- Simple 2-folder repo (frontend + backend)
- Node/Express backend only
- React frontends

### Immediate (Phase 2)
1. Set up local MongoDB connection
2. Create Mongoose models (User, Session, Message, Summary)
3. Build controllers & routes
4. Add error handling middleware
5. Create `.env.example` file
6. Stub out LLM & Avatar services (placeholder code)

### Then (Phase 3)
- Build frontend pages (Landing, Dashboard, Session, Caregiver)
- Add React Router setup
- Connect frontend to backend APIs

### Then (Phase 4+)
- Core conversation flow (store/retrieve messages)
- AI integration
- Avatar integration
- Summaries generation
- Caregiver features (future)
## 13. Collaboration & Key Decisions

### API Keys
- OpenAI Realtime API keys → shared via Discord
- HeyGen API keys → shared via Discord
- **No sensitive keys in repo** ✅

### Development Environment
- **Database:** Local MongoDB for dev/testing
- **Deployment:** MongoDB Atlas (future production)
- **Branching:** Feature branches, PR-based reviews

---

## 14. Next Steps

**Current focus:** Phase 2 – Backend Foundation (planning stage, no code yet)

Once Phase 2 is implemented:
1. Set up local MongoDB connection
2. Create Mongoose models (User, Session, Message, Summary)
3. Build controllers & routes
4. Add error handling middleware
5. Create `.env.example` file
6. Stub out LLM & Avatar services (placeholder code)

Then move to Phase 3 (Frontend Foundation) and Phase 4+ (Core Functionality)