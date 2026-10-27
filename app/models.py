from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime
from app.database import Base

class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, default="Untitled Transcription")
    content = Column(Text, nullable=False)
    
    # Multilingual & Speech Metrics
    language = Column(String(100), default="Hinglish (Multilingual)")
    primary_language = Column(String(20), default="hi-en")
    language_breakdown = Column(Text, default="{}") # JSON string
    confidence = Column(Float, default=0.95)
    duration_seconds = Column(Float, default=0.0)
    word_count = Column(Integer, default=0)
    
    # Audio & Service
    audio_filename = Column(String(255), nullable=True)
    engine_used = Column(String(100), default="Real-time Multilingual Engine")
    
    # Metadata & User controls
    tags = Column(String(255), default="multilingual,speech-to-text")
    is_favorite = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "language": self.language,
            "primary_language": self.primary_language,
            "language_breakdown": self.language_breakdown,
            "confidence": self.confidence,
            "duration_seconds": self.duration_seconds,
            "word_count": self.word_count,
            "audio_filename": self.audio_filename,
            "audio_url": f"/api/audio/{self.audio_filename}" if self.audio_filename else None,
            "engine_used": self.engine_used,
            "tags": [t.strip() for t in (self.tags or "").split(",") if t.strip()],
            "is_favorite": self.is_favorite,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
