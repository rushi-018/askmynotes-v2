"""
rag_engine.py – LlamaIndex + Qdrant RAG Engine for AskMyNotes.

Handles PDF ingestion, vector storage, subject-scoped retrieval,
and LLM-powered answer / quiz generation.
"""

from __future__ import annotations

import json
import logging
import os
import random
import uuid
from typing import Any

import fitz  # PyMuPDF
import openai
from dotenv import load_dotenv
from qdrant_client import AsyncQdrantClient, QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    VectorParams,
)

from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document, TextNode
from llama_index.core.vector_stores import (
    FilterOperator,
    MetadataFilter,
    MetadataFilters,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.qdrant import QdrantVectorStore

load_dotenv()

logger = logging.getLogger("askmynotes.rag")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
COLLECTION_NAME = "askmynotes"
QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_DIM = 1536  # text-embedding-3-small output dimension
SIMILARITY_THRESHOLD = 0.15  # low – let the LLM judge relevance
CHUNK_SIZE = 256
CHUNK_OVERLAP = 40


class RAGEngine:
    """Core RAG engine – one instance shared across the FastAPI lifespan."""

    # ------------------------------------------------------------------ init
    def __init__(self) -> None:
        # Qdrant clients (sync + async)
        self.qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        self.async_qdrant_client = AsyncQdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        self._ensure_collection()

        # LLMs
        self.llm = OpenAI(
            model="gpt-4o",
            api_key=OPENAI_API_KEY,
            temperature=0.1,
        )
        self.llm_mini = OpenAI(
            model="gpt-4o-mini",
            api_key=OPENAI_API_KEY,
            temperature=0.7,
        )

        # Embedding model
        self.embed_model = OpenAIEmbedding(
            model="text-embedding-3-small",
            api_key=OPENAI_API_KEY,
        )

        # Global LlamaIndex settings
        Settings.llm = self.llm
        Settings.embed_model = self.embed_model
        Settings.chunk_size = CHUNK_SIZE
        Settings.chunk_overlap = CHUNK_OVERLAP

        # Shared vector store handle
        self.vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            aclient=self.async_qdrant_client,
            collection_name=COLLECTION_NAME,
        )

        # Raw OpenAI client for Whisper STT / TTS
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

        logger.info("RAGEngine initialised (Qdrant @ %s:%s)", QDRANT_HOST, QDRANT_PORT)

    # --------------------------------------------------- collection helpers
    def _ensure_collection(self) -> None:
        """Create the Qdrant collection if it doesn't already exist."""
        existing = [
            c.name for c in self.qdrant_client.get_collections().collections
        ]
        if COLLECTION_NAME not in existing:
            self.qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection '%s'", COLLECTION_NAME)

    # ---------------------------------------------------------------- ingest
    async def ingest_pdf(
        self,
        file_bytes: bytes,
        file_name: str,
        subject_id: str,
    ) -> dict[str, Any]:
        """Parse *file_bytes* (PDF), chunk by paragraph, embed, and upsert.

        Every chunk carries ``file_name``, ``page_number``, ``line_start``,
        ``line_end``, and ``subject_id`` in its metadata / Qdrant payload.
        """
        doc = fitz.open(stream=file_bytes, filetype="pdf")

        pages: list[dict[str, Any]] = []
        for page_idx in range(len(doc)):
            text = doc[page_idx].get_text("text")
            if text.strip():
                pages.append({"text": text, "page_number": page_idx + 1})
        doc.close()

        if not pages:
            raise ValueError("The uploaded PDF contains no extractable text.")

        # ------ Paragraph-aware chunking ------
        # 1) Split each page into paragraphs (double-newline or heading gaps)
        # 2) Then use SentenceSplitter only on paragraphs that exceed CHUNK_SIZE
        splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
        all_nodes: list[TextNode] = []

        for page_data in pages:
            page_text = page_data["text"]
            page_number = page_data["page_number"]
            page_lines = page_text.split("\n")

            # Split into paragraphs: a paragraph ends at a blank line or
            # a line that looks like a heading (short, possibly uppercase).
            paragraphs: list[dict] = []
            current_lines: list[str] = []
            current_start_line = 1  # 1-based

            for line_idx, line in enumerate(page_lines):
                stripped = line.strip()
                if stripped == "":
                    # Blank line → flush current paragraph
                    if current_lines:
                        paragraphs.append({
                            "text": "\n".join(current_lines),
                            "line_start": current_start_line,
                            "line_end": current_start_line + len(current_lines) - 1,
                        })
                        current_lines = []
                    current_start_line = line_idx + 2  # next line is 1-based
                else:
                    if not current_lines:
                        current_start_line = line_idx + 1  # 1-based
                    current_lines.append(line)

            # Flush remaining
            if current_lines:
                paragraphs.append({
                    "text": "\n".join(current_lines),
                    "line_start": current_start_line,
                    "line_end": current_start_line + len(current_lines) - 1,
                })

            # For each paragraph, create one or more chunks
            for para in paragraphs:
                para_text = para["text"].strip()
                if not para_text:
                    continue

                # If the paragraph is short enough, make it a single node
                para_doc = Document(
                    text=para_text,
                    metadata={
                        "file_name": file_name,
                        "page_number": page_number,
                        "subject_id": subject_id,
                        "line_start": para["line_start"],
                        "line_end": para["line_end"],
                    },
                )
                chunks = splitter.get_nodes_from_documents([para_doc])

                for chunk in chunks:
                    chunk.metadata["file_name"] = file_name
                    chunk.metadata["page_number"] = page_number
                    chunk.metadata["subject_id"] = subject_id
                    chunk.metadata["line_start"] = para["line_start"]
                    chunk.metadata["line_end"] = para["line_end"]
                    chunk.excluded_llm_metadata_keys = [
                        "subject_id", "line_start", "line_end",
                    ]
                all_nodes.extend(chunks)

        # Upsert via LlamaIndex → QdrantVectorStore
        storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        VectorStoreIndex(
            nodes=all_nodes,
            storage_context=storage_context,
            embed_model=self.embed_model,
        )

        logger.info(
            "Ingested '%s' for subject '%s' – %d pages, %d chunks",
            file_name,
            subject_id,
            len(pages),
            len(all_nodes),
        )

        return {
            "file_name": file_name,
            "subject_id": subject_id,
            "pages_processed": len(pages),
            "chunks_created": len(all_nodes),
        }

    # --------------------------------------------------------- ingest_txt
    async def ingest_txt(
        self,
        file_bytes: bytes,
        file_name: str,
        subject_id: str,
    ) -> dict[str, Any]:
        """Ingest a plain-text file: split by paragraphs, embed, and upsert.

        Metadata includes ``file_name``, ``subject_id``, ``page_number`` (always 1),
        ``line_start``, and ``line_end``.
        """
        raw_text = file_bytes.decode("utf-8", errors="replace")
        if not raw_text.strip():
            raise ValueError("The uploaded text file is empty.")

        lines = raw_text.split("\n")

        # ---- paragraph splitting (same logic as PDF) ----
        splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
        all_nodes: list[TextNode] = []

        paragraphs: list[dict] = []
        current_lines: list[str] = []
        current_start_line = 1

        for line_idx, line in enumerate(lines):
            stripped = line.strip()
            if stripped == "":
                if current_lines:
                    paragraphs.append({
                        "text": "\n".join(current_lines),
                        "line_start": current_start_line,
                        "line_end": current_start_line + len(current_lines) - 1,
                    })
                    current_lines = []
                current_start_line = line_idx + 2
            else:
                if not current_lines:
                    current_start_line = line_idx + 1
                current_lines.append(line)

        if current_lines:
            paragraphs.append({
                "text": "\n".join(current_lines),
                "line_start": current_start_line,
                "line_end": current_start_line + len(current_lines) - 1,
            })

        for para in paragraphs:
            para_text = para["text"].strip()
            if not para_text:
                continue
            para_doc = Document(
                text=para_text,
                metadata={
                    "file_name": file_name,
                    "page_number": 1,
                    "subject_id": subject_id,
                    "line_start": para["line_start"],
                    "line_end": para["line_end"],
                },
            )
            chunks = splitter.get_nodes_from_documents([para_doc])
            for chunk in chunks:
                chunk.metadata["file_name"] = file_name
                chunk.metadata["page_number"] = 1
                chunk.metadata["subject_id"] = subject_id
                chunk.metadata["line_start"] = para["line_start"]
                chunk.metadata["line_end"] = para["line_end"]
                chunk.excluded_llm_metadata_keys = [
                    "subject_id", "line_start", "line_end",
                ]
            all_nodes.extend(chunks)

        if not all_nodes:
            raise ValueError("No text chunks could be extracted from the file.")

        storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        VectorStoreIndex(
            nodes=all_nodes,
            storage_context=storage_context,
            embed_model=self.embed_model,
        )

        logger.info(
            "Ingested TXT '%s' for subject '%s' – %d chunks",
            file_name, subject_id, len(all_nodes),
        )

        return {
            "file_name": file_name,
            "subject_id": subject_id,
            "pages_processed": 1,
            "chunks_created": len(all_nodes),
        }

    # ------------------------------------------------------ file / subject queries
    def get_files_for_subject(self, subject_id: str) -> list[str]:
        """Return unique file names stored for *subject_id* in Qdrant."""
        scroll_result = self.qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="subject_id",
                        match=MatchValue(value=subject_id),
                    )
                ]
            ),
            limit=500,
            with_payload=True,
            with_vectors=False,
        )
        points = scroll_result[0]
        seen: set[str] = set()
        for pt in points:
            payload = pt.payload or {}
            fn = payload.get("file_name")
            if fn:
                seen.add(fn)
        return sorted(seen)

    def get_subjects(self) -> list[str]:
        """Return unique subject_id values present in the collection."""
        scroll_result = self.qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=1000,
            with_payload=True,
            with_vectors=False,
        )
        points = scroll_result[0]
        seen: set[str] = set()
        for pt in points:
            payload = pt.payload or {}
            sid = payload.get("subject_id")
            if sid:
                seen.add(sid)
        return sorted(seen)

    # ----------------------------------------------------- voice chat (STT → RAG → TTS)
    async def voice_chat(
        self,
        audio_bytes: bytes,
        audio_filename: str,
        subject_id: str,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Full voice pipeline: Whisper STT → RAG retrieval → TTS audio.

        Returns a dict with ``transcript``, ``answer``, ``citations``,
        ``confidence``, and ``audio_iter`` (a byte-iterator for streaming).
        """
        import io

        # ---- Step A: STT via Whisper ----
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = audio_filename  # Whisper needs a filename hint
        transcription = self.openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        transcript: str = transcription.text.strip()
        logger.info("Voice STT transcript: %s", transcript)

        if not transcript:
            raise ValueError("Could not transcribe any speech from the audio.")

        # ---- Step B: RAG retrieval (reuse existing chat but with voice prompt) ----
        index = VectorStoreIndex.from_vector_store(
            vector_store=self.vector_store,
            embed_model=self.embed_model,
        )
        metadata_filters = MetadataFilters(
            filters=[
                MetadataFilter(
                    key="subject_id",
                    value=subject_id,
                    operator=FilterOperator.EQ,
                ),
            ]
        )
        retriever = index.as_retriever(
            similarity_top_k=8,
            filters=metadata_filters,
        )
        retrieved_nodes = await retriever.aretrieve(transcript)

        valid_nodes = [
            n for n in retrieved_nodes
            if n.score is not None and n.score >= SIMILARITY_THRESHOLD
        ]

        if not valid_nodes:
            # Still produce TTS for the "not found" message
            not_found_msg = (
                f"I could not find relevant information in your {subject_id} notes "
                f"for the question: {transcript}"
            )
            tts_response = self.openai_client.audio.speech.create(
                model="tts-1", voice="onyx", input=not_found_msg,
            )
            return {
                "transcript": transcript,
                "answer": not_found_msg,
                "citations": [],
                "confidence": "Low",
                "audio_iter": tts_response.iter_bytes(chunk_size=4096),
            }

        # Build context & citations
        context_parts: list[str] = []
        citations: list[dict[str, Any]] = []
        for node in valid_nodes:
            meta = node.metadata
            fn = meta.get("file_name", "Unknown")
            pg = meta.get("page_number", 0)
            ls = meta.get("line_start", 0)
            le = meta.get("line_end", 0)
            score = round(node.score, 4) if node.score is not None else 0.0
            snippet = node.text[:200].replace("\n", " ").strip()
            if len(node.text) > 200:
                snippet += "…"
            citation_label = f"[{fn}, Page {pg}]"
            context_parts.append(f"--- Source: {citation_label} ---\n{node.text}")
            citations.append({
                "file_name": fn,
                "page_number": pg,
                "line_start": ls,
                "line_end": le,
                "subject_id": subject_id,
                "relevance_score": score,
                "chunk_text": snippet,
            })

        context = "\n\n".join(context_parts)

        # ---- Voice-optimised system prompt (no markdown) ----
        system_prompt = (
            f'You are a friendly Voice Study Teacher for the subject "{subject_id}". '
            "You answer questions STRICTLY based on the provided context from "
            "the student's uploaded notes.\n\n"
            "RULES:\n"
            "1. ONLY use information from the CONTEXT below.\n"
            "2. Do NOT use markdown, bullet points, or special formatting.\n"
            "3. Speak naturally as if reading aloud to a student.\n"
            "4. Reference sources conversationally, like: "
            "'According to your notes in chapter 1, page 2...'\n"
            "5. Keep the answer concise and clear, suitable for listening.\n"
            "6. If the context is insufficient, say: "
            f"'I could not find that in your {subject_id} notes.'\n\n"
            f"CONTEXT FROM NOTES:\n{context}"
        )

        messages: list[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
        ]

        # ---- Inject conversation history for multi-turn follow-ups ----
        if history:
            history_block = ""
            for msg in history[-6:]:
                role = msg.get("role", "user").upper()
                content = msg.get("content", "")
                history_block += f"\n{role}: {content}"
            messages.append(
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"Previous conversation:{history_block}",
                )
            )

        messages.append(ChatMessage(role=MessageRole.USER, content=transcript))

        response = await self.llm.achat(messages)
        answer: str = response.message.content
        logger.info("Voice RAG answer length: %d chars", len(answer))

        # ---- Step C: TTS via OpenAI ----
        tts_response = self.openai_client.audio.speech.create(
            model="tts-1",
            voice="onyx",
            input=answer,
        )

        avg_score = sum(n.score for n in valid_nodes) / len(valid_nodes)
        if avg_score >= 0.75:
            confidence = "High"
        elif avg_score >= 0.4:
            confidence = "Medium"
        else:
            confidence = "Low"

        return {
            "transcript": transcript,
            "answer": answer,
            "citations": citations,
            "confidence": confidence,
            "audio_iter": tts_response.iter_bytes(chunk_size=4096),
        }

    # ------------------------------------------------------------------ chat
    async def chat(
        self,
        query: str,
        subject_id: str,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Subject-scoped RAG chat.  Returns answer, citations, confidence."""

        # Build index handle from existing vector store
        index = VectorStoreIndex.from_vector_store(
            vector_store=self.vector_store,
            embed_model=self.embed_model,
        )

        # Retriever filtered by subject_id
        metadata_filters = MetadataFilters(
            filters=[
                MetadataFilter(
                    key="subject_id",
                    value=subject_id,
                    operator=FilterOperator.EQ,
                ),
            ]
        )
        retriever = index.as_retriever(
            similarity_top_k=8,
            filters=metadata_filters,
        )

        # Retrieve relevant chunks
        retrieved_nodes = await retriever.aretrieve(query)

        # ---- Debug: log scores ----
        for i, node in enumerate(retrieved_nodes):
            logger.info(
                "Chunk %d | score=%.4f | file=%s | page=%s",
                i, node.score or 0.0,
                node.metadata.get("file_name", "?"),
                node.metadata.get("page_number", "?"),
            )

        # ---- Similarity gate ----
        valid_nodes = [
            n for n in retrieved_nodes if n.score is not None and n.score >= SIMILARITY_THRESHOLD
        ]

        if not valid_nodes:
            return {
                "answer": f"Not found in your notes for {subject_id}",
                "citations": [],
                "confidence": "Low",
            }

        # ---- Build context & citations ----
        context_parts: list[str] = []
        citations: list[dict[str, Any]] = []

        for node in valid_nodes:
            meta = node.metadata
            fn = meta.get("file_name", "Unknown")
            pg = meta.get("page_number", 0)
            ls = meta.get("line_start", 0)
            le = meta.get("line_end", 0)
            score = round(node.score, 4) if node.score is not None else 0.0
            # Snippet: first 200 chars of the chunk text
            snippet = node.text[:200].replace("\n", " ").strip()
            if len(node.text) > 200:
                snippet += "…"
            citation_label = f"[{fn}, Page {pg}, Lines {ls}-{le}]"
            context_parts.append(f"--- Source: {citation_label} ---\n{node.text}")

            citations.append({
                "file_name": fn,
                "page_number": pg,
                "line_start": ls,
                "line_end": le,
                "subject_id": subject_id,
                "relevance_score": score,
                "chunk_text": snippet,
            })

        context = "\n\n".join(context_parts)

        # ---- Conversation history ----
        history_block = ""
        if history:
            for msg in history[-6:]:
                role = msg.get("role", "user").upper()
                content = msg.get("content", "")
                history_block += f"\n{role}: {content}"

        # ---- System prompt ----
        system_prompt = (
            f'You are a Study Copilot for the subject "{subject_id}". '
            "You answer questions STRICTLY based on the provided context from "
            "the user's uploaded notes.\n\n"
            "RULES:\n"
            "1. ONLY use information from the CONTEXT below. Do NOT use outside knowledge.\n"
            "2. If the context does not contain enough information to answer, respond "
            f'EXACTLY with: "Not found in your notes for {subject_id}"\n'
            "3. Include inline citations in the format [File Name, Page X].\n"
            "4. Be precise, clear, and helpful.\n"
            "5. If the question is ambiguous, interpret it within the subject matter.\n\n"
            f"CONTEXT FROM NOTES:\n{context}"
        )

        messages: list[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
        ]
        if history_block:
            messages.append(
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"Previous conversation:{history_block}",
                )
            )
        messages.append(ChatMessage(role=MessageRole.USER, content=query))

        # ---- LLM call ----
        response = await self.llm.achat(messages)
        answer: str = response.message.content

        # ---- Confidence ----
        not_found_phrase = f"Not found in your notes for {subject_id}"
        if not_found_phrase.lower() in answer.lower():
            return {
                "answer": not_found_phrase,
                "citations": [],
                "confidence": "Low",
            }

        avg_score = sum(n.score for n in valid_nodes) / len(valid_nodes)
        if avg_score >= 0.75:
            confidence = "High"
        elif avg_score >= 0.4:
            confidence = "Medium"
        else:
            confidence = "Low"

        return {
            "answer": answer,
            "citations": citations,
            "confidence": confidence,
        }

    # --------------------------------------------------------- reset
    def reset_collection(self) -> None:
        """Delete and recreate the Qdrant collection (wipes all vectors)."""
        if self.qdrant_client.collection_exists(COLLECTION_NAME):
            self.qdrant_client.delete_collection(COLLECTION_NAME)
            logger.info("Deleted collection '%s'", COLLECTION_NAME)
        self.qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=EMBEDDING_DIM, distance=Distance.COSINE
            ),
        )
        logger.info("Recreated collection '%s'", COLLECTION_NAME)

    # ----------------------------------------------------------- study mode
    async def generate_study_questions(
        self,
        subject_id: str,
    ) -> dict[str, Any]:
        """Sample random chunks for *subject_id* and ask GPT-4o-mini to
        produce 5 MCQs + 3 Short Answer questions."""

        # Use qdrant_client.scroll for random sampling (no vector needed)
        scroll_result = self.qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="subject_id",
                        match=MatchValue(value=subject_id),
                    )
                ]
            ),
            limit=100,
            with_payload=True,
            with_vectors=False,
        )

        points = scroll_result[0]
        if not points:
            return {
                "subject_id": subject_id,
                "mcqs": [],
                "short_answer": [],
                "error": "No notes found for this subject.",
            }

        # Random sample
        sample_size = min(10, len(points))
        sampled = random.sample(points, sample_size)

        context_parts: list[str] = []
        for point in sampled:
            payload = point.payload or {}
            text = self._extract_text_from_payload(payload)
            fn = payload.get("file_name", "Unknown")
            pg = payload.get("page_number", "?")
            context_parts.append(f"[{fn}, Page {pg}]:\n{text}")

        context = "\n\n".join(context_parts)

        prompt = (
            f'Based STRICTLY on the following study material for "{subject_id}", '
            "generate quiz questions.\n\n"
            f"STUDY MATERIAL:\n{context}\n\n"
            "Generate exactly:\n"
            "- 5 Multiple Choice Questions (MCQs) with 4 options each and the correct answer indicated\n"
            "- 3 Short Answer Questions with brief expected answers\n\n"
            "IMPORTANT: For every question, include a \"citation\" field showing which source "
            "it came from in the format \"FileName, Page X\".\n\n"
            "Return your response in this EXACT JSON format (no markdown fences):\n"
            "{\n"
            '  "mcqs": [\n'
            "    {\n"
            '      "question": "...",\n'
            '      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
            '      "correct_answer": "A",\n'
            '      "explanation": "...",\n'
            '      "citation": "FileName.pdf, Page 2"\n'
            "    }\n"
            "  ],\n"
            '  "short_answer": [\n'
            "    {\n"
            '      "question": "...",\n'
            '      "expected_answer": "...",\n'
            '      "citation": "FileName.pdf, Page 3"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "IMPORTANT: Only create questions from the provided material. "
            "Do NOT use external knowledge."
        )

        response = await self.llm_mini.acomplete(prompt)
        questions = self._parse_json_response(response.text)

        return {"subject_id": subject_id, **questions}

    # ------------------------------------------------------------ helpers
    @staticmethod
    def _extract_text_from_payload(payload: dict[str, Any]) -> str:
        """Best-effort extraction of the original chunk text from a Qdrant
        point payload created by LlamaIndex."""
        # LlamaIndex stores full node as JSON in _node_content
        node_content = payload.get("_node_content")
        if node_content:
            try:
                parsed = json.loads(node_content) if isinstance(node_content, str) else node_content
                if "text" in parsed:
                    return parsed["text"]
            except (json.JSONDecodeError, TypeError):
                pass
        # Fallback: look for a plain 'text' key
        if "text" in payload:
            return str(payload["text"])
        return ""

    @staticmethod
    def _parse_json_response(raw: str) -> dict[str, Any]:
        """Parse an LLM response that should be JSON, stripping markdown
        fences if present."""
        text = raw.strip()
        if text.startswith("```"):
            # Remove opening fence (```json or ```)
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            # Remove closing fence
            if text.endswith("```"):
                text = text[: -3].rstrip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse study-mode JSON from LLM response.")
            return {
                "mcqs": [],
                "short_answer": [],
                "raw_response": raw,
            }
