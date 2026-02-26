# AskMyNotes — Complete Project Documentation

> **AskMyNotes** is a Subject-Scoped RAG Study Copilot that lets students upload their notes (PDFs/TXT), chat with them using AI, generate quizzes, and even interact via voice — all grounded strictly in their own material.

---

## Table of Contents

1. [Full Technical Stack](#1-full-technical-stack)
2. [Technical Implementation](#2-technical-implementation)
3. [Architecture](#3-architecture)
4. [Workflow](#4-workflow)
5. [Features](#5-features)
6. [Unique Selling Points (USPs)](#6-unique-selling-points-usps)
7. [UI Workflow & Navigation](#7-ui-workflow--navigation)
8. [API Reference](#8-api-reference)
9. [Database Schema](#9-database-schema)
10. [Configuration & Environment](#10-configuration--environment)
11. [Dependency Versions](#11-dependency-versions)
12. [Project Structure](#12-project-structure)

---

## 1. Full Technical Stack

### Core AI / RAG Pipeline

| Component                   | Technology                    | Details                                                                        |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| **LLM (Primary)**           | OpenAI GPT-4o                 | Temperature 0.1 — used for chat answers, voice answers                         |
| **LLM (Quiz Gen)**          | OpenAI GPT-4o-mini            | Temperature 0.7 — used for study mode MCQ/short-answer generation              |
| **Embeddings**              | OpenAI text-embedding-3-small | 1536 dimensions                                                                |
| **Vector Database**         | Qdrant                        | Local Docker instance on port 6333, cosine similarity, collection `askmynotes` |
| **Orchestration Framework** | LlamaIndex 0.14.15            | VectorStoreIndex, SentenceSplitter, MetadataFilters                            |
| **Speech-to-Text**          | OpenAI Whisper-1              | Transcribes student voice input                                                |
| **Text-to-Speech**          | OpenAI TTS-1                  | Voice: "onyx", streams audio/mpeg response                                     |
| **PDF Parsing**             | PyMuPDF (fitz) 1.27.1         | Page-level text extraction                                                     |

### Backend Services

| Component            | Technology                                        | Details                                           |
| -------------------- | ------------------------------------------------- | ------------------------------------------------- |
| **RAG API Server**   | FastAPI 0.133.1 + Uvicorn 0.41.0                  | Port 8000, Python 3.13, auto-reload               |
| **Auth API Server**  | FastAPI + Uvicorn                                 | Port 8001, separate venv, auto-reload             |
| **Database**         | PostgreSQL (Supabase)                             | Cloud-hosted, accessed via SQLAlchemy + psycopg2  |
| **ORM**              | SQLAlchemy                                        | Declarative models, session-based                 |
| **Auth**             | JWT (python-jose, HS256) + Google OAuth (authlib) | 60-min token expiry                               |
| **Password Hashing** | passlib + bcrypt 4.0.1                            | Secure hashing for user passwords                 |
| **Email / OTP**      | SendGrid                                          | 6-digit OTP for password reset with 10-min expiry |
| **Validation**       | Pydantic v2                                       | Request/response models with strict validation    |

### Frontend

| Component            | Technology             | Details                                            |
| -------------------- | ---------------------- | -------------------------------------------------- |
| **Framework**        | React 19.2             | Functional components, hooks                       |
| **Build Tool**       | Vite 7.2.4             | Dev proxy, HMR, Tailwind plugin                    |
| **Styling**          | Tailwind CSS 4.1.17    | Utility-first, `@tailwindcss/vite` plugin          |
| **Routing**          | React Router DOM 7.9.6 | Nested routes, protected route wrapper             |
| **State Management** | Zustand 5.0.8          | Lightweight store for auth state                   |
| **Icons**            | Lucide React 0.554.0   | BookOpenCheck, Mic, Send, GraduationCap, etc.      |
| **JWT Decode**       | jwt-decode 4.0.0       | Client-side token parsing                          |
| **Local Storage**    | Custom studyTracker.js | Activity tracking (quizzes, chats, voice sessions) |

### Infrastructure / DevOps

| Component                | Technology              | Details                                                  |
| ------------------------ | ----------------------- | -------------------------------------------------------- |
| **Process Orchestrator** | concurrently 9.1.0      | Single `npm run dev` starts all 3 services               |
| **Containerization**     | Docker + docker-compose | Dockerfiles for frontend + auth backend                  |
| **Vector DB Container**  | Qdrant Docker           | Port 6333, local persistence in `qdrant_storage/`        |
| **Version Control**      | Git + GitHub            | Remote: `https://github.com/rushi-018/askmynotes-v2.git` |

### Port Summary

| Service                | Port         |
| ---------------------- | ------------ |
| RAG Backend (FastAPI)  | **8000**     |
| Auth Backend (FastAPI) | **8001**     |
| Frontend (Vite)        | **5173**     |
| Qdrant Vector DB       | **6333**     |
| PostgreSQL (Supabase)  | Cloud-hosted |

---

## 2. Technical Implementation

### 2.1 RAG Pipeline — Ingestion

The ingestion pipeline converts uploaded documents into searchable vector embeddings:

1. **File Upload** — Student uploads a PDF or TXT file via `POST /upload` with a `subject_id`.
2. **Validation** — File extension checked (`.pdf` / `.txt` only), empty-file guard, max 3 subjects enforced.
3. **Text Extraction** —
   - **PDF**: PyMuPDF (`fitz`) opens the byte stream and extracts text per page.
   - **TXT**: UTF-8 decode with error replacement.
4. **Paragraph-Based Splitting** — Text is split into paragraphs by detecting blank-line gaps (double newlines). Each paragraph retains metadata: `file_name`, `page_number`, `subject_id`, `line_start`, `line_end`.
5. **Chunk Splitting** — LlamaIndex's `SentenceSplitter` further splits long paragraphs with `chunk_size=256` tokens and `chunk_overlap=40` tokens.
6. **Embedding** — Each chunk is embedded using OpenAI `text-embedding-3-small` (1536 dimensions).
7. **Storage** — Vectors are upserted into the Qdrant collection `askmynotes` with full metadata payloads.

### 2.2 RAG Pipeline — Retrieval & Answer Generation

1. **Query Received** — `POST /chat` with `query`, `subject_id`, and optional `history`.
2. **Subject-Scoped Retrieval** — `VectorStoreIndex.from_vector_store()` with `MetadataFilters` on `subject_id` (exact equality match). `similarity_top_k=8` retrieves the 8 most relevant chunks.
3. **Similarity Gate** — Only chunks with `score >= 0.15` pass through. If no chunks pass, returns a "not found in your notes" response.
4. **Context Assembly** — Passing chunks are formatted as:
   ```
   --- Source: [filename.pdf, Page 3, Lines 10-25] ---
   <chunk text>
   ```
5. **Conversation History** — Last 6 messages from the history array are injected for multi-turn context.
6. **System Prompt** — Enforces STRICT context-only answering with inline citations in `[File Name, Page X]` format. The LLM is instructed to say "I couldn't find this in your uploaded notes" if the answer isn't in context.
7. **LLM Generation** — GPT-4o (temperature 0.1) generates the answer.
8. **Confidence Scoring** — Based on average similarity score of retrieved chunks:
   - `≥ 0.75` → **High**
   - `≥ 0.40` → **Medium**
   - `< 0.40` → **Low**
9. **Citation Extraction** — Each source chunk is returned as a `Citation` object with file name, page number, line range, relevance score, and chunk text.

### 2.3 Voice Chat Pipeline (STT → RAG → TTS)

A complete voice interaction loop:

1. **Speech-to-Text** — Audio file (WebM from browser MediaRecorder) sent to OpenAI Whisper-1 for transcription.
2. **RAG Retrieval** — Same retrieval pipeline as text chat (subject-scoped, top-8, similarity gate).
3. **Voice-Optimized Prompt** — System prompt instructs the LLM to respond conversationally "as if reading aloud to a student" — no markdown, no bullet points, references sources naturally.
4. **Text-to-Speech** — GPT-4o answer text sent to OpenAI TTS-1 (voice: "onyx"). Audio streamed as `audio/mpeg` chunks (4096 bytes each).
5. **Response Delivery** — `StreamingResponse` body carries audio; headers carry URL-encoded metadata: `X-Transcript`, `X-Answer`, `X-Citations` (JSON), `X-Confidence`.

### 2.4 Study Mode — Quiz Generation

1. **Content Sampling** — Qdrant `scroll()` fetches up to 100 chunks for the subject. A random sample of 10 chunks is selected.
2. **Prompt Engineering** — GPT-4o-mini (temperature 0.7 for variety) is prompted to generate:
   - **5 Multiple Choice Questions** — 4 options each (A/B/C/D), correct answer letter, explanation, and source citation
   - **3 Short Answer Questions** — Expected answer and source citation
3. **JSON Parsing** — Response is parsed from JSON, with fallback stripping of markdown code fences. On parse failure, raw response is returned for debugging.
4. **Frontend Rendering** — MCQs rendered as clickable option cards with immediate correct/incorrect feedback (green/red highlighting). Short answers provide a toggleable "Model Answer" reveal.

### 2.5 Authentication System

- **Registration**: Email + password signup. Password hashed with bcrypt via passlib.
- **Login**: Email/password → JWT (HS256) with 60-minute expiry. Token stored in `localStorage`.
- **Google OAuth**: Popup-based flow. `authlib` handles OIDC discovery. Callback returns JWT via `window.postMessage` to parent window.
- **Password Reset**: Forgot password → 6-digit OTP sent via SendGrid → OTP verification → New password set. OTP stored in DB with 10-min expiry.
- **Session Protection**: `ProtectedRoute` component checks Zustand auth state; redirects to `/login` if unauthenticated. JWT expiry validated client-side on app load.

### 2.6 Study Activity Tracking

Client-side activity tracking via localStorage (key: `askmynotes_study_activity`):

- **Events Tracked**: Quiz generation, text chat messages, voice chat sessions — per subject
- **Data Structure**: `{ [subjectId]: { quizzes: N, chats: N, voices: N, lastStudied: timestamp } }`
- **Dashboard Integration**: Study Readiness progress bars show `totalInteractions / 10 * 100%` with color-coded bars (orange → yellow → green), breakdown of quizzes vs chats, and "last studied" timestamps.

---

## 3. Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │           React 19 + Vite 7 + Tailwind CSS 4                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │Dashboard │ │ SubjectHub│ │StudyMode │ │  MyNotes      │  │   │
│  │  │  Page    │ │ (Chat+   │ │ (Quiz    │ │  (Upload      │  │   │
│  │  │          │ │  Voice)  │ │  Gen)    │ │   Manager)    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │   │
│  │  │ Zustand Auth │  │ studyTracker │  │ Floating Chatbot│   │   │
│  │  │    Store     │  │ (localStorage)│  │   (General AI)  │   │   │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                    Vite Dev Proxy (port 5173)                       │
│              /api/auth,users,chat → :8001                           │
│              /upload,chat,voice-chat,study_mode → :8000             │
└──────────────────────┬─────────────────────┬───────────────────────┘
                       │                     │
          ┌────────────▼──────────┐ ┌────────▼──────────────────┐
          │   AUTH BACKEND        │ │   RAG BACKEND             │
          │   FastAPI :8001       │ │   FastAPI :8000            │
          │                       │ │                            │
          │ ┌───────────────────┐ │ │ ┌────────────────────────┐│
          │ │ JWT Auth (HS256)  │ │ │ │    RAGEngine Class     ││
          │ │ Google OAuth      │ │ │ │                        ││
          │ │ Password Reset    │ │ │ │ ┌─────────┐ ┌───────┐ ││
          │ │ (SendGrid OTP)   │ │ │ │ │ Ingest  │ │ Chat  │ ││
          │ └───────────────────┘ │ │ │ │ (PDF/   │ │ (RAG  │ ││
          │ ┌───────────────────┐ │ │ │ │  TXT)   │ │ Q&A)  │ ││
          │ │ User CRUD         │ │ │ │ └─────────┘ └───────┘ ││
          │ │ Profile Mgmt      │ │ │ │ ┌─────────┐ ┌───────┐ ││
          │ └───────────────────┘ │ │ │ │ Voice   │ │ Study │ ││
          │ ┌───────────────────┐ │ │ │ │ Chat    │ │ Mode  │ ││
          │ │ Gemini Chatbot    │ │ │ │ │(STT→RAG │ │(MCQ + │ ││
          │ │ (Supabase Vectors)│ │ │ │ │  →TTS)  │ │ Short)│ ││
          │ └───────────────────┘ │ │ │ └─────────┘ └───────┘ ││
          └───────────┬───────────┘ │ └────────────────────────┘│
                      │             └──────────┬────────────────┘
                      │                        │
          ┌───────────▼───────────┐ ┌──────────▼────────────────┐
          │   PostgreSQL          │ │     Qdrant Vector DB      │
          │   (Supabase Cloud)    │ │     Docker :6333          │
          │                       │ │                            │
          │ Tables:               │ │ Collection: askmynotes    │
          │  • users              │ │  • 1536-dim vectors       │
          │  • subjects           │ │  • Cosine similarity      │
          │  • notes              │ │  • Subject metadata       │
          └───────────────────────┘ │  • File/page metadata     │
                                    └───────────────────────────┘
                                               │
                                    ┌──────────▼────────────────┐
                                    │      OpenAI APIs          │
                                    │  • GPT-4o (chat/voice)    │
                                    │  • GPT-4o-mini (quizzes)  │
                                    │  • text-embedding-3-small │
                                    │  • Whisper-1 (STT)        │
                                    │  • TTS-1 voice "onyx"     │
                                    └───────────────────────────┘
```

### 3.2 Data Flow Architecture

```
Student uploads PDF/TXT
        │
        ▼
  ┌─────────────┐     ┌───────────────┐     ┌──────────────┐
  │ PyMuPDF /   │ ──▶ │ Paragraph     │ ──▶ │ Sentence     │
  │ UTF-8 Parse │     │ Splitter      │     │ Splitter     │
  └─────────────┘     │ (blank lines) │     │ (256 tokens, │
                      └───────────────┘     │  40 overlap) │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                      ┌────────────────────┐
                                      │ OpenAI Embedding    │
                                      │ text-embedding-3-   │
                                      │ small (1536-dim)    │
                                      └────────┬───────────┘
                                               │
                                               ▼
                                      ┌────────────────────┐
                                      │   Qdrant Vector    │
                                      │   Store (upsert)   │
                                      │   with metadata    │
                                      └────────────────────┘

Student asks a question
        │
        ▼
  ┌─────────────┐     ┌───────────────┐     ┌──────────────┐
  │ Embed Query  │ ──▶ │ Qdrant Search │ ──▶ │ Similarity   │
  │              │     │ (subject_id   │     │ Gate (≥0.15) │
  │              │     │  filter, k=8) │     │              │
  └─────────────┘     └───────────────┘     └──────┬───────┘
                                                   │
                                                   ▼
                                      ┌────────────────────┐
                                      │ GPT-4o Generation  │
                                      │ (context + history │
                                      │  + system prompt)  │
                                      └────────┬───────────┘
                                               │
                                               ▼
                                      ┌────────────────────┐
                                      │ Answer + Citations │
                                      │ + Confidence Score │
                                      └────────────────────┘
```

### 3.3 Microservice Boundaries

The application follows a **microservice-like architecture** with clear separation:

| Service          | Responsibility                                      | Coupled To              |
| ---------------- | --------------------------------------------------- | ----------------------- |
| **RAG Backend**  | Document ingestion, retrieval, chat, voice, quizzes | Qdrant, OpenAI          |
| **Auth Backend** | User management, authentication, authorization      | PostgreSQL (Supabase)   |
| **Frontend**     | UI rendering, state management, API orchestration   | Both backends via proxy |

Services communicate exclusively over HTTP REST. The Vite dev proxy unifies the two backends behind a single origin for the frontend.

---

## 4. Workflow

### 4.1 Student Onboarding Workflow

```
1. Student visits Landing Page (/)
2. Signs up via email/password OR Google OAuth
3. Logs in → JWT token stored in localStorage
4. Redirected to Dashboard (/app/dashboard)
5. Navigates to My Notes (/app/notes)
6. Uploads PDF/TXT files organized by subject (max 3 subjects)
7. Returns to Dashboard to see subjects populated
```

### 4.2 Study Workflow — Text Chat

```
1. Student navigates to "Chat with Notes" (/app/hub)
2. Selects a subject from the dropdown (fetched from GET /subjects)
3. Types a question in the chat input
4. Frontend sends POST /chat with { query, subject_id, history }
5. RAG backend retrieves relevant chunks, generates answer with GPT-4o
6. Answer displayed as chat bubble with:
   - Confidence badge (High/Medium/Low)
   - "View Sources" button revealing citations
7. Right sidebar shows Grounding Evidence:
   - File name, page number, text snippet, relevance score bar
8. Conversation continues with multi-turn context (last 6 messages)
9. Study activity recorded in localStorage via studyTracker
```

### 4.3 Study Workflow — Voice Chat

```
1. Student is on the SubjectHub (/app/hub) with a subject selected
2. Clicks the microphone button → browser starts recording (MediaRecorder API)
3. Speaks their question → clicks stop
4. Audio (WebM) sent via POST /voice-chat with { audio_file, subject_id, history }
5. Backend pipeline:
   a. Whisper-1 transcribes audio → text
   b. RAG retrieval (same as text chat)
   c. GPT-4o generates conversational answer
   d. TTS-1 converts answer to speech (voice: "onyx")
6. Frontend receives:
   - Audio stream → plays via HTML5 Audio
   - Headers: transcript text, answer text, citations, confidence
7. Both question transcript and answer displayed in chat
8. Voice activity recorded in localStorage
```

### 4.4 Study Workflow — Quiz Mode

```
1. Student navigates to "Study Mode" (/app/study)
2. Selects a subject from the dropdown
3. Clicks "Generate Questions"
4. Frontend sends POST /study_mode with { subject_id }
5. Backend samples 10 random chunks, sends to GPT-4o-mini
6. Returns 5 MCQs + 3 Short Answer questions
7. MCQ interaction:
   a. Student clicks an option (A/B/C/D)
   b. Immediate feedback — correct (green) / incorrect (red)
   c. Explanation revealed below the question
   d. Citation shown for each question
8. Short Answer interaction:
   a. Student writes answer in textarea
   b. Toggles "Model Answer" to compare
   c. Citation shown for reference
9. "Reset Session" clears all selections for retry
10. Quiz generation recorded in localStorage
```

### 4.5 File Management Workflow

```
1. Navigate to My Notes (/app/notes)
2. Create a subject slot (type name, click create)
3. Upload files via:
   - Click to browse (file picker)
   - Drag-and-drop onto upload zone
4. Accepted formats: .pdf, .txt
5. Max 3 subjects enforced (client + server)
6. Upload progress shown per file
7. Files listed under each subject with metadata
8. Dashboard reflects updated subjects and file counts
```

### 4.6 Password Reset Workflow

```
1. Login page → "Forgot?" link → /forgot-email
2. Enter email → "Send OTP" → /verify-otp
3. Enter 6-digit OTP (auto-focus next digit) → "Verify OTP" → /reset-password
4. Enter new password (min 8 chars) + confirm → Submit
5. Redirected to /login
```

---

## 5. Features

### 5.1 Core Features

| #   | Feature                           | Description                                                                                                   |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **Subject-Scoped RAG Chat**       | Ask questions grounded strictly in YOUR uploaded notes. Answers cite specific files, pages, and line numbers. |
| 2   | **Voice Chat (Spoken Teacher)**   | Full voice loop: speak your question → hear the AI answer read aloud. Uses Whisper STT + GPT-4o + TTS-1.      |
| 3   | **AI Quiz Generation**            | Auto-generates 5 MCQs + 3 short-answer questions from your notes. Immediate feedback with explanations.       |
| 4   | **Multi-Subject Organization**    | Upload notes organized by up to 3 subjects. Each subject has its own isolated knowledge base.                 |
| 5   | **PDF & TXT Upload**              | Support for PDF (multi-page, PyMuPDF) and plain text files. Paragraph-based chunking preserves context.       |
| 6   | **Citation & Grounding Evidence** | Every answer shows source citations with file name, page number, line range, chunk text, and relevance score. |
| 7   | **Confidence Scoring**            | Each response rated High/Medium/Low confidence based on retrieval similarity scores.                          |
| 8   | **Refusal Guard**                 | If the answer isn't in the student's notes, the system explicitly says so instead of hallucinating.           |
| 9   | **Study Activity Tracking**       | Dashboard tracks quiz generations, chat messages, and voice sessions per subject over time.                   |
| 10  | **Multi-Turn Conversations**      | Chat maintains conversation context (last 6 messages) for follow-up questions.                                |

### 5.2 Authentication Features

| #   | Feature                    | Description                                                                    |
| --- | -------------------------- | ------------------------------------------------------------------------------ |
| 11  | **Email/Password Auth**    | Secure registration and login with bcrypt password hashing and JWT tokens.     |
| 12  | **Google OAuth**           | One-click Google Sign-In via popup flow with OIDC.                             |
| 13  | **Password Reset via OTP** | 6-digit OTP sent to email via SendGrid with 10-minute expiry.                  |
| 14  | **Protected Routes**       | All app pages require authentication; auto-redirect to login if token expired. |

### 5.3 UI/UX Features

| #   | Feature                       | Description                                                                                               |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| 15  | **Floating AI Assistant**     | Always-available chatbot widget (bottom-right) for general AI questions across any page.                  |
| 16  | **Split-Pane Chat View**      | Chat on the left, grounding evidence sidebar on the right — simultaneous Q&A and source verification.     |
| 17  | **Interactive Quiz Cards**    | Click-to-answer MCQs with color-coded feedback (green/red), explanation reveals, and citation references. |
| 18  | **Drag-and-Drop Upload**      | File upload zones support both click-to-browse and drag-and-drop.                                         |
| 19  | **Study Readiness Dashboard** | Visual progress bars showing preparation level per subject with activity breakdowns.                      |
| 20  | **Dark Sidebar Navigation**   | Persistent sidebar with workspace and learning hub sections, active state highlighting.                   |

---

## 6. Unique Selling Points (USPs)

### USP 1: Subject-Scoped RAG — "Chat with YOUR Notes, Not the Internet"

Unlike general-purpose AI chatbots (ChatGPT, Gemini), AskMyNotes **only answers from the student's own uploaded material**. Every response is grounded in the student's notes with verifiable citations. This eliminates hallucination about topics outside the student's curriculum and ensures exam-relevant answers.

### USP 2: Complete Voice Interaction Loop (Spoken Teacher)

A full **STT → RAG → TTS** pipeline creates a hands-free study experience. Students can speak questions naturally and hear AI-generated answers read aloud — like having a personal tutor reading from their notes. This is especially valuable for:

- Students with visual impairments
- Learning while commuting or exercising
- Auditory learners who retain more through listening

### USP 3: AI-Generated Quizzes from Your Own Notes

Study mode generates **contextual MCQs and short-answer questions** directly from the student's uploaded material. Questions come with explanations and source citations, enabling:

- Self-assessment before exams
- Active recall practice (proven study technique)
- Understanding where specific topics appear in their notes

### USP 4: Refusal Guard — Honest "I Don't Know"

The system is engineered to **refuse to answer** when information isn't found in the student's notes, rather than fabricating plausible-sounding but incorrect answers. This builds trust and ensures students don't study wrong information.

### USP 5: Multi-Subject Knowledge Isolation

Each subject maintains a **completely isolated vector knowledge base**. Organic Chemistry notes won't contaminate Physics answers. Students can switch between subjects and always get scoped, relevant responses.

### USP 6: Transparent Grounding Evidence Panel

The split-pane UI shows **grounding evidence in real-time** alongside every answer — file names, page numbers, exact text snippets, and relevance scores. Students can verify every claim the AI makes.

### USP 7: Study Activity-Based Readiness Tracking

Study readiness is not based on arbitrary metrics but on **actual study interactions** — quiz sessions taken, chat questions asked, voice conversations held. This gives students a meaningful, effort-based preparation gauge.

### USP 8: Paragraph-Aware Chunking

Instead of blind fixed-size splitting, the ingestion pipeline **respects paragraph boundaries** in documents before applying sentence splitting. This preserves the semantic coherence of notes, leading to better retrieval quality.

---

## 7. UI Workflow & Navigation

### 7.1 Navigation Map

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC ROUTES                             │
│                                                             │
│  Landing Page (/)                                           │
│       │                                                     │
│       ├──▶ Login (/login)                                   │
│       │      ├── Email/Password login                       │
│       │      ├── Google OAuth (popup)                       │
│       │      ├── "Forgot?" ──▶ Forgot Email (/forgot-email) │
│       │      │                    │                          │
│       │      │              Verify OTP (/verify-otp)        │
│       │      │                    │                          │
│       │      │              Reset Password (/reset-password) │
│       │      │                    │                          │
│       │      │              ◀─── Back to Login               │
│       │      │                                              │
│       │      └── On success ──▶ /app/dashboard              │
│       │                                                     │
│       └──▶ Signup (/signup)                                 │
│              ├── Email/Password registration                │
│              ├── Google OAuth (popup)                        │
│              └── On success ──▶ /login                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               PROTECTED APP SHELL (/app)                    │
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │             │  │                                      │  │
│  │  Sidebar    │  │   Main Content Area                  │  │
│  │  (w-72)     │  │   (Scrollable)                       │  │
│  │             │  │                                      │  │
│  │ ┌─────────┐ │  │  ┌──────────────────────────────┐   │  │
│  │ │AskMyNote│ │  │  │  Dashboard (/app/dashboard)   │   │  │
│  │ │  Logo   │ │  │  │  • Welcome message            │   │  │
│  │ └─────────┘ │  │  │  • Subject cards (3 slots)    │   │  │
│  │             │  │  │  • Study Readiness bars        │   │  │
│  │ WORKSPACE   │  │  │  • Quick Actions panel         │   │  │
│  │ ○ Dashboard │  │  └──────────────────────────────┘   │  │
│  │ ○ My Notes  │  │                                      │  │
│  │             │  │  ┌──────────────────────────────┐   │  │
│  │ LEARNING    │  │  │  My Notes (/app/notes)        │   │  │
│  │ ○ Chat with │  │  │  • Subject manager            │   │  │
│  │   Notes 🎤  │  │  │  • Drag-drop upload zones     │   │  │
│  │ ○ Study     │  │  │  • File listings per subject  │   │  │
│  │   Mode      │  │  └──────────────────────────────┘   │  │
│  │             │  │                                      │  │
│  │ ───────── │  │  ┌──────────────────────────────┐   │  │
│  │ ○ Profile   │  │  │  Chat with Notes (/app/hub)   │   │  │
│  │ ○ Logout    │  │  │  ┌────────────┬───────────┐   │   │  │
│  │             │  │  │  │ Chat Area  │ Evidence  │   │   │  │
│  └─────────────┘  │  │  │ • Subject  │ Sidebar   │   │   │  │
│                   │  │  │   dropdown │ • Sources  │   │   │  │
│                   │  │  │ • Text     │ • Scores   │   │   │  │
│                   │  │  │   input    │ • Snippets │   │   │  │
│                   │  │  │ • Mic btn  │           │   │   │  │
│                   │  │  │ • Messages │           │   │   │  │
│                   │  │  └────────────┴───────────┘   │   │  │
│                   │  └──────────────────────────────┘   │  │
│                   │                                      │  │
│                   │  ┌──────────────────────────────┐   │  │
│                   │  │  Study Mode (/app/study)      │   │  │
│                   │  │  • Subject dropdown            │   │  │
│                   │  │  • Generate Questions btn      │   │  │
│                   │  │  • MCQ tab / Short Answer tab  │   │  │
│                   │  │  • Interactive answer cards    │   │  │
│                   │  └──────────────────────────────┘   │  │
│                   │                                      │  │
│                   │  ┌──────────────────────────────┐   │  │
│                   │  │  Profile (/app/profile)       │   │  │
│                   │  │  • Avatar + name              │   │  │
│                   │  │  • Edit full name             │   │  │
│                   │  │  • Preferences (lang, voice)  │   │  │
│                   │  └──────────────────────────────┘   │  │
│                   │                                      │  │
│                   │  ┌─────────────────┐                │  │
│                   │  │ Floating Chatbot │ (bottom-right) │  │
│                   │  │ • FAB toggle     │                │  │
│                   │  │ • General AI Q&A │                │  │
│                   │  └─────────────────┘                │  │
│                   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Page-by-Page UI Description

#### Landing Page (`/`)

- **Header**: Fixed navbar — Logo ("AskMyNotes"), nav links (How it Works, Features), Login/Signup buttons
- **Hero Section**: Large tagline "Chat with your notes, Not the internet." with gradient text accent. CTA button to signup.
- **How it Works**: 3-column grid — (1) Upload Sources (2) Scoped Q&A (3) Study Mode. Each with icon and description.
- **Feature Highlight**: "Spoken Teacher" section on dark background — voice interaction demo area.
- **Footer**: Copyright with year.

#### Login Page (`/login`)

- **Background**: Dark slate-900 with animated green blob gradients (8s infinite animation).
- **Card**: Centered rounded card with BookOpenCheck logo, title "Command Center Access".
- **Form**: Email + Password inputs (pre-filled defaults), "Authorize Entry" green button.
- **OAuth**: "Access via Google" button with separator lines.
- **Links**: "Forgot?" → forgot-email, "Create Account" → signup.

#### Signup Page (`/signup`)

- **Same dark aesthetic** as Login.
- **Form**: Full Name + Email + Password (min 5 chars).
- **Validation**: Client-side password length check.
- **OAuth**: Google signup button with popup flow.
- **Redirect**: Success message → `/login` after 2 seconds.

#### Dashboard Page (`/app/dashboard`)

- **Welcome Banner**: "Welcome back, {firstName}!" with "Manage Notes" button.
- **Subject Grid**: 3 cards (empty slots shown as dashed-border placeholders):
  - Subject name
  - File count
  - "Ready" (green) / "Pending" (amber) badge
  - "Open Hub" → `/app/hub`
  - "Study" → `/app/study`
- **Study Readiness**: Progress bars per subject:
  - Total interactions / 10 target = percentage
  - Color: orange (< 30%), yellow (30-70%), green (> 70%)
  - Label: "X quizzes · Y chats"
  - Last studied timestamp
  - Status: "Not started yet" / "X more to go" / "Well prepared!"
- **Quick Actions**: Button grid for common tasks.

#### My Notes Page (`/app/notes`)

- **Subject Cards**: Each with upload zone (drag-and-drop + browse), file list.
- **New Subject**: Input + "Create" button (max 3 enforced).
- **Upload**: POST to `/upload` with FormData. Progress indicators per file.
- **File Display**: Listed under each subject with file names.

#### SubjectHub — Chat with Notes (`/app/hub`)

- **Header**: Subject dropdown selector (fetched from GET /subjects).
- **Left Pane (Chat)**:
  - Message bubbles: green (user), slate (assistant).
  - Text input + Send button.
  - Microphone button for voice recording.
  - Voice recording indicator with stop button.
  - Loading spinner during processing.
  - Confidence badge on each bot message.
  - "View Sources" toggle per message.
- **Right Pane (Grounding Evidence)**:
  - Dark (slate-900) sidebar, 320px wide.
  - Title: "Grounding Evidence".
  - Cards per citation: file name, page number, text snippet, relevance score bar.
  - Footer: "Refusal Guard: AI only answers from your notes."

#### Study Mode (`/app/study`)

- **Header**: Subject dropdown + "Generate Questions" button (green, with GraduationCap icon).
- **Loading State**: Spinner + "Generating" message.
- **Tab Navigation**: MCQs | Short Answer.
- **MCQ Cards**:
  - Question text with question number.
  - 4 clickable option buttons (A/B/C/D).
  - On click: selected option highlighted green (correct) or red (incorrect), correct answer always shown green.
  - Explanation text revealed.
  - Citation source shown below.
- **Short Answer Cards**:
  - Question text.
  - Textarea for student response.
  - "Show Model Answer" toggle button.
  - Model answer in dark card.
  - Citation shown.
- **Reset Session**: Button to clear all answers and start over.

#### Profile (`/app/profile`)

- **Banner**: Gradient header with avatar (first letter of name).
- **Form**: Full name (editable), email (disabled).
- **Preferences**: Language selector, voice toggle, teacher persona dropdown.
- **Edit/Save**: Toggle between view and edit mode.

### 7.3 Color System

| Element                 | Color(s)                              |
| ----------------------- | ------------------------------------- |
| Primary Accent          | Green-600 (`#16a34a`)                 |
| Sidebar Background      | Gradient: slate-900 → green-950       |
| Active Nav Item         | `bg-green-600 text-white`             |
| Login/Signup Background | `slate-900` with green animated blobs |
| User Chat Bubbles       | Green-600 with white text             |
| Bot Chat Bubbles        | Slate-50 with slate border            |
| Evidence Sidebar        | Slate-900 with slate-800 cards        |
| Confidence High         | Green-100 bg, green-700 text          |
| Confidence Medium       | Yellow-100 bg, yellow-700 text        |
| Confidence Low          | Orange-100 bg, orange-700 text        |
| MCQ Correct             | Green highlight                       |
| MCQ Incorrect           | Red highlight                         |
| Password Reset Pages    | Blue-700 → blue-900 gradient          |
| Floating Chatbot        | Blue-600 header + FAB                 |

### 7.4 Icons Used (Lucide React)

`BookOpenCheck`, `GraduationCap`, `Mic`, `MicOff`, `Send`, `MessageCircle`, `Upload`, `FileText`, `Brain`, `Shield`, `ShieldCheck`, `ChevronDown`, `ChevronRight`, `X`, `User`, `LogOut`, `LayoutDashboard`, `FolderOpen`, `Settings`, `Eye`, `EyeOff`, `Check`, `AlertCircle`, `Clock`, `Volume2`, `Sparkles`

---

## 8. API Reference

### 8.1 RAG Backend (Port 8000)

#### `POST /upload`

Upload a document to a subject's knowledge base.

**Request**: `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF or TXT file |
| `subject_id` | string | Yes | Subject identifier |

**Response** (`200 OK`):

```json
{
  "message": "Successfully processed filename.pdf",
  "file_name": "filename.pdf",
  "subject_id": "organic_chemistry",
  "pages_processed": 12,
  "chunks_created": 47
}
```

**Errors**: `400` (invalid extension, empty file, max subjects reached), `500` (processing error)

---

#### `POST /chat`

Ask a question grounded in a subject's notes.

**Request**: `application/json`

```json
{
  "query": "What is the mechanism of SN2 reaction?",
  "subject_id": "organic_chemistry",
  "history": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer" }
  ]
}
```

**Response** (`200 OK`):

```json
{
  "answer": "The SN2 reaction proceeds via a single concerted step...",
  "citations": [
    {
      "file_name": "chapter5.pdf",
      "page_number": 23,
      "line_start": 10,
      "line_end": 25,
      "subject_id": "organic_chemistry",
      "relevance_score": 0.87,
      "chunk_text": "In the SN2 mechanism, the nucleophile attacks..."
    }
  ],
  "confidence": "High"
}
```

---

#### `POST /voice-chat`

Voice-based RAG interaction (STT → RAG → TTS).

**Request**: `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio_file` | File | Yes | Audio recording (WebM, etc.) |
| `subject_id` | string | Yes | Subject identifier |
| `history` | string | No | JSON string of chat history |

**Response**: `StreamingResponse` (`audio/mpeg`)

- **Body**: Audio stream of the spoken answer
- **Headers**:
  - `X-Transcript`: URL-encoded transcription of the student's question
  - `X-Answer`: URL-encoded text of the AI's answer
  - `X-Citations`: URL-encoded JSON array of citations
  - `X-Confidence`: "High", "Medium", or "Low"

---

#### `POST /study_mode`

Generate quiz questions from a subject's notes.

**Request**: `application/json`

```json
{
  "subject_id": "organic_chemistry"
}
```

**Response** (`200 OK`):

```json
{
  "subject_id": "organic_chemistry",
  "mcqs": [
    {
      "question": "Which type of reaction involves...",
      "options": ["A) SN1", "B) SN2", "C) E1", "D) E2"],
      "correct_answer": "B",
      "explanation": "SN2 reactions involve...",
      "citation": "chapter5.pdf, Page 23"
    }
  ],
  "short_answer": [
    {
      "question": "Explain the difference between...",
      "expected_answer": "SN1 reactions proceed via...",
      "citation": "chapter5.pdf, Page 25"
    }
  ],
  "error": null,
  "raw_response": null
}
```

---

#### `GET /files/{subject_id}`

List files indexed for a subject.

**Response** (`200 OK`):

```json
{
  "subject_id": "organic_chemistry",
  "files": ["chapter5.pdf", "notes.txt"],
  "chunk_count": 47
}
```

---

#### `GET /subjects`

List all subjects with indexed content.

**Response** (`200 OK`):

```json
{
  "subjects": ["organic_chemistry", "atomic_structure", "chemical_bonding"]
}
```

---

#### `DELETE /reset`

Delete all indexed data (wipes vector store).

**Response** (`200 OK`):

```json
{
  "message": "All data has been reset successfully"
}
```

---

#### `GET /health`

Health check endpoint.

**Response** (`200 OK`):

```json
{
  "status": "ok"
}
```

---

### 8.2 Auth Backend (Port 8001)

#### `POST /api/auth/login`

Authenticate user with email/password.

**Request**: `application/x-www-form-urlencoded` (OAuth2 form)
| Field | Required | Description |
|-------|----------|-------------|
| `username` | Yes | User email |
| `password` | Yes | User password |

**Response**: `{ "access_token": "...", "token_type": "bearer", "user": { ... } }`

---

#### `GET /api/auth/login/google`

Initiate Google OAuth login flow (redirects to Google).

---

#### `GET /api/auth/google/callback`

Handle Google OAuth callback. Returns HTML that sends JWT via `window.postMessage` to parent window.

---

#### `POST /api/auth/forgot-password`

Send password reset OTP via email.

**Request**: `{ "email": "user@example.com" }`

---

#### `POST /api/auth/verify-otp`

Verify the 6-digit OTP.

**Request**: `{ "email": "user@example.com", "otp": "123456" }`

---

#### `POST /api/auth/reset-password`

Reset password with valid OTP.

**Request**: `{ "email": "user@example.com", "otp": "123456", "new_password": "newpass" }`

---

#### `POST /api/users/`

Register a new user.

**Request**: `{ "email": "user@example.com", "full_name": "John Doe", "password": "securepass" }`

**Response**: `{ "id": 1, "email": "...", "full_name": "...", "created_at": "..." }`

---

#### `GET /api/users/me`

Get authenticated user's profile (requires Bearer token).

---

#### `PUT /api/users/me`

Update authenticated user's profile (only `full_name` editable).

---

#### `POST /api/chat/query`

General chatbot using Gemini + Supabase vectors (separate from RAG backend).

**Request**: `{ "user_id": "...", "question": "..." }`

---

## 9. Database Schema

### PostgreSQL (Supabase) — Auth Backend

#### `users` Table

| Column               | Type     | Constraints                 |
| -------------------- | -------- | --------------------------- |
| `id`                 | Integer  | Primary Key, Auto-increment |
| `email`              | String   | Unique, Indexed, Not Null   |
| `hashed_password`    | String   | Not Null                    |
| `full_name`          | String   | Nullable                    |
| `reset_token`        | String   | Nullable (OTP storage)      |
| `reset_token_expiry` | DateTime | Nullable                    |
| `created_at`         | DateTime | Default: `now()`            |

#### `subjects` Table

| Column    | Type    | Constraints                 |
| --------- | ------- | --------------------------- |
| `id`      | Integer | Primary Key, Auto-increment |
| `name`    | String  | Not Null                    |
| `user_id` | Integer | Foreign Key → `users.id`    |

#### `notes` Table

| Column         | Type    | Constraints                 |
| -------------- | ------- | --------------------------- |
| `id`           | Integer | Primary Key, Auto-increment |
| `file_name`    | String  | Not Null                    |
| `content_text` | Text    | Nullable                    |
| `subject_id`   | Integer | Foreign Key → `subjects.id` |

### Qdrant Vector Store — RAG Backend

**Collection**: `askmynotes`

| Property        | Value  |
| --------------- | ------ |
| Vector Size     | 1536   |
| Distance Metric | Cosine |

**Point Payload Schema** (per chunk):
| Field | Type | Description |
|-------|------|-------------|
| `_node_content` | JSON string | LlamaIndex node content with text and metadata |
| `file_name` | string | Source file name |
| `page_number` | integer | Page number in source document |
| `subject_id` | string | Subject identifier for scoped retrieval |
| `line_start` | integer | Start line in page |
| `line_end` | integer | End line in page |
| `doc_id` | string | LlamaIndex document ID |
| `ref_doc_id` | string | LlamaIndex reference document ID |

---

## 10. Configuration & Environment

### Environment Variables

#### RAG Backend (`.env` in project root)

| Variable         | Default     | Description               |
| ---------------- | ----------- | ------------------------- |
| `OPENAI_API_KEY` | —           | OpenAI API key (required) |
| `QDRANT_HOST`    | `localhost` | Qdrant server hostname    |
| `QDRANT_PORT`    | `6333`      | Qdrant server port        |
| `APP_HOST`       | `0.0.0.0`   | FastAPI bind host         |
| `APP_PORT`       | `8000`      | FastAPI bind port         |

#### Auth Backend (`.env` in `Version_1/Backend/`)

| Variable               | Default | Description                             |
| ---------------------- | ------- | --------------------------------------- |
| `DATABASE_URL`         | —       | PostgreSQL connection string (Supabase) |
| `SECRET_KEY`           | `"abc"` | JWT signing secret                      |
| `SESSION_SECRET`       | —       | Starlette session middleware secret     |
| `GOOGLE_CLIENT_ID`     | —       | Google OAuth client ID                  |
| `GOOGLE_CLIENT_SECRET` | —       | Google OAuth client secret              |
| `SENDGRID_API_KEY`     | —       | SendGrid API key for OTP emails         |
| `SENDER_EMAIL`         | —       | Email address for OTP sender            |
| `SUPABASE_URL`         | —       | Supabase project URL                    |
| `SUPABASE_KEY`         | —       | Supabase anon/service key               |

### Vite Proxy Configuration

```javascript
// vite.config.js — proxy rules
'/api/auth' → http://127.0.0.1:8001  // Auth routes
'/api/users' → http://127.0.0.1:8001  // User routes
'/api/chat'  → http://127.0.0.1:8001  // Gemini chatbot

'/upload'     → http://127.0.0.1:8000  // File upload
'/chat'       → http://127.0.0.1:8000  // RAG chat
'/voice-chat' → http://127.0.0.1:8000  // Voice chat
'/study_mode' → http://127.0.0.1:8000  // Quiz generation
'/files'      → http://127.0.0.1:8000  // File listing
'/subjects'   → http://127.0.0.1:8000  // Subject listing
'/reset'      → http://127.0.0.1:8000  // Data reset
'/health'     → http://127.0.0.1:8000  // Health check
```

### Running the Project

```bash
# Prerequisites
# 1. Docker running (for Qdrant)
# 2. Node.js installed
# 3. Python 3.13+ installed

# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Install dependencies (one-time)
npm install                                    # Root orchestrator
cd Version_1/Frontend && npm install && cd ../..  # Frontend
pip install -r requirements.txt                # RAG backend (in venv)
cd Version_1/Backend && pip install -r requirements.txt && cd ../..  # Auth backend (in venv)

# Start all services
npm run dev
# This runs concurrently:
#   RAG Backend  → http://localhost:8000
#   Auth Backend → http://localhost:8001
#   Frontend     → http://localhost:5173
```

---

## 11. Dependency Versions

### RAG Backend (Python)

| Package                          | Version |
| -------------------------------- | ------- |
| fastapi                          | 0.133.1 |
| uvicorn                          | 0.41.0  |
| python-dotenv                    | 1.2.1   |
| python-multipart                 | 0.0.22  |
| llama-index-core                 | 0.14.15 |
| llama-index-llms-openai          | 0.6.21  |
| llama-index-embeddings-openai    | 0.5.1   |
| llama-index-vector-stores-qdrant | 0.9.1   |
| qdrant-client                    | 1.17.0  |
| PyMuPDF                          | 1.27.1  |
| openai                           | 2.24.0  |
| pydantic                         | 2.12.5  |

### Auth Backend (Python)

| Package                | Version |
| ---------------------- | ------- |
| fastapi                | latest  |
| uvicorn[standard]      | latest  |
| sqlalchemy             | latest  |
| psycopg2-binary        | latest  |
| passlib[bcrypt]        | 1.7.4   |
| bcrypt                 | 4.0.1   |
| python-jose            | latest  |
| authlib                | latest  |
| sendgrid               | latest  |
| supabase               | 2.4.6   |
| langchain-google-genai | latest  |
| langchain-community    | ≥0.0.38 |

### Frontend (JavaScript)

| Package              | Version  |
| -------------------- | -------- |
| react                | ^19.2.0  |
| react-dom            | ^19.2.0  |
| react-router-dom     | ^7.9.6   |
| zustand              | ^5.0.8   |
| jwt-decode           | ^4.0.0   |
| lucide-react         | ^0.554.0 |
| tailwindcss          | ^4.1.17  |
| @tailwindcss/vite    | ^4.1.17  |
| vite                 | ^7.2.4   |
| @vitejs/plugin-react | ^5.1.1   |

### Root Orchestrator

| Package      | Version |
| ------------ | ------- |
| concurrently | ^9.1.0  |

---

## 12. Project Structure

```
AskmyNotes/
├── .env.example                        # Environment variable template
├── .gitignore                          # Git ignore rules
├── main.py                             # RAG FastAPI server (8 endpoints)
├── rag_engine.py                       # RAGEngine class (ingest, chat, voice, quiz)
├── requirements.txt                    # RAG backend Python dependencies
├── package.json                        # Root orchestrator (concurrently)
├── PROJECT_DOCUMENTATION.md            # This file
├── qdrant_storage/                     # Qdrant local persistence
│   └── collections/askmynotes/         # Vector collection data
│
└── Version_1/
    ├── docker-compose.yml              # Docker orchestration
    │
    ├── Backend/                        # Auth + User Management Backend
    │   ├── Dockerfile
    │   ├── main.py                     # FastAPI app (port 8001)
    │   ├── requirements.txt
    │   ├── venv/                       # Python virtual environment
    │   ├── auth/
    │   │   ├── hashing.py              # bcrypt password hashing
    │   │   ├── oauth2.py               # OAuth2 bearer scheme
    │   │   └── token.py                # JWT create/verify (HS256)
    │   ├── database/
    │   │   └── postgresConn.py         # SQLAlchemy + Supabase Postgres
    │   ├── models/
    │   │   └── all_model.py            # User, Subject, Note ORM models
    │   ├── router/
    │   │   ├── auth_routes.py          # Login, Google OAuth, password reset
    │   │   ├── user_routes.py          # User CRUD endpoints
    │   │   └── chatbot_routes.py       # Gemini + Supabase chatbot
    │   ├── schemas/
    │   │   └── all_schema.py           # Pydantic request/response schemas
    │   └── utilis/
    │       └── email_otp.py            # SendGrid OTP email service
    │
    └── Frontend/                       # React SPA
        ├── Dockerfile
        ├── index.html                  # HTML entry point
        ├── package.json                # Frontend dependencies
        ├── vite.config.js              # Vite config + proxy rules
        └── src/
            ├── main.jsx                # React 19 createRoot entry
            ├── App.jsx                 # Router config + ProtectedRoute
            ├── App.css                 # Tailwind CSS import
            ├── index.css               # Tailwind CSS import
            ├── authStore.js            # Zustand auth state store
            ├── api/
            │   └── apiConfig.js        # API_BASE_URL + AUTH_BACKEND_URL
            ├── components/
            │   ├── Chatbot.jsx         # Floating AI assistant widget
            │   ├── MainLayout.jsx      # Sidebar + content layout
            │   └── Sidebar.jsx         # Navigation sidebar
            ├── pages/
            │   ├── LandingPage.jsx     # Public landing/marketing page
            │   ├── LoginPage.jsx       # Email/password + Google login
            │   ├── SignupPage.jsx       # Registration page
            │   ├── ForgotEmailPage.jsx # Password reset - email entry
            │   ├── VerifyOtpPage.jsx   # Password reset - OTP input
            │   ├── ResetPasswordPage.jsx # Password reset - new password
            │   ├── DashboardPage.jsx   # Subject overview + study readiness
            │   ├── MyNotesPage.jsx     # File upload + management
            │   ├── SubjectHub.jsx      # Chat + voice + evidence panel
            │   ├── StudyModePage.jsx   # MCQ + short answer quizzes
            │   ├── ProfilePage.jsx     # User profile + preferences
            │   └── ErrorPage.jsx       # Error boundary page
            └── utils/
                └── studyTracker.js     # localStorage study activity tracker
```

---

_Document generated for AskMyNotes — Subject-Scoped RAG Study Copilot_
_Last updated: February 2026_
