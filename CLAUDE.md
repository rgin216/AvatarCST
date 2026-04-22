# AvatarCST – Project Context & Repository Plan

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
- User data
- Sessions
- Messages
- Summaries
- Memory (future)

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

### Note on Python
Python is NOT included initially.

Reason:
- All required logic (prompting, memory injection, API calls) can be handled in Node
- Keeps architecture simple
- Can be added later if needed for:
  - advanced preprocessing
  - ML pipelines
  - embeddings/vector search

---

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

### Future (Optional)
- Memory (long-term user context)
- Reminders
- Preferences

---

## 9. Development Phases

### Phase 1 – Setup
- Create repo structure
- Initialise frontend and backend
- Add basic configs

### Phase 2 – Backend Foundation
- Express server
- MongoDB connection
- Health route
- Basic error handling

### Phase 3 – Frontend Foundation
- Landing page
- Dashboard
- Session page
- API connectivity

### Phase 4 – Core Functionality
- Create session
- Store messages
- Retrieve messages
- Display conversation

### Phase 5 – AI Integration
- Connect to LLM
- Inject session context
- Generate responses

### Phase 6 – Avatar Integration
- Connect avatar API
- Sync speech + response

### Phase 7 – Summaries
- Generate session summaries
- Store summaries
- Display to caregivers

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
- React frontend
- MongoDB persistence
- External AI + avatar integrations

Focus:
→ Build a working end-to-end conversational system first  
→ Then iterate with smarter features

---

## 13. Next Step

Set up the repo with:
1. frontend (Vite + React)
2. backend (Express)
3. MongoDB connection
4. health endpoint
5. basic frontend-backend connection

Once done → move to session creation and message storage.