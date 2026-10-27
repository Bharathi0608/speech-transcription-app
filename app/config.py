import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# PostgreSQL default matching the active ascend-postgres container, with SQLite fallback
DEFAULT_PG_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://ascend:ascend@localhost:5433/ascend_lms"
)
SQLITE_FALLBACK_URL = f"sqlite:///{BASE_DIR / 'transcriptions.db'}"

# STT / TTS API Keys (optional for cloud engines, native open-source used otherwise)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
