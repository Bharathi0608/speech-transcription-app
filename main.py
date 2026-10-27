import os
import json
from pathlib import Path
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import HOST, PORT, DEBUG, BASE_DIR
from app.database import init_db, get_db, SessionLocal
from app.models import Transcription
from app.routes.api import router as api_router
from app.routes.websocket import ws_router
from app.services.language_detector import analyze_multilingual_text
from app.services.tts_service import generate_speech

app = FastAPI(
    title="Real-Time Multilingual Speech-to-Text Studio",
    description="Multilingual Hinglish real-time transcription service with PostgreSQL and live CRUD dashboard",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static and templates
static_dir = BASE_DIR / "app" / "static"
templates_dir = BASE_DIR / "templates"

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
templates = Jinja2Templates(directory=str(templates_dir))

# Include routers
app.include_router(api_router)
app.include_router(ws_router)

def seed_sample_transcriptions():
    """Seed initial multilingual and Hinglish samples if database is empty."""
    db = SessionLocal()
    try:
        count = db.query(Transcription).count()
        if count == 0:
            samples = [
                {
                    "title": "Grocery Shopping Hinglish Note",
                    "content": "Main kal subah market ja raha hoon to buy some fresh fruits and organic groceries for our team lunch.",
                    "duration": 5.8,
                    "engine": "Real-time Multilingual Engine",
                    "tags": "hinglish,daily-notes,multilingual",
                    "favorite": True,
                    "notes": "Spoken in mixed Hindi and English code-switching."
                },
                {
                    "title": "Sprint Review & Architecture Standup",
                    "content": "Aaj ka sprint review session bahut productive tha, we completed all the assigned deployment tasks on PostgreSQL.",
                    "duration": 6.4,
                    "engine": "Gemini Live 3.1 / Flash STT",
                    "tags": "work,standup,database",
                    "favorite": True,
                    "notes": "Code-switched technical discussion."
                },
                {
                    "title": "Devanagari Hindi Project Update",
                    "content": "हम इस नए रियल-टाइम ट्रांसक्रिप्शन प्रोजेक्ट पर काम कर रहे हैं और डेटाबेस में सभी रिकॉर्ड्स सुरक्षित रूप से स्टोर हो रहे हैं।",
                    "duration": 7.2,
                    "engine": "Real-time Multilingual Engine",
                    "tags": "hindi,devanagari,project",
                    "favorite": False,
                    "notes": "Pure Devanagari Hindi transcription."
                },
                {
                    "title": "Client Meeting Overview",
                    "content": "Our distributed system is connected with PostgreSQL database container and automatically transcribes multilingual voice input.",
                    "duration": 5.1,
                    "engine": "Open-Source Whisper Large v3",
                    "tags": "english,architecture,system",
                    "favorite": False,
                    "notes": "Technical English audio transcription."
                }
            ]

            for s in samples:
                analysis = analyze_multilingual_text(s["content"])
                
                # Pre-generate TTS sample audio for instant demo playback
                audio_file = None
                try:
                    audio_file = generate_speech(s["content"], lang="hi" if "Hindi" in analysis["label"] or "Hinglish" in analysis["label"] else "en")
                except Exception:
                    pass

                item = Transcription(
                    title=s["title"],
                    content=s["content"],
                    language=analysis["label"],
                    primary_language=analysis["primary"],
                    language_breakdown=json.dumps(analysis),
                    confidence=0.96,
                    duration_seconds=s["duration"],
                    word_count=len(s["content"].split()),
                    audio_filename=audio_file,
                    engine_used=s["engine"],
                    tags=s["tags"],
                    is_favorite=s["favorite"],
                    notes=s["notes"]
                )
                db.add(item)
            db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    init_db()
    seed_sample_transcriptions()

@app.get("/")
def home(request: Request):
    """Serve the modern Single Page Application studio and dashboard."""
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
