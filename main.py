"""
main.py – FastAPI application for AskMyNotes Study Copilot.

Endpoints
---------
POST /upload      – Upload a PDF for a given subject.
POST /chat        – Ask a question scoped to a subject.
POST /study_mode  – Generate quiz questions from a subject's notes.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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
# POST /upload
# ---------------------------------------------------------------------------
@app.post("/upload", response_model=UploadResponse)
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
