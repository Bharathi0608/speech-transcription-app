import json
import csv
import io
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from app.database import get_db, get_db_info
from app.models import Transcription
from app.schemas import (
    TranscriptionCreate,
    TranscriptionUpdate,
    TranscriptionResponse,
    TTSRequest,
    BulkDeleteRequest,
)
from app.config import UPLOAD_DIR
from app.services.language_detector import analyze_multilingual_text
from app.services.tts_service import generate_speech, get_tts_file_path
from app.services.transcription import (
    save_base64_audio,
    process_audio_transcription,
)

router = APIRouter(prefix="/api")

# ============================================================================
# Transcriptions CRUD Endpoints
# ============================================================================

@router.post("/transcriptions", response_model=TranscriptionResponse, status_code=201)
def create_transcription(payload: TranscriptionCreate, db: Session = Depends(get_db)):
    """
    Create and store a new transcription in the database.
    Performs automatic multilingual language detection and Hinglish code-switching analysis.
    """
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Transcription content cannot be empty.")

    # Multilingual analysis
    analysis = analyze_multilingual_text(content)
    detected_language = payload.language if payload.language and payload.language != "Hinglish (Multilingual)" else analysis["label"]
    primary_lang = analysis["primary"]

    # Generate title if not provided
    title = payload.title
    if not title or not title.strip():
        # First 6 words or first 40 chars
        words = content.split()
        title = " ".join(words[:6]) + ("..." if len(words) > 6 else "")

    # Save audio if provided
    audio_filename = None
    if payload.audio_base64:
        try:
            audio_filename = save_base64_audio(payload.audio_base64, payload.audio_format or "webm")
        except Exception as e:
            # Non-blocking if audio save fails
            pass

    tags_str = ",".join(payload.tags) if payload.tags else "multilingual,speech-to-text"

    transcription = Transcription(
        title=title,
        content=content,
        language=detected_language,
        primary_language=primary_lang,
        language_breakdown=json.dumps(analysis),
        confidence=payload.confidence or 0.95,
        duration_seconds=payload.duration_seconds or 0.0,
        word_count=len(content.split()),
        audio_filename=audio_filename,
        engine_used=payload.engine_used or "Real-time Multilingual Engine",
        tags=tags_str,
        notes=payload.notes,
        is_favorite=payload.is_favorite or False,
    )

    db.add(transcription)
    db.commit()
    db.refresh(transcription)

    return transcription.to_dict()

@router.get("/transcriptions", response_model=dict)
def list_transcriptions(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: Optional[str] = None,
    lang: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    sort_by: str = Query("newest", regex="^(newest|oldest|duration|words)$")
):
    """
    Retrieve transcription history with search, multilingual filter, and sorting.
    """
    query = db.query(Transcription)

    if q and q.strip():
        search = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Transcription.title.ilike(search),
                Transcription.content.ilike(search),
                Transcription.tags.ilike(search)
            )
        )

    if lang and lang != "all":
        query = query.filter(Transcription.language.ilike(f"%{lang}%"))

    if is_favorite is not None:
        query = query.filter(Transcription.is_favorite == is_favorite)

    # Sorting
    if sort_by == "newest":
        query = query.order_by(desc(Transcription.created_at))
    elif sort_by == "oldest":
        query = query.order_by(asc(Transcription.created_at))
    elif sort_by == "duration":
        query = query.order_by(desc(Transcription.duration_seconds))
    elif sort_by == "words":
        query = query.order_by(desc(Transcription.word_count))

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [item.to_dict() for item in items],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }

@router.get("/transcriptions/{id}", response_model=TranscriptionResponse)
def get_transcription(id: int, db: Session = Depends(get_db)):
    """Retrieve a single transcription by ID."""
    transcription = db.query(Transcription).filter(Transcription.id == id).first()
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found.")
    return transcription.to_dict()

