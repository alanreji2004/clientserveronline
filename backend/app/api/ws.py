import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.supervisor import supervisor

logger = logging.getLogger("app.ws")
router = APIRouter(tags=["websocket"])

@router.websocket("/api/sessions/{session_id}/stream")
async def websocket_stream_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    async def session_event_listener(event: dict):
        try:
            await websocket.send_json(event)
        except Exception:
            pass

    supervisor.register_listener(session_id, session_event_listener)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to real-time process execution stream."
        })

        while True:
            raw_text = await websocket.receive_text()
            if not raw_text:
                continue

            try:
                msg = json.loads(raw_text)
                action = msg.get("action")

                if action == "stdin":
                    pid = msg.get("process_id")
                    data = msg.get("data", "")
                    if pid:
                        proc = supervisor.get_process(session_id, pid)
                        await proc.write_stdin(data)

                elif action == "stop_process":
                    pid = msg.get("process_id")
                    if pid:
                        await supervisor.stop_process(session_id, pid)

                elif action == "delete_process":
                    pid = msg.get("process_id")
                    if pid:
                        await supervisor.delete_process(session_id, pid)

                elif action == "ping":
                    await websocket.send_json({"type": "pong"})

            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"WebSocket message error: {str(e)}"
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WebSocket session {session_id} error: {e}")
    finally:
        supervisor.unregister_listener(session_id, session_event_listener)

