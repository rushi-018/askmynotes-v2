"""
voice_service.py – Deepgram Nova-2 (STT) + ElevenLabs Turbo v2.5 (TTS)

Provides two async helpers:
    transcribe_audio(audio_bytes, mime_type) -> str
    synthesize_speech(text) -> bytes  (mp3 audio)
"""

from __future__ import annotations

import logging
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("askmynotes.voice")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel

# ElevenLabs model – Turbo v2.5 for low-latency
ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

# Deepgram endpoint
DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"

# ElevenLabs endpoint template
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


# ---------------------------------------------------------------------------
# STT – Deepgram Nova-2
# ---------------------------------------------------------------------------
async def transcribe_audio(
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
) -> str:
    """Send raw audio bytes to Deepgram Nova-2 and return the transcript.

    Raises ``RuntimeError`` on API failure.
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY is not set.")

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": mime_type,
    }
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "language": "en",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            DEEPGRAM_URL,
            headers=headers,
            params=params,
            content=audio_bytes,
        )

    if resp.status_code != 200:
        logger.error("Deepgram error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"Deepgram STT failed ({resp.status_code})")

    data = resp.json()
    try:
        transcript = (
            data["results"]["channels"][0]["alternatives"][0]["transcript"]
        )
    except (KeyError, IndexError):
        logger.warning("Unexpected Deepgram response shape: %s", data)
        transcript = ""

    logger.info("STT transcript (%d chars): %s", len(transcript), transcript[:120])
    return transcript


# ---------------------------------------------------------------------------
# TTS – ElevenLabs Turbo v2.5
# ---------------------------------------------------------------------------
async def synthesize_speech(text: str) -> bytes:
    """Convert *text* to speech via ElevenLabs and return MP3 bytes."""
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not set.")

    url = ELEVENLABS_TTS_URL.format(voice_id=ELEVENLABS_VOICE_ID)
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=body)

    if resp.status_code != 200:
        logger.error("ElevenLabs error %s: %s", resp.status_code, resp.text[:300])
        raise RuntimeError(f"ElevenLabs TTS failed ({resp.status_code})")

    audio_bytes = resp.content
    logger.info("TTS synthesised %d bytes of audio", len(audio_bytes))
    return audio_bytes
