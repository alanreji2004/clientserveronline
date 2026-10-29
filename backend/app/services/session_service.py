import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, List
from fastapi import HTTPException

from app.core.config import settings
from app.services.project_service import project_service
from app.services.supervisor import supervisor
from app.schemas.session import SessionResponse, ProcessInfo

SESSION_META_FILE = ".session.json"

class SessionService:
    def __init__(self):
        self.workspaces_base = settings.WORKSPACES_DIR
        self.workspaces_base.mkdir(parents=True, exist_ok=True)
        # session_id -> { "session_id", "project_id", "status", "created_at", "workspace_dir" }
        self._active_sessions: Dict[str, dict] = {}

    def create_session(self, project_id: str) -> SessionResponse:
        session_id = str(uuid.uuid4())[:8]
        workspace_dir = (self.workspaces_base / session_id).resolve()
        workspace_dir.mkdir(parents=True, exist_ok=True)

        # Synchronize project files to this isolated session workspace
        project_service.copy_to_workspace(project_id, workspace_dir)

        now = datetime.now(timezone.utc)
        meta = {
            "session_id": session_id,
            "project_id": project_id,
            "status": "active",
            "execution_mode": settings.EXECUTION_MODE,
            "created_at": now,
            "workspace_dir": workspace_dir
        }
        self._active_sessions[session_id] = meta

        # Persist session metadata on disk so restarts/reloads do not lose sessions
        try:
            with open(workspace_dir / SESSION_META_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "session_id": session_id,
                    "project_id": project_id,
                    "status": "active",
                    "execution_mode": settings.EXECUTION_MODE,
                    "created_at": now.isoformat()
                }, f, indent=2)
        except Exception:
            pass

        return SessionResponse(
            session_id=session_id,
            project_id=project_id,
            status="active",
            execution_mode=settings.EXECUTION_MODE,
            created_at=now,
            active_processes=[]
        )

    def get_session(self, session_id: str) -> dict:
        if session_id not in self._active_sessions:
            # Check if workspace directory with .session.json exists on disk
            meta_path = self.workspaces_base / session_id / SESSION_META_FILE
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        disk_meta = json.load(f)
                    disk_meta["workspace_dir"] = (self.workspaces_base / session_id).resolve()
                    disk_meta["created_at"] = datetime.fromisoformat(disk_meta.get("created_at", datetime.now(timezone.utc).isoformat()))
                    self._active_sessions[session_id] = disk_meta
                    return disk_meta
                except Exception:
                    pass
            raise HTTPException(status_code=404, detail="Session not found.")
        return self._active_sessions[session_id]

    def get_workspace_dir(self, session_id: str) -> Path:
        sess = self.get_session(session_id)
        return sess["workspace_dir"]

    def sync_project_files_to_workspace(self, session_id: str):
        """Refreshes workspace with latest saved project files."""
        sess = self.get_session(session_id)
        project_service.copy_to_workspace(sess["project_id"], sess["workspace_dir"])

    async def stop_session(self, session_id: str):
        if session_id in self._active_sessions:
            # Terminate all processes
            await supervisor.stop_all_session_processes(session_id)
            self._active_sessions[session_id]["status"] = "terminated"
            
            # Optionally clean up workspace directory
            workspace_dir = self._active_sessions[session_id]["workspace_dir"]
            shutil.rmtree(workspace_dir, ignore_errors=True)

    def get_session_info(self, session_id: str) -> SessionResponse:
        sess = self.get_session(session_id)
        processes = supervisor.get_processes(session_id)
        return SessionResponse(
            session_id=session_id,
            project_id=sess["project_id"],
            status=sess["status"],
            execution_mode=sess["execution_mode"],
            created_at=sess["created_at"],
            active_processes=processes
        )

session_service = SessionService()

