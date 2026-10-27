# VocalFlow — Real-Time Multilingual Speech-to-Text & Dashboard

A production-grade, real-time Speech-to-Text web application specializing in **multilingual code-switching (Hinglish: Hindi + English)** with **PostgreSQL relational database** storage and an interactive **CRUD operations dashboard**.

---

## 🌟 Key Features

1. **Real-Time Multilingual Speech-to-Text (Hinglish)**
   - Transcribes mixed Hindi & English sentences (e.g. *"Main kal market ja raha hoon to buy some fresh fruits and vegetables"*).
   - Zero-latency client streaming with continuous interim transcripts and confidence tracking.
   - Real-time 60fps dynamic audio visualizer powered by Web Audio API `AnalyserNode`.

2. **Multilingual Code-Switching Analyzer**
   - Automatically detects Hindi words (Devanagari Unicode & Romanized Hinglish vocabulary), English vocabulary, and code-switching transition points.
   - Computes real-time language ratio breakdown (e.g., `55% Hindi, 45% English (Hinglish)`).

3. **Multi-Engine Speech Support**
   - **Native Multilingual Real-time Engine**: Zero-latency, browser-native streaming STT.
   - **Google Gemini Live 3.1 / Flash STT API**: Code-switching audio transcription with verbatim accuracy.
   - **Open-Source Whisper Large v3 (Groq)**: Top-tier multilingual model running with sub-second turnaround.
   - **Open-Source Local Receiver**: Processes raw audio recordings without external dependencies.

4. **Relational Database Storage & CRUD Dashboard**
   - **PostgreSQL 17** integration via SQLAlchemy ORM with connection pooling.
   - **Automatic SQLite fallback**: Resilient failover ensures the system runs anywhere even without Docker.
   - **Create**: Live microphone stream recording, manual notes, audio file uploads (WAV, MP3, WebM, M4A, OGG).
   - **Read**: Search by keywords/tags, filter by language (`Hinglish`, `Hindi`, `English`), sort by date or duration.
   - **Update**: In-place edit modal for title, transcription text, tags, annotations, and favorite status.
   - **Delete**: Single item deletion and batch bulk-delete with automatic audio cleanup.
   - **Export**: Export history as JSON, CSV, Plain Text, or Subtitle (SRT) format.

5. **Open-Source Text-to-Speech (TTS)**
   - Synthesizes speech using open-source `gTTS` with MD5 cache for zero-latency replay.
   - Automatic accent detection (Hindi voice for Hinglish/Devanagari, English voice for English).
   - In-dashboard 1-click audio playback on every saved transcription.

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client["Browser Frontend (Studio + Dashboard)"]
    AudioAPI["Web Audio API & AnalyserNode"]
    SpeechRec["SpeechRecognition (Multilingual hi-IN / en-IN)"]
    WSClient["WebSocket Client (/ws/transcribe)"]
    
    FastAPI["FastAPI Backend (Port 8000)"]
    WSRoute["WebSocket Router"]
    APIRoute["REST CRUD Router (/api)"]
    LangDetect["Hinglish Code-Switch Detector"]
    TTSEngine["Open-Source gTTS Engine"]
    STTEngines["Gemini Live / Groq Whisper Engine"]
    
    Postgres[("PostgreSQL 17 Container (Port 5433)")]
    SQLite[("SQLite Fallback (transcriptions.db)")]

    Client --> AudioAPI
    Client --> SpeechRec
    Client --> WSClient
    
    WSClient <-->|Interim Transcripts & Stats| WSRoute
    Client <-->|REST API & Audio Upload| APIRoute
    
    WSRoute --> LangDetect
    APIRoute --> LangDetect
    APIRoute --> TTSEngine
    APIRoute --> STTEngines
    
    APIRoute -->|Primary Connection| Postgres
    APIRoute -.->|Graceful Fallback| SQLite
```

---

## 🚀 Quick Start Guide

### Option 1: Run Locally with Python

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the application**:
   ```bash
   python main.py
   ```
   Or using Uvicorn directly:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Open the web application**:
   Open [http://localhost:8000](http://localhost:8000) in your browser.

---

### Option 2: Run with Docker Compose

Run both the PostgreSQL database and application container:
```bash
docker compose up --build
```

---

## 🧪 Automated Testing

Run the included automated integration test suite:
```bash
python tests/test_api.py
```

This verifies:
- PostgreSQL database health check
- Transcription creation with Hinglish language analysis
- Single read & keyword search filtering
- Update title and metadata
- Open-Source TTS speech generation
- Single and bulk deletion
- Real-time metrics calculations

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transcriptions` | Create and store new transcription with Hinglish analysis |
| `GET` | `/api/transcriptions` | List transcriptions with pagination, search `q`, filter `lang`, and sort |
| `GET` | `/api/transcriptions/{id}` | Retrieve single transcription details |
| `PUT` | `/api/transcriptions/{id}` | Update title, text, tags, notes, or favorite status |
| `DELETE` | `/api/transcriptions/{id}` | Delete transcription and remove audio clip |
| `POST` | `/api/transcriptions/bulk-delete` | Batch delete multiple transcriptions |
| `POST` | `/api/transcribe/upload` | Upload audio file (WAV/MP3/WebM) and transcribe |
| `POST` | `/api/tts/generate` | Synthesize speech via open-source TTS |
| `GET` | `/api/tts/{filename}` | Stream synthesized MP3 audio |
| `GET` | `/api/audio/{filename}` | Stream user-recorded audio file |
| `GET` | `/api/dashboard/stats` | Aggregate dashboard KPI metrics |
| `GET` | `/api/transcriptions/export` | Export history in JSON, CSV, TXT, or SRT |
| `GET` | `/api/health` | Service and active database connection status |
| `WS` | `/ws/transcribe` | Real-time bidirectional WebSocket stream |

---

## ⚙️ Environment Variables (Optional)

Create a `.env` file in the root directory if customizing settings:

```env
DATABASE_URL=postgresql://ascend:ascend@localhost:5433/ascend_lms
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PORT=8000
HOST=0.0.0.0
```

*(Note: The application operates fully out-of-the-box using the native multilingual engine, open-source TTS, and PostgreSQL/SQLite even without cloud API keys).*
