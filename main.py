"""
main.py – FastAPI application for AskMyNotes Study Copilot.

Endpoints
---------
POST /upload      – Upload a PDF for a given subject.
POST /chat        – Ask a question scoped to a subject (text).
POST /study_mode  – Generate quiz questions from a subject's notes.
POST /voice/chat  – Send audio + subject_id → get transcript + answer + MP3 audio.
"""

from __future__ import annotations

import base64
import logging
import pathlib
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag_engine import RAGEngine
from voice_service import transcribe_audio, synthesize_speech
from conversation_memory import ConversationMemory

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("askmynotes.api")

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The user's question.")
    subject_id: str = Field(..., min_length=1, description="Subject to search in.")
    history: list[dict[str, str]] = Field(
        default_factory=list,
        description="Optional conversation history (list of {role, content}).",
    )


class Citation(BaseModel):
    file_name: str
    page_number: int
    line_start: int = Field(0, description="Starting line number on the page.")
    line_end: int = Field(0, description="Ending line number on the page.")
    subject_id: str = ""
    relevance_score: float = Field(0.0, description="Cosine similarity score from vector search.")
    chunk_text: str = Field("", description="Short snippet from the matched chunk.")


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: str = Field(
        ..., description="'High' or 'Low' confidence in the answer."
    )


class StudyModeRequest(BaseModel):
    subject_id: str = Field(..., min_length=1)


class MCQ(BaseModel):
    question: str
    options: list[str]
    correct_answer: str
    explanation: str = ""


class ShortAnswer(BaseModel):
    question: str
    expected_answer: str


class StudyModeResponse(BaseModel):
    subject_id: str
    mcqs: list[MCQ] = []
    short_answer: list[ShortAnswer] = []
    error: str | None = None
    raw_response: str | None = None


class UploadResponse(BaseModel):
    message: str
    file_name: str
    subject_id: str
    pages_processed: int
    chunks_created: int


