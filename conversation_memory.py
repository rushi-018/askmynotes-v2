"""
conversation_memory.py – Lightweight per-session conversation memory.

Each session is identified by a ``session_id`` (UUID string).  The memory
stores the last N exchanges (user + assistant) so follow-up questions like
"give an example", "simplify it", or "compare with the previous concept"
work naturally because the RAG engine already accepts a ``history`` list.

The store is in-process (dict); suitable for a single-server deployment.
Sessions auto-expire after a configurable TTL.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_TURNS: int = 10           # keep last N user+assistant pairs (20 messages)
SESSION_TTL: int = 30 * 60    # 30 minutes of inactivity


@dataclass
class Session:
    session_id: str
    subject_id: str
    history: list[dict[str, str]] = field(default_factory=list)
    last_active: float = field(default_factory=time.time)


class ConversationMemory:
    """Thread-safe, in-memory conversation store keyed by session_id."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    # ---------------------------------------------------------------- public
    def create_session(self, subject_id: str) -> str:
        """Create a new session and return its ID."""
        self._gc()
        sid = uuid.uuid4().hex
        self._sessions[sid] = Session(session_id=sid, subject_id=subject_id)
        return sid

    def get_history(self, session_id: str) -> list[dict[str, str]]:
        """Return the conversation history for a session (or empty list)."""
        session = self._sessions.get(session_id)
        if session is None:
            return []
        session.last_active = time.time()
        return list(session.history)

    def add_turn(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
    ) -> None:
        """Append a user+assistant exchange to the session history."""
        session = self._sessions.get(session_id)
        if session is None:
            return
        session.history.append({"role": "user", "content": user_message})
        session.history.append({"role": "assistant", "content": assistant_message})
        # Trim to MAX_TURNS pairs (2 messages per turn)
        if len(session.history) > MAX_TURNS * 2:
            session.history = session.history[-(MAX_TURNS * 2):]
        session.last_active = time.time()

    def get_subject_id(self, session_id: str) -> str | None:
        """Return the subject_id bound to a session, or None."""
        session = self._sessions.get(session_id)
        return session.subject_id if session else None

    def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    # --------------------------------------------------- internal
    def _gc(self) -> None:
        """Remove expired sessions."""
        now = time.time()
        expired = [
            sid
            for sid, s in self._sessions.items()
            if now - s.last_active > SESSION_TTL
        ]
        for sid in expired:
            del self._sessions[sid]
