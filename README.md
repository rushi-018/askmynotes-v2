# AskMyNotes — Subject-Scoped RAG Study Copilot

AskMyNotes lets students upload their notes (PDFs / TXT), chat with them using AI, generate quizzes, and interact via voice — all grounded strictly in their own material.

---

## Repository Structure

```
askmynotes-v2/
├── rag-service/              # AI / RAG backend (FastAPI, LlamaIndex, Qdrant)
│   ├── main.py               #   FastAPI app — /upload, /chat, /study_mode, /voice-chat, etc.
│   ├── rag_engine.py         #   Core RAG engine (LlamaIndex + Qdrant + OpenAI)
│   └── requirements.txt      #   Python dependencies
│
├── Version_1/                # Full-stack v1 (Auth + CRUD + React frontend)
│   ├── docker-compose.yml    #   Compose file (auth-backend + frontend)
│   ├── Backend/              #   Auth & user management API (FastAPI, PostgreSQL/Supabase)
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── auth/             #     JWT + Google OAuth helpers
│   │   ├── database/         #     SQLAlchemy + Supabase connection
│   │   ├── models/           #     ORM models
│   │   ├── router/           #     Route handlers (auth, chatbot, user)
│   │   ├── schemas/          #     Pydantic request/response schemas
│   │   └── utils/            #     Email / OTP helpers (SendGrid)
│   └── Frontend/             #   React + Vite UI
│       ├── src/
│       │   ├── pages/        #     Dashboard, Notes, StudyMode, SubjectHub, Auth pages
│       │   ├── components/   #     Chatbot, Sidebar, MainLayout
│       │   ├── api/          #     Axios config
│       │   └── utils/        #     Study tracker
│       └── ...
│
├── package.json              # Root dev orchestrator (runs all services via `npm run dev`)
├── PROJECT_DOCUMENTATION.md  # Full technical documentation
├── .env.example              # Environment variables template
└── .gitignore
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Qdrant](https://qdrant.tech/) running locally on port 6333 (`docker run -p 6333:6333 qdrant/qdrant`)
- OpenAI API key
- PostgreSQL / Supabase database (for Version_1 auth service)

### 1. Clone & install

```bash
git clone https://github.com/rushi-018/askmynotes-v2.git
cd askmynotes-v2
```

**RAG service dependencies:**
```bash
cd rag-service
python -m venv ../venv
../venv/Scripts/activate      # Windows
# source ../venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

**Frontend dependencies (Version_1):**
```bash
cd Version_1/Frontend
npm install
```

**Root orchestrator:**
```bash
npm install   # installs concurrently
```

### 2. Configure environment

Copy `.env.example` to `.env` at the repo root and fill in:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `QDRANT_HOST` | Qdrant host (default `localhost`) |
| `QDRANT_PORT` | Qdrant port (default `6333`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT secret |
| `SENDGRID_API_KEY` | SendGrid key for OTP emails |

### 3. Run all services

```bash
npm run dev
```

This starts three services concurrently:
| Service | Port | Command |
|---|---|---|
| RAG API | 8000 | `uvicorn main:app` inside `rag-service/` |
| Auth API | 8001 | `uvicorn main:app` inside `Version_1/Backend/` |
| Frontend | 5173 | `npm run dev` inside `Version_1/Frontend/` |

Or run individually:
```bash
npm run start:rag       # RAG backend only
npm run start:auth      # Auth backend only
npm run start:frontend  # React frontend only
```

---

## API Overview (RAG Service — port 8000)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF or TXT for a subject |
| `POST` | `/chat` | Ask a question scoped to a subject |
| `POST` | `/study_mode` | Generate quiz/MCQ questions |
| `POST` | `/voice-chat` | Voice input → RAG → streamed TTS audio |
| `GET` | `/files/{subject_id}` | List uploaded files for a subject |
| `GET` | `/subjects` | List all subjects with indexed notes |
| `DELETE` | `/reset` | Wipe the vector store |
| `GET` | `/health` | Liveness probe |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | OpenAI GPT-4o |
| **Embeddings** | OpenAI text-embedding-3-small (1536-dim) |
| **Vector DB** | Qdrant |
| **RAG Framework** | LlamaIndex 0.14 |
| **STT / TTS** | OpenAI Whisper-1 / TTS-1 |
| **PDF Parsing** | PyMuPDF |
| **API Framework** | FastAPI + Uvicorn |
| **Auth / DB (v1)** | JWT, Google OAuth, PostgreSQL/Supabase, SQLAlchemy |
| **Frontend** | React 18, Vite, Zustand |

---

For the full technical deep-dive see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).