# ---------------------------------------------------------------------------
# App lifespan – initialise / tear-down the RAG engine once
# ---------------------------------------------------------------------------
rag_engine: RAGEngine | None = None
conversation_memory: ConversationMemory | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_engine, conversation_memory
    logger.info("Starting AskMyNotes backend …")
    rag_engine = RAGEngine()
    conversation_memory = ConversationMemory()
    yield
    logger.info("Shutting down AskMyNotes backend.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AskMyNotes – Study Copilot",
    description=(
        "Upload PDF notes, ask questions, generate quizzes, and have "
        "voice conversations — all powered by RAG.\n\n"
        "## Workflow\n"
        "1. **Upload** a PDF via `/upload` for a subject.\n"
        "2. **Chat** (text) via `/chat` or **Voice** via `/voice/chat`.\n"
        "3. **Study** via `/study_mode` to generate quizzes.\n\n"
        "## Voice Mode (single endpoint)\n"
        "`POST /voice/chat` — upload an audio file + subject_id → get back "
        "transcript, RAG answer, citations, confidence, and spoken MP3 audio "
        "(base64-encoded). For follow-up questions, pass the returned "
        "`session_id` back in the next call."
    ),
    version="1.1.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Notes", "description": "Upload and manage PDF notes."},
        {"name": "Chat", "description": "Text-based RAG Q&A scoped to a subject."},
        {"name": "Study Mode", "description": "Auto-generate quizzes from notes."},
        {"name": "Voice", "description": "One-click voice-to-voice: upload audio → STT (Deepgram Nova-2) → RAG → TTS (ElevenLabs Turbo) → response with answer + audio."},
        {"name": "System", "description": "Health checks and diagnostics."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _engine() -> RAGEngine:
    """Return the initialised RAGEngine or raise 503."""
    if rag_engine is None:
        raise HTTPException(status_code=503, detail="RAG engine not ready.")
    return rag_engine


def _memory() -> ConversationMemory:
    """Return the initialised ConversationMemory or raise 503."""
    if conversation_memory is None:
        raise HTTPException(status_code=503, detail="Conversation memory not ready.")
    return conversation_memory


# ---------------------------------------------------------------------------
# POST /upload
# ---------------------------------------------------------------------------
@app.post("/upload", response_model=UploadResponse, tags=["Notes"])
async def upload_pdf(
    file: UploadFile = File(..., description="PDF file to upload."),
    subject_id: str = Form(..., description="Subject this file belongs to."),
):
    """Parse and ingest a PDF into the vector store for the given subject."""
    engine = _engine()

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = await engine.ingest_pdf(
            file_bytes=file_bytes,
            file_name=file.filename,
            subject_id=subject_id.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Upload failed for '%s'", file.filename)
        raise HTTPException(status_code=500, detail=f"Ingestion error: {exc}")

    return UploadResponse(
        message="File uploaded and indexed successfully.",
        file_name=result["file_name"],
        subject_id=result["subject_id"],
        pages_processed=result["pages_processed"],
        chunks_created=result["chunks_created"],
    )


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(body: ChatRequest):
    """Ask a question scoped to a specific subject."""
    engine = _engine()

    try:
        result = await engine.chat(
            query=body.query,
            subject_id=body.subject_id.strip(),
            history=body.history or None,
        )
    except Exception as exc:
        logger.exception("Chat failed for subject '%s'", body.subject_id)
        raise HTTPException(status_code=500, detail=f"Chat error: {exc}")

    return ChatResponse(
        answer=result["answer"],
        citations=[Citation(**c) for c in result["citations"]],
        confidence=result["confidence"],
    )


# ---------------------------------------------------------------------------
# POST /study_mode
# ---------------------------------------------------------------------------
@app.post("/study_mode", response_model=StudyModeResponse, tags=["Study Mode"])
async def study_mode(body: StudyModeRequest):
    """Generate quiz questions from a subject's notes."""
    engine = _engine()

    try:
        result = await engine.generate_study_questions(
            subject_id=body.subject_id.strip(),
        )
    except Exception as exc:
        logger.exception("Study-mode failed for subject '%s'", body.subject_id)
        raise HTTPException(status_code=500, detail=f"Study-mode error: {exc}")

    return StudyModeResponse(
        subject_id=result["subject_id"],
        mcqs=[MCQ(**m) for m in result.get("mcqs", [])],
        short_answer=[ShortAnswer(**s) for s in result.get("short_answer", [])],
        error=result.get("error"),
        raw_response=result.get("raw_response"),
    )


# ---------------------------------------------------------------------------
# Voice mode – Pydantic model
# ---------------------------------------------------------------------------

class VoiceChatResponse(BaseModel):
    transcript: str = Field(..., description="What the user said (STT output).")
    answer: str = Field(..., description="RAG answer from the notes.")
    citations: list[Citation] = Field(default_factory=list)
    confidence: str = Field(..., description="'High' or 'Low'.")
    session_id: str = Field(..., description="Re-use this for follow-up questions.")
    audio_base64: str = Field(
        ...,
        description="Base64-encoded MP3 audio of the spoken answer (ElevenLabs).",
    )


# ---------------------------------------------------------------------------
# POST /voice/chat  – one-click voice interaction
# ---------------------------------------------------------------------------
@app.post("/voice/chat", response_model=VoiceChatResponse, tags=["Voice"])
async def voice_chat(
    audio: UploadFile = File(..., description="Audio file recorded from mic (webm, wav, mp3, ogg …)."),
    subject_id: str = Form(..., description="Subject to search in (e.g. 'physics')."),
    session_id: str = Form("", description="Session ID for follow-ups. Leave blank for first question."),
):
    """Upload audio → transcribe → RAG answer → TTS → return everything.

    **First question:** provide `audio` + `subject_id`. A session is created
    automatically and its `session_id` is returned.

    **Follow-up questions:** also pass the `session_id` from the previous
    response. The system remembers the last 10 turns of conversation so
    requests like *"give an example"*, *"simplify it"*, or *"compare with
    the previous concept"* work out of the box.

    The response includes a `audio_base64` field containing the spoken
    answer as a base64-encoded MP3 that can be decoded and played directly.
    """
    engine = _engine()
    mem = _memory()

    subject_id = subject_id.strip()

    # ---- Session: reuse or auto-create ----
    if session_id.strip():
        stored_subject = mem.get_subject_id(session_id.strip())
        if stored_subject is None:
            raise HTTPException(
                status_code=404,
                detail="Session not found or expired. Omit session_id to start fresh.",
            )
        session_id = session_id.strip()
    else:
        session_id = mem.create_session(subject_id=subject_id)
        logger.info("Auto-created voice session %s (subject=%s)", session_id, subject_id)

    # 1. Read uploaded audio
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    mime = audio.content_type or "audio/webm"

    # 2. STT – Deepgram Nova-2
    try:
        transcript = await transcribe_audio(audio_bytes, mime_type=mime)
    except Exception as exc:
        logger.exception("STT failed")
        raise HTTPException(status_code=502, detail=f"Speech-to-text error: {exc}")

    if not transcript.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not transcribe any speech from the audio.",
        )

    # 3. RAG chat (same pipeline as /chat) with conversation history
    history = mem.get_history(session_id)
    try:
        result = await engine.chat(
            query=transcript,
            subject_id=subject_id,
            history=history or None,
        )
    except Exception as exc:
        logger.exception("Voice RAG chat failed")
        raise HTTPException(status_code=500, detail=f"Chat error: {exc}")

    answer = result["answer"]
    citations = [Citation(**c) for c in result.get("citations", [])]

    # 4. TTS – ElevenLabs Turbo v2.5
    try:
        tts_bytes = await synthesize_speech(answer)
        audio_b64 = base64.b64encode(tts_bytes).decode()
    except Exception as exc:
        logger.warning("TTS failed, returning answer without audio: %s", exc)
        audio_b64 = ""

    # 5. Store turn in memory
    mem.add_turn(session_id, transcript, answer)

    return VoiceChatResponse(
        transcript=transcript,
        answer=answer,
        citations=citations,
        confidence=result["confidence"],
        session_id=session_id,
        audio_base64=audio_b64,
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Frontend – serve static/index.html at /
# ---------------------------------------------------------------------------
_STATIC_DIR = pathlib.Path(__file__).parent / "static"


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    """Serve the demo frontend."""
    html = _STATIC_DIR / "index.html"
    return HTMLResponse(content=html.read_text(encoding="utf-8"))


app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
