from typing import Optional, Literal, Dict, Any, List
from pydantic import BaseModel

class WSOutputMessage(BaseModel):
    type: Literal["output"] = "output"
    process_id: str
    stream: Literal["stdout", "stderr", "system"]
    data: str
    timestamp: str

class WSStatusMessage(BaseModel):
    type: Literal["status_change"] = "status_change"
    process_id: str
    status: Literal["starting", "running", "stopped", "exited", "error"]
    exit_code: Optional[int] = None
    runtime_seconds: float = 0.0

class WSCompileMessage(BaseModel):
    type: Literal["compile_result"] = "compile_result"
    success: bool
    output_binary: Optional[str] = None
    diagnostics: List[Dict[str, Any]] = []
    duration_ms: float = 0.0

class WSClientMessage(BaseModel):
    action: Literal["stdin", "stop_process", "ping"]
    process_id: Optional[str] = None
    data: Optional[str] = None

