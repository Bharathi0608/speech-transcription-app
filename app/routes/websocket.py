import json
import logging
# pyrefly: ignore[missing-import]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect   
from app.services.language_detector import analyze_multilingual_text

logger = logging.getLogger("speech_to_text.websocket")
ws_router = APIRouter()

@ws_router.websocket("/ws/transcribe")
async def websocket_transcription_endpoint(websocket: WebSocket):
    """
    Real-time streaming WebSocket endpoint.
    Handles continuous audio streaming data, live text analysis,
    real-time Hinglish code-switching detection, and synchronization.
    """
    await websocket.accept()
    logger.info("Real-time WebSocket client connected.")

    try:
        while True:
            raw_message = await websocket.receive_text()
            try:
                data = json.loads(raw_message)
            except Exception:
                # Plain text or audio chunk notification
                data = {"action": "interim", "text": raw_message}

            action = data.get("action", "interim")

            if action == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "status": "ok"}))

            elif action == "interim" or action == "stream_text":
                # Real-time interim transcript stream from client's speech recognition engine
                current_text = data.get("text", "")
                analysis = analyze_multilingual_text(current_text)

                response_payload = {
                    "type": "interim_analysis",
                    "text": current_text,
                    "analysis": analysis,
                    "is_code_switched": analysis["is_code_switched"],
                    "hindi_pct": analysis["hindi_pct"],
                    "english_pct": analysis["english_pct"],
                    "label": analysis["label"],
                    "word_count": analysis["token_count"]
                }
                await websocket.send_text(json.dumps(response_payload))

            elif action == "finalize":
                final_text = data.get("text", "")
                analysis = analyze_multilingual_text(final_text)
                await websocket.send_text(json.dumps({
                    "type": "final_analysis",
                    "text": final_text,
                    "analysis": analysis,
                    "status": "ready_to_save"
                }))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
