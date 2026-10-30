from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.schemas.session import (
    SessionCreate, SessionResponse, ProcessLaunchRequest,
    ProcessInfo, ProcessStdinRequest, CompileRequest, CompileResponse
)
from app.services.session_service import session_service
from app.services.compiler_service import compiler_service
from app.services.supervisor import supervisor

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("", response_model=SessionResponse)
def create_session(req: SessionCreate):
    return session_service.create_session(req.project_id)

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str):
    return session_service.get_session_info(session_id)

@router.post("/{session_id}/sync")
def sync_session_files(session_id: str):
    session_service.sync_project_files_to_workspace(session_id)
    return {"message": "Workspace files synchronized with project."}

@router.post("/{session_id}/compile", response_model=CompileResponse)
async def compile_c_code(session_id: str, req: CompileRequest):
    # Ensure workspace files are up to date
    session_service.sync_project_files_to_workspace(session_id)
    workspace_dir = session_service.get_workspace_dir(session_id)
    
    result = await compiler_service.compile_c(workspace_dir, req)
    
    # Broadcast compile event via WebSocket if listeners are active
    evt = {
        "type": "compile_result",
        "session_id": session_id,
        "success": result.success,
        "output_binary": result.output_binary,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "diagnostics": [d.model_dump() for d in result.diagnostics],
        "duration_ms": result.duration_ms
    }
    await supervisor.broadcast_to_session(session_id, evt)
    
    return result

@router.post("/{session_id}/processes", response_model=ProcessInfo)
async def launch_process(session_id: str, req: ProcessLaunchRequest):
    # Ensure workspace is synced with project changes before running
    session_service.sync_project_files_to_workspace(session_id)
    workspace_dir = session_service.get_workspace_dir(session_id)
    return await supervisor.launch_process(session_id, workspace_dir, req)

@router.get("/{session_id}/processes", response_model=List[ProcessInfo])
def list_processes(session_id: str):
    return supervisor.get_processes(session_id)

@router.get("/{session_id}/processes/{process_id}/history", response_model=List[Dict[str, Any]])
def get_process_history(session_id: str, process_id: str):
    return supervisor.get_history(session_id, process_id)

@router.post("/{session_id}/processes/{process_id}/stdin")
async def send_stdin(session_id: str, process_id: str, req: ProcessStdinRequest):
    proc = supervisor.get_process(session_id, process_id)
    await proc.write_stdin(req.input_text)
    return {"message": "Stdin written."}

@router.post("/{session_id}/processes/{process_id}/stop", response_model=ProcessInfo)
async def stop_process(session_id: str, process_id: str):
    return await supervisor.stop_process(session_id, process_id)

@router.post("/lifecycle/stop_all")
async def stop_all_active_execution():
    """
    Centralized execution lifecycle manager:
    Stops all running processes across all active execution sessions and releases ports.
    """
    stopped_count = await supervisor.stop_all_active_execution()
    return {"message": "All active execution processes stopped.", "stopped_count": stopped_count}

@router.delete("/{session_id}/processes/{process_id}")
async def delete_process(session_id: str, process_id: str):
    """
    Stops the process if running, cleans up child processes, and deletes the terminal.
    """
    await supervisor.delete_process(session_id, process_id)
    return {"message": f"Process {process_id} deleted."}

@router.post("/{session_id}/stop_all_processes")
async def stop_all_session_processes(session_id: str):
    """
    Stops all running processes inside this specific session.
    """
    await supervisor.stop_all_session_processes(session_id)
    return {"message": "All session processes stopped."}

@router.post("/{session_id}/stop")
async def stop_session(session_id: str):
    await session_service.stop_session(session_id)
    return {"message": "Session terminated and all processes stopped."}

