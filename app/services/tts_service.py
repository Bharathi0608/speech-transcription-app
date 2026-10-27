import os
import hashlib
from pathlib import Path
# pyrefly: ignore[missing-import]
from gtts import gTTS
from app.config import UPLOAD_DIR
from app.services.language_detector import analyze_multilingual_text

TTS_CACHE_DIR = UPLOAD_DIR / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

def generate_speech(text: str, lang: str = "auto", slow: bool = False) -> str:
    """
    Synthesizes speech using open-source gTTS.
    Automatically detects best accent (Hindi for Hinglish/Devanagari, English otherwise)
    and caches generated audio for zero latency on replay.
    Returns the filename of the generated audio.
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Cannot synthesize empty text.")

    # Determine optimal TTS voice language
    if lang == "auto" or not lang:
        analysis = analyze_multilingual_text(clean_text)
        if analysis["hindi_pct"] >= 25.0 or analysis["script"] == "Devanagari + Latin":
            effective_lang = "hi"
        else:
            effective_lang = "en"
    else:
        effective_lang = lang

    # Hash for caching
    cache_key = hashlib.md5(f"{clean_text}_{effective_lang}_{slow}".encode("utf-8")).hexdigest()
    filename = f"tts_{cache_key}.mp3"
    filepath = TTS_CACHE_DIR / filename

    if not filepath.exists():
        tts = gTTS(text=clean_text, lang=effective_lang, slow=slow)
        tts.save(str(filepath))

    return filename

def get_tts_file_path(filename: str) -> Path:
    return TTS_CACHE_DIR / filename