@router.put("/transcriptions/{id}", response_model=TranscriptionResponse)
def update_transcription(id: int, payload: TranscriptionUpdate, db: Session = Depends(get_db)):
    """
    Update transcription details (title, content, tags, favorite, notes).
    Re-runs multilingual code-switching analysis if content was modified.
    """
    transcription = db.query(Transcription).filter(Transcription.id == id).first()
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found.")

    if payload.title is not None:
        transcription.title = payload.title.strip()

    if payload.content is not None:
        content = payload.content.strip()
        transcription.content = content
        transcription.word_count = len(content.split())
        # Re-analyze language
        analysis = analyze_multilingual_text(content)
        transcription.language = payload.language if payload.language else analysis["label"]
        transcription.primary_language = analysis["primary"]
        transcription.language_breakdown = json.dumps(analysis)

    if payload.language is not None and not payload.content:
        transcription.language = payload.language

    if payload.tags is not None:
        transcription.tags = ",".join(payload.tags)

    if payload.is_favorite is not None:
        transcription.is_favorite = payload.is_favorite

    if payload.notes is not None:
        transcription.notes = payload.notes

    transcription.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(transcription)

    return transcription.to_dict()

@router.delete("/transcriptions/{id}")
def delete_transcription(id: int, db: Session = Depends(get_db)):
    """Delete a transcription and remove associated audio file from disk."""
    transcription = db.query(Transcription).filter(Transcription.id == id).first()
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found.")

    # Remove audio file if exists
    if transcription.audio_filename:
        audio_path = UPLOAD_DIR / transcription.audio_filename
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

    db.delete(transcription)
    db.commit()
    return {"status": "success", "message": f"Transcription {id} deleted successfully."}

@router.post("/transcriptions/bulk-delete")
def bulk_delete_transcriptions(payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete multiple transcriptions in batch."""
    if not payload.ids:
        return {"status": "success", "deleted_count": 0}

    items = db.query(Transcription).filter(Transcription.id.in_(payload.ids)).all()
    for item in items:
        if item.audio_filename:
            audio_path = UPLOAD_DIR / item.audio_filename
            if audio_path.exists():
                try:
                    audio_path.unlink()
                except Exception:
                    pass
        db.delete(item)

    db.commit()
    return {"status": "success", "deleted_count": len(items)}

# ============================================================================
# Audio Upload & Cloud STT Processing
# ============================================================================

@router.post("/transcribe/upload", response_model=TranscriptionResponse)
async def upload_and_transcribe(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    engine: str = Form("auto"),
    gemini_key: Optional[str] = Form(None),
    groq_key: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload an audio file (WAV, MP3, WebM, OGG, M4A) and transcribe it using
    Gemini Live / Groq Whisper / Open-Source STT engine, then store in DB.
    """
    import uuid
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "wav"
    saved_filename = f"upload_{uuid.uuid4().hex[:12]}.{ext}"
    saved_path = UPLOAD_DIR / saved_filename

    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)

    # Transcribe
    result = process_audio_transcription(
        audio_path=saved_path,
        engine=engine,
        gemini_key=gemini_key,
        groq_key=groq_key
    )

    content = result["text"]
    analysis = result["analysis"]
    detected_lang = analysis["label"]

    auto_title = title or file.filename.rsplit(".", 1)[0].replace("_", " ").title()

    transcription = Transcription(
        title=auto_title,
        content=content,
        language=detected_lang,
        primary_language=analysis["primary"],
        language_breakdown=json.dumps(analysis),
        confidence=result.get("confidence", 0.95),
        duration_seconds=round(len(contents) / 32000.0, 1), # estimated duration
        word_count=len(content.split()),
        audio_filename=saved_filename,
        engine_used=result.get("engine", "Uploaded Audio Engine"),
        tags="file-upload,multilingual,stt",
        is_favorite=False
    )

    db.add(transcription)
    db.commit()
    db.refresh(transcription)

    return transcription.to_dict()

# ============================================================================
# Text to Speech (TTS) Endpoints
# ============================================================================

