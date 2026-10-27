# pyrefly: ignore[missing-import]
from pydantic import BaseModel, Field       
from typing import Optional, List, Dict, Any

class TranscriptionBase(BaseModel):
    title: Optional[str] = None
    content: str
    language: Optional[str] = "Hinglish (Multilingual)"
    primary_language: Optional[str] = "hi-en"
    confidence: Optional[float] = 0.95
    duration_seconds: Optional[float] = 0.0
    engine_used: Optional[str] = "Real-time Multilingual Engine"
    tags: Optional[List[str]] = Field(default_factory=list)
    notes: Optional[str] = None
    is_favorite: Optional[bool] = False

class TranscriptionCreate(TranscriptionBase):
    audio_base64: Optional[str] = None
    audio_format: Optional[str] = "webm"

class TranscriptionUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    notes: Optional[str] = None

class TranscriptionResponse(BaseModel):
    id: int
    title: str
    content: str
    language: str
    primary_language: str
    language_breakdown: Optional[str] = None
    confidence: float
    duration_seconds: float
    word_count: int
    audio_filename: Optional[str] = None
    audio_url: Optional[str] = None
    engine_used: str
    tags: List[str]
    is_favorite: bool
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    lang: Optional[str] = "hi" # 'hi' for Hindi / Hinglish, 'en' for English
    slow: Optional[bool] = False

class BulkDeleteRequest(BaseModel):
    ids: List[int]
