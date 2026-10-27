
# VocalFlow — Real-Time Multilingual Speech-to-Text & Dashboard

A real-time Speech-to-Text web application specializing in multilingual code-switching (Hinglish: Hindi + English), with PostgreSQL database storage and an interactive CRUD dashboard.




## 📸 Application Screenshots

### Screenshot 1
![VocalFlow Screenshot 1](./screenshots/1.jpeg)

### Screenshot 2
![VocalFlow Screenshot 2](./screenshots/2.jpeg)

### Screenshot 3
![VocalFlow Screenshot 3](./screenshots/3.jpeg)

### Screenshot 4
![VocalFlow Screenshot 4](./screenshots/4.jpeg)



## 🌟 Key Features

### 1. Real-Time Multilingual Speech-to-Text
- Transcribes mixed Hindi and English sentences, such as *"Main kal market ja raha hoon to buy some fresh fruits and vegetables."*
- Supports continuous interim transcripts and confidence tracking.
- Provides a dynamic audio visualizer using the Web Audio API `AnalyserNode`.

### 2. Multilingual Code-Switching Analyzer
- Detects Hindi words using Devanagari Unicode and Romanized Hinglish vocabulary.
- Identifies English vocabulary and language-switching points.
- Computes language-ratio breakdowns, such as 55% Hindi and 45% English.

### 3. Multi-Engine Speech Support
- **Browser-native speech recognition:** Real-time speech recognition using the browser's supported speech engine.
- **Google Gemini API:** Speech transcription using a configured Gemini model.
- **Groq Whisper:** Multilingual transcription using a supported Whisper model.
- **Local audio processing:** Processes uploaded audio using the application's configured transcription implementation.

### 4. Database Storage & CRUD Dashboard
- PostgreSQL integration using SQLAlchemy ORM and connection pooling.
- SQLite fallback, if supported by the application's database initialization logic.
- **Create:** Save microphone recordings, manual notes, and supported audio uploads.
- **Read:** Search transcriptions by keywords and tags, filter by language, and sort records.
- **Update:** Edit transcription titles, text, tags, notes, and favorite status.
- **Delete:** Delete individual records or multiple records.
- **Export:** Export transcription history in JSON, CSV, TXT, or SRT format, if implemented.

### 5. Text-to-Speech
- Generate speech using Google Text-to-Speech (`gTTS`).
- Cache generated audio when supported by the implementation.
- Select an appropriate language voice based on the detected language.
- Play generated speech from saved transcription records.

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client["Browser Frontend: Studio and Dashboard"]
    AudioAPI["Web Audio API and AnalyserNode"]
    SpeechRec["Browser Speech Recognition"]
    WSClient["WebSocket Client"]

    FastAPI["FastAPI Backend"]
    WSRoute["WebSocket Router"]
    APIRoute["REST API Router"]
    LangDetect["Hinglish Language Detector"]
    TTSEngine["Text-to-Speech Engine"]
    STTEngines["Configured Speech-to-Text Engines"]

    Postgres[("PostgreSQL")]
    SQLite[("SQLite Fallback")]

    Client --> AudioAPI
    Client --> SpeechRec
    Client --> WSClient

    WSClient <-->|Transcripts and Statistics| WSRoute
    Client <-->|REST API and Audio Upload| APIRoute

    WSRoute --> LangDetect
    APIRoute --> LangDetect
    APIRoute --> TTSEngine
    APIRoute --> STTEngines

    APIRoute --> Postgres
    APIRoute -.-> SQLite
```

## 🚀 Quick Start Guide

### Option 1: Run Locally with Python

**1. Clone the repository**

```bash
git clone https://github.com/Bharathi0608/speech-transcription-app.git
cd speech-transcription-app
```

**2. Create and activate a virtual environment**

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

**3. Install dependencies**

```bash
python -m pip install -r requirements.txt
```

**4. Configure environment variables**

Create a `.env` file in the project root if your application requires environment variables.

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5433/DATABASE_NAME
GEMINI_API_KEY=
GROQ_API_KEY=
PORT=8000
HOST=127.0.0.1
```

Replace the database placeholders with your actual local database configuration. Add API keys only if required by the corresponding features. Never commit real credentials to GitHub.

**5. Start the application**

If your project defines an application entry point in `main.py`, run:

```bash
python -m uvicorn main:app --reload
```

Alternatively, if `python main.py` is configured to start the server, use:

```bash
python main.py
```

**6. Open the application**

Visit:

http://localhost:8000

### Option 2: Run with Docker Compose

If the repository includes a correctly configured `compose.yaml` or `docker-compose.yml`, run:

```bash
docker compose up --build
```

Stop the containers with:

```bash
docker compose down
```

## 🧪 Automated Testing

If the project includes `tests/test_api.py`, run:

```bash
python -m pytest tests/
```

Alternatively, if the file is a standalone test script:

```bash
python tests/test_api.py
```

The actual test coverage depends on the tests implemented in the repository.

## 📡 REST API Reference

The following table describes the intended API design. Confirm that each endpoint exists in your backend before relying on it.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transcriptions` | Create a transcription |
| `GET` | `/api/transcriptions` | List, search, filter, and sort transcriptions |
| `GET` | `/api/transcriptions/{id}` | Retrieve a transcription |
| `PUT` | `/api/transcriptions/{id}` | Update transcription details |
| `DELETE` | `/api/transcriptions/{id}` | Delete a transcription |
| `POST` | `/api/transcriptions/bulk-delete` | Delete multiple transcriptions |
| `POST` | `/api/transcribe/upload` | Upload and transcribe an audio file |
| `POST` | `/api/tts/generate` | Generate speech from text |
| `GET` | `/api/tts/{filename}` | Retrieve generated speech audio |
| `GET` | `/api/audio/{filename}` | Retrieve a saved audio file |
| `GET` | `/api/dashboard/stats` | Retrieve dashboard statistics |
| `GET` | `/api/transcriptions/export` | Export transcription history |
| `GET` | `/api/health` | Check application health |
| `WS` | `/ws/transcribe` | WebSocket transcription connection |

## ⚙️ Environment Variables

Configure only the variables supported by your application.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Database connection string |
| `GEMINI_API_KEY` | API key for the configured Gemini integration |
| `GROQ_API_KEY` | API key for the configured Groq integration |
| `PORT` | Application port, if supported |
| `HOST` | Application host, if supported |

**Security note:** Keep `.env`, API keys, passwords, and production database credentials out of version control. Add `.env` to `.gitignore`.

## 🛠️ Technology Stack

- **Backend:** Python, FastAPI
- **Database:** PostgreSQL, SQLite (if configured)
- **ORM:** SQLAlchemy
- **Frontend:** Browser-based web technologies
- **Real-time communication:** WebSocket and Web Audio API
- **Speech recognition:** Browser speech recognition and configured external transcription engines
- **Text-to-speech:** gTTS
- **Development tools:** Git, GitHub, Python virtual environments

## 📌 Project Goals

- Simplify speech transcription for multilingual users.
- Support Hindi-English code-switching analysis.
- Store and manage transcription history.
- Provide a convenient interface for searching, editing, and exporting transcriptions.
- Offer a modular architecture for integrating speech recognition and text-to-speech engines.

## 📄 License

Add a license file if you intend to distribute the project as open source.

---

**VocalFlow — Real-Time Multilingual Speech-to-Text & Dashboard**