@router.post("/tts/generate")
def create_tts(payload: TTSRequest):
    """
    Synthesize speech using open-source gTTS engine.
    Supports Hindi accent for Hinglish, and English for general text.
    """
    try:
        filename = generate_speech(payload.text, lang=payload.lang or "auto", slow=payload.slow or False)
        return {
            "status": "success",
            "audio_url": f"/api/tts/{filename}",
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation error: {str(e)}")

@router.get("/tts/{filename}")
def stream_tts_audio(filename: str):
    """Serve synthesized TTS MP3 audio."""
    file_path = get_tts_file_path(filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="TTS audio not found.")
    return FileResponse(file_path, media_type="audio/mpeg")

@router.get("/audio/{filename}")
def stream_uploaded_audio(filename: str):
    """Serve user recorded or uploaded audio."""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    
    media_type = "audio/webm"
    if filename.endswith(".wav"):
        media_type = "audio/wav"
    elif filename.endswith(".mp3"):
        media_type = "audio/mpeg"
    elif filename.endswith(".ogg"):
        media_type = "audio/ogg"

    return FileResponse(file_path, media_type=media_type)

# ============================================================================
# Multilingual Analysis Endpoint
# ============================================================================

@router.post("/analyze-text")
def analyze_text_endpoint(payload: dict):
    """Live analysis of multilingual/Hinglish text."""
    text = payload.get("text", "")
    return analyze_multilingual_text(text)

# ============================================================================
# Dashboard Statistics & Analytics
# ============================================================================

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Aggregate statistics for dashboard metrics cards and charts."""
    total_transcriptions = db.query(Transcription).count()
    if total_transcriptions == 0:
        return {
            "total_transcriptions": 0,
            "total_words": 0,
            "total_duration_seconds": 0,
            "hinglish_count": 0,
            "hinglish_pct": 0,
            "language_counts": {},
            "recent_activity": []
        }

    all_items = db.query(Transcription).all()
    total_words = sum(item.word_count for item in all_items)
    total_duration = sum(item.duration_seconds for item in all_items)

    language_counts = {}
    hinglish_count = 0
    for item in all_items:
        lang = item.language or "Unknown"
        language_counts[lang] = language_counts.get(lang, 0) + 1
        if "Hinglish" in lang or "Multilingual" in lang or "Bilingual" in lang:
            hinglish_count += 1

    hinglish_pct = round((hinglish_count / total_transcriptions) * 100, 1)

    return {
        "total_transcriptions": total_transcriptions,
        "total_words": total_words,
        "total_duration_seconds": round(total_duration, 1),
        "hinglish_count": hinglish_count,
        "hinglish_pct": hinglish_pct,
        "language_counts": language_counts,
        "recent_count": min(total_transcriptions, 5)
    }

# ============================================================================
# Export Endpoints
# ============================================================================

@router.get("/transcriptions/export")
def export_transcriptions(
    format: str = Query("json", regex="^(json|csv|txt|srt)$"),
    db: Session = Depends(get_db)
):
    """Export transcription history in JSON, CSV, Plain Text, or SRT format."""
    items = db.query(Transcription).order_by(desc(Transcription.created_at)).all()

    if format == "json":
        data = [item.to_dict() for item in items]
        return Response(
            content=json.dumps(data, indent=2, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=transcriptions_export.json"}
        )

    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Title", "Language", "Word Count", "Duration (s)", "Engine", "Created At", "Content"])
        for item in items:
            writer.writerow([
                item.id,
                item.title,
                item.language,
                item.word_count,
                item.duration_seconds,
                item.engine_used,
                item.created_at.isoformat() if item.created_at else "",
                item.content
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transcriptions_export.csv"}
        )

    elif format == "txt":
        lines = []
        for item in items:
            date_str = item.created_at.strftime('%Y-%m-%d %H:%M') if item.created_at else ""
            lines.append(f"=== [{item.id}] {item.title} ({item.language}) - {date_str} ===")
            lines.append(item.content)
            lines.append("")
        return Response(
            content="\n".join(lines),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=transcriptions_export.txt"}
        )

    elif format == "srt":
        srt_lines = []
        for idx, item in enumerate(items, 1):
            dur = max(int(item.duration_seconds), 4)
            m = dur // 60
            s = dur % 60
            srt_lines.append(str(idx))
            srt_lines.append(f"00:00:00,000 --> 00:{m:02d}:{s:02d},000")
            srt_lines.append(item.content)
            srt_lines.append("")
        return Response(
            content="\n".join(srt_lines),
            media_type="application/x-subrip; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=transcriptions.srt"}
        )

# ============================================================================
# Database & Health Status
# ============================================================================

@router.get("/health")
def health_check():
    """Health status and database runtime inspection."""
    db_info = get_db_info()
    return {
        "status": "online",
        "service": "Multilingual Speech to Text & Real-time Transcription Service",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_info
    }
