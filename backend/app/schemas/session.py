from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

class Diagnostic(BaseModel):
    file: str
    line: int
    column: int
    severity: Literal["error", "warning", "note"]
    message: str

class CompileRequest(BaseModel):
    source_files: List[str] = Field(..., description="List of C files to compile, e.g. ['server.c'] or ['client.c']")
    output_binary: str = Field(..., description="Desired executable name, e.g. 'server' or 'client'")
    compiler_flags: Optional[List[str]] = Field(default=["-Wall", "-Wextra", "-O0", "-g"])

class CompileResponse(BaseModel):
    success: bool
    output_binary: Optional[str] = None
    stdout: str = ""
    stderr: str = ""
    diagnostics: List[Diagnostic] = []
    duration_ms: float = 0.0

class ProcessLaunchRequest(BaseModel):
    name: str = Field(..., description="Human readable name, e.g. 'Server' or 'Client'")
    command_type: Literal["python", "binary", "custom"] = "python"
    entry_point: str = Field(..., description="Target script or binary path, e.g. 'server.py' or 'server'")
    args: Optional[List[str]] = Field(default_factory=list)
    env_vars: Optional[Dict[str, str]] = Field(default_factory=dict)
    run_id: Optional[str] = Field(default=None, description="Optional unique ID identifying this execution run")

class ProcessInfo(BaseModel):
    process_id: str
    session_id: str
    name: str
    command: List[str]
    pid: Optional[int] = None
    status: Literal["starting", "running", "stopped", "exited", "error"]
    exit_code: Optional[int] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    runtime_seconds: float = 0.0
    output_line_count: int = 0
    run_id: Optional[str] = None

class ProcessStdinRequest(BaseModel):
    input_text: str

class SessionCreate(BaseModel):
    project_id: str

class SessionResponse(BaseModel):
    session_id: str
    project_id: str
    status: Literal["active", "terminated"]
    execution_mode: str
    created_at: datetime
    active_processes: List[ProcessInfo] = []

