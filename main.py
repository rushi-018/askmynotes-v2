"""
main.py – FastAPI application for AskMyNotes Study Copilot.

Endpoints
---------
POST /upload       – Upload a PDF or TXT file for a given subject.
POST /chat         – Ask a question scoped to a subject.
POST /study_mode   – Generate quiz questions from a subject's notes.
POST /voice-chat   – Voice Teacher: STT → RAG → TTS pipeline.
GET  /files/{sid}  – List uploaded files for a subject.
GET  /subjects     – List subjects with indexed notes.
DELETE /reset      – Wipe the vector store.
GET  /health       – Liveness probe.
"""

from __future__ import annotations

import json
import logging
import urllib.parse
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rag_engine import RAGEngine

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
        ..., description="'High', 'Medium', or 'Low' confidence in the answer."
    )


class StudyModeRequest(BaseModel):
    subject_id: str = Field(..., min_length=1)


class MCQ(BaseModel):
    question: str
    options: list[str]
    correct_answer: str
    explanation: str = ""
    citation: str = Field("", description="Source reference, e.g. 'File.pdf, Page 2'.")


class ShortAnswer(BaseModel):
    question: str
    expected_answer: str
    citation: str = Field("", description="Source reference, e.g. 'File.pdf, Page 3'.")


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_engine
    logger.info("Starting AskMyNotes backend …")
    rag_engine = RAGEngine()
    yield
    logger.info("Shutting down AskMyNotes backend.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AskMyNotes – Study Copilot",
    description="Upload PDF notes and ask questions or generate quizzes, powered by RAG.",
    version="1.0.0",
    lifespan=lifespan,
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


# ---------------------------------------------------------------------------
# POST /upload  (PDF + TXT)
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {".pdf", ".txt"}
MAX_SUBJECTS = 3


@app.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="PDF or TXT file to upload."),
    subject_id: str = Form(..., description="Subject this file belongs to."),
):
    """Parse and ingest a PDF or plain-text file into the vector store."""
    engine = _engine()

    # ---- Enforce exactly-3-subject cap ----
    existing_subjects = engine.get_subjects()
    sid = subject_id.strip()
    if sid not in existing_subjects and len(existing_subjects) >= MAX_SUBJECTS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Maximum {MAX_SUBJECTS} subjects allowed. "
                f"Current subjects: {', '.join(existing_subjects)}. "
                "Delete /reset to start over or upload into an existing subject."
            ),
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name provided.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Only {', '.join(ALLOWED_EXTENSIONS)} files are accepted.",
        )

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        if ext == ".pdf":
            result = await engine.ingest_pdf(
                file_bytes=file_bytes,
                file_name=file.filename,
                subject_id=subject_id.strip(),
            )
        else:  # .txt
            result = await engine.ingest_txt(
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
@app.post("/chat", response_model=ChatResponse)
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
@app.post("/study_mode", response_model=StudyModeResponse)
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
# DELETE /reset  – wipe vector store
# ---------------------------------------------------------------------------
@app.delete("/reset")
async def reset_collection():
    """Delete all vectors and recreate the Qdrant collection."""
    engine = _engine()
    try:
        engine.reset_collection()
    except Exception as exc:
        logger.exception("Reset failed")
        raise HTTPException(status_code=500, detail=f"Reset error: {exc}")
    return {"message": "Collection reset successfully. Please re-upload your PDFs."}


# ---------------------------------------------------------------------------
# GET /files/{subject_id}  – list files for a subject
# ---------------------------------------------------------------------------
@app.get("/files/{subject_id}")
async def list_files(subject_id: str):
    """Return unique file names indexed under *subject_id*."""
    engine = _engine()
    try:
        files = engine.get_files_for_subject(subject_id.strip())
    except Exception as exc:
        logger.exception("Failed to list files for '%s'", subject_id)
        raise HTTPException(status_code=500, detail=str(exc))
    return {"subject_id": subject_id, "files": files}


# ---------------------------------------------------------------------------
# GET /subjects  – list all subjects
# ---------------------------------------------------------------------------
@app.get("/subjects")
async def list_subjects():
    """Return all subject_id values that have indexed notes."""
    engine = _engine()
    try:
        subjects = engine.get_subjects()
    except Exception as exc:
        logger.exception("Failed to list subjects")
        raise HTTPException(status_code=500, detail=str(exc))
    return {"subjects": subjects}


# ---------------------------------------------------------------------------
# POST /voice-chat  – Voice Teacher (STT → RAG → TTS)
# ---------------------------------------------------------------------------
@app.post("/voice-chat")
async def voice_chat(
    audio_file: UploadFile = File(..., description="Audio file with user's spoken question."),
    subject_id: str = Form(..., description="Subject to search in."),
    history: str = Form(
        default="[]",
        description='JSON-encoded conversation history: [{"role":"user","content":"..."}]',
    ),
):
    """Voice Teacher pipeline: Whisper STT → RAG answer → TTS audio stream.

    The response body is an ``audio/mpeg`` stream.
    Text metadata (transcript, answer, citations) are sent in response headers:
    - ``X-Transcript`` – the recognised speech text
    - ``X-Answer`` – the LLM answer text
    - ``X-Citations`` – JSON-encoded list of citation dicts
    - ``X-Confidence`` – "High", "Medium", or "Low"
    """
    engine = _engine()

    if not audio_file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    # Parse history JSON from form field
    try:
        parsed_history: list[dict[str, str]] = json.loads(history)
    except (json.JSONDecodeError, TypeError):
        parsed_history = []

    try:
        audio_bytes = await audio_file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty.")

        result = await engine.voice_chat(
            audio_bytes=audio_bytes,
            audio_filename=audio_file.filename,
            subject_id=subject_id.strip(),
            history=parsed_history or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Voice-chat failed for subject '%s'", subject_id)
        raise HTTPException(status_code=500, detail=f"Voice-chat error: {exc}")

    # Encode metadata into response headers (URL-encode to be header-safe)
    headers = {
        "X-Transcript": urllib.parse.quote(result["transcript"]),
        "X-Answer": urllib.parse.quote(result["answer"]),
        "X-Citations": urllib.parse.quote(json.dumps(result["citations"])),
        "X-Confidence": result["confidence"],
        "Access-Control-Expose-Headers": "X-Transcript, X-Answer, X-Citations, X-Confidence",
    }

    return StreamingResponse(
        content=result["audio_iter"],
        media_type="audio/mpeg",
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
