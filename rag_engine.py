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
SIMILARITY_THRESHOLD = 0.15  # very low – let the LLM judge relevance
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64


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
        """Parse *file_bytes* (PDF), chunk, embed, and upsert into Qdrant.

        Every chunk carries ``file_name``, ``page_number`` and ``subject_id``
        in its metadata / Qdrant payload.
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

        # Build LlamaIndex TextNodes with metadata, split per-page so that
        # each chunk inherits the correct page_number and line numbers.
        splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
        all_nodes: list[TextNode] = []

        for page_data in pages:
            page_text = page_data["text"]
            page_lines = page_text.split("\n")

            page_doc = Document(
                text=page_text,
                metadata={
                    "file_name": file_name,
                    "page_number": page_data["page_number"],
                    "subject_id": subject_id,
                },
            )
            nodes = splitter.get_nodes_from_documents([page_doc])

            # Compute line numbers for each chunk
            for node in nodes:
                node.metadata["file_name"] = file_name
                node.metadata["page_number"] = page_data["page_number"]
                node.metadata["subject_id"] = subject_id

                # Find the starting position of this chunk in the page
                chunk_text_start = node.text[:80].strip()
                line_start = 1
                line_end = len(page_lines)
                for i, line in enumerate(page_lines):
                    if chunk_text_start[:40] in line:
                        line_start = i + 1  # 1-based
                        break
                # Estimate end line from chunk length
                chunk_line_count = node.text.count("\n") + 1
                line_end = min(line_start + chunk_line_count - 1, len(page_lines))

                node.metadata["line_start"] = line_start
                node.metadata["line_end"] = line_end

                # Keep internal IDs out of the text sent to the LLM
                node.excluded_llm_metadata_keys = ["subject_id", "line_start", "line_end"]
            all_nodes.extend(nodes)

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
            similarity_top_k=5,
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
        confidence = "High" if avg_score >= 0.8 else "Low"

        return {
            "answer": answer,
            "citations": citations,
            "confidence": confidence,
        }

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
            "Return your response in this EXACT JSON format (no markdown fences):\n"
            "{\n"
            '  "mcqs": [\n'
            "    {\n"
            '      "question": "...",\n'
            '      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
            '      "correct_answer": "A",\n'
            '      "explanation": "..."\n'
            "    }\n"
            "  ],\n"
            '  "short_answer": [\n'
            "    {\n"
            '      "question": "...",\n'
            '      "expected_answer": "..."\n'
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
