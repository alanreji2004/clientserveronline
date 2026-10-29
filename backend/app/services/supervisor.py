import os
import sys
import time
import signal
import asyncio
import uuid
import psutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.session import ProcessInfo, ProcessLaunchRequest

class ManagedProcess:
    def __init__(
        self,
        process_id: str,
        session_id: str,
        name: str,
        command: List[str],
        cwd: Path,
        env: Dict[str, str],
        on_event: Optional[Callable[[Dict[str, Any]], Any]] = None,
        timeout_seconds: int = 180
    ):
        self.process_id = process_id
        self.session_id = session_id
        self.name = name
        self.command = command
        self.cwd = cwd
        self.env = env
        self.on_event = on_event
        self.timeout_seconds = timeout_seconds

        self.pid: Optional[int] = None
        self.status: str = "starting"
        self.exit_code: Optional[int] = None
        self.started_at: datetime = datetime.now(timezone.utc)
        self.ended_at: Optional[datetime] = None
        
        self.output_history: List[Dict[str, Any]] = []
        self.proc: Optional[asyncio.subprocess.Process] = None
        self._reader_tasks: List[asyncio.Task] = []
        self._timeout_task: Optional[asyncio.Task] = None
        self._stopped_by_user = False

    def to_info(self) -> ProcessInfo:
        runtime = 0.0
        if self.ended_at:
            runtime = (self.ended_at - self.started_at).total_seconds()
        elif self.status == "running":
            runtime = (datetime.now(timezone.utc) - self.started_at).total_seconds()

        return ProcessInfo(
            process_id=self.process_id,
            session_id=self.session_id,
            name=self.name,
            command=self.command,
            pid=self.pid,
            status=self.status,  # type: ignore
            exit_code=self.exit_code,
            started_at=self.started_at,
            ended_at=self.ended_at,
            runtime_seconds=round(runtime, 2),
            output_line_count=len(self.output_history)
        )

    def _append_output(self, stream: str, text: str):
        event = {
            "type": "output",
            "process_id": self.process_id,
            "session_id": self.session_id,
            "stream": stream,
            "data": text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.output_history.append(event)
        if len(self.output_history) > settings.MAX_OUTPUT_BUFFER_LINES:
            self.output_history.pop(0)

        if self.on_event:
            try:
                res = self.on_event(event)
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

    async def _stream_reader(self, stream: asyncio.StreamReader, stream_name: str):
        try:
            while not stream.at_eof():
                line_bytes = await stream.readline()
                if not line_bytes:
                    break
                text = line_bytes.decode("utf-8", errors="replace")
                self._append_output(stream_name, text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self._append_output("system", f"[Stream error ({stream_name}): {str(e)}]\n")

    async def _timeout_guard(self):
        try:
            await asyncio.sleep(self.timeout_seconds)
            if self.status == "running":
                self._append_output("system", f"\n[!] Execution timeout reached ({self.timeout_seconds}s). Terminating process.\n")
                await self.stop()
        except asyncio.CancelledError:
            pass

    async def start(self):
        try:
            # Platform specific subprocess setup
            is_win = sys.platform == "win32"
            creationflags = 0
            if is_win:
                creationflags = 0x00000200  # CREATE_NEW_PROCESS_GROUP

            # Inject unbuffered python env
            env = os.environ.copy()
            env.update(self.env)
            env["PYTHONUNBUFFERED"] = "1"

            self.proc = await asyncio.create_subprocess_exec(
                *self.command,
                cwd=str(self.cwd),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                creationflags=creationflags if is_win else 0,
                preexec_fn=None if is_win else os.setsid
            )

            self.pid = self.proc.pid
            self.status = "running"

            self._append_output("system", f"[*] Process '{self.name}' started (PID: {self.pid})\n")
            self._append_output("system", f"[*] Command: {' '.join(self.command)}\n\n")

            # Spawn stream readers
            t_out = asyncio.create_task(self._stream_reader(self.proc.stdout, "stdout"))
            t_err = asyncio.create_task(self._stream_reader(self.proc.stderr, "stderr"))
            self._reader_tasks = [t_out, t_err]

            # Start timeout guard
            self._timeout_task = asyncio.create_task(self._timeout_guard())

            # Spawn monitor task to wait for exit
            asyncio.create_task(self._wait_for_exit())

        except Exception as e:
            self.status = "error"
            self.ended_at = datetime.now(timezone.utc)
            self._append_output("system", f"[ERROR] Failed to start process: {str(e)}\n")
            if self.on_event:
                self._broadcast_status_change()
            raise HTTPException(status_code=500, detail=f"Failed to launch process: {str(e)}")

    async def _wait_for_exit(self):
        if not self.proc:
            return
        returncode = await self.proc.wait()
        self.ended_at = datetime.now(timezone.utc)
        self.exit_code = returncode

        if self._timeout_task and not self._timeout_task.done():
            self._timeout_task.cancel()

        if self._stopped_by_user:
            self.status = "stopped"
        elif returncode == 0:
            self.status = "exited"
        else:
            self.status = "error"

        self._append_output("system", f"\n[*] Process exited with code {returncode}\n")
        self._broadcast_status_change()

    def _broadcast_status_change(self):
        runtime = 0.0
        if self.ended_at:
            runtime = (self.ended_at - self.started_at).total_seconds()
        event = {
            "type": "status_change",
            "process_id": self.process_id,
            "session_id": self.session_id,
            "name": self.name,
            "status": self.status,
            "exit_code": self.exit_code,
            "runtime_seconds": round(runtime, 2)
        }
        if self.on_event:
            try:
                res = self.on_event(event)
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception:
                pass

    async def write_stdin(self, text: str):
        if not self.proc or self.status != "running" or not self.proc.stdin:
            raise HTTPException(status_code=400, detail="Process is not running or stdin is closed.")
            
        data = text if text.endswith("\n") else f"{text}\n"
        try:
            self.proc.stdin.write(data.encode("utf-8"))
            await self.proc.stdin.drain()
            self._append_output("stdin", data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write to stdin: {str(e)}")

    async def stop(self):
        if not self.proc or self.status not in ("starting", "running"):
            return

        self._stopped_by_user = True
        try:
            if sys.platform == "win32":
                # Kill process tree cleanly using taskkill or psutil
                try:
                    p = psutil.Process(self.pid)
                    for child in p.children(recursive=True):
                        child.kill()
                    p.kill()
                except Exception:
                    # Fallback to os taskkill
                    os.system(f"taskkill /F /T /PID {self.pid} >nul 2>&1")
            else:
                try:
                    os.killpg(os.getpgid(self.pid), signal.SIGTERM)
                    await asyncio.sleep(0.5)
                    if self.proc.returncode is None:
                        os.killpg(os.getpgid(self.pid), signal.SIGKILL)
                except Exception:
                    self.proc.kill()
        except Exception as e:
            self._append_output("system", f"[Warning: Process termination issue: {e}]\n")

        self.status = "stopped"
        self.ended_at = datetime.now(timezone.utc)
        self._broadcast_status_change()

class ProcessSupervisor:
    def __init__(self):
        # session_id -> { process_id -> ManagedProcess }
        self.sessions: Dict[str, Dict[str, ManagedProcess]] = {}
        # session_id -> list of callbacks
        self.listeners: Dict[str, List[Callable[[Dict[str, Any]], Any]]] = {}

    def register_listener(self, session_id: str, callback: Callable[[Dict[str, Any]], Any]):
        if session_id not in self.listeners:
            self.listeners[session_id] = []
        self.listeners[session_id].append(callback)

    def unregister_listener(self, session_id: str, callback: Callable[[Dict[str, Any]], Any]):
        if session_id in self.listeners:
            if callback in self.listeners[session_id]:
                self.listeners[session_id].remove(callback)
            if not self.listeners[session_id]:
                del self.listeners[session_id]

    async def broadcast_to_session(self, session_id: str, event: Dict[str, Any]):
        listeners = self.listeners.get(session_id, [])
        for cb in list(listeners):
            try:
                res = cb(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass

    async def launch_process(
        self,
        session_id: str,
        workspace_dir: Path,
        req: ProcessLaunchRequest
    ) -> ProcessInfo:
        if session_id not in self.sessions:
            self.sessions[session_id] = {}

        # Check max processes limit
        active_count = sum(1 for p in self.sessions[session_id].values() if p.status in ("starting", "running"))
        if active_count >= settings.MAX_PROCESSES_PER_SESSION:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum concurrent processes ({settings.MAX_PROCESSES_PER_SESSION}) reached for this session."
            )

        process_id = str(uuid.uuid4())[:8]

        # Determine executable command
        if req.command_type == "python":
            entry = req.entry_point.strip()
            # Verify file exists in workspace
            target = workspace_dir / entry
            if not target.exists():
                raise HTTPException(status_code=400, detail=f"Python file '{entry}' does not exist in workspace.")
            cmd = [sys.executable, "-u", entry] + (req.args or [])
        elif req.command_type == "binary":
            entry = req.entry_point.strip()
            # If on Windows, check for .exe extension
            if sys.platform == "win32" and not entry.endswith(".exe"):
                if (workspace_dir / f"{entry}.exe").exists():
                    entry = f"{entry}.exe"
            
            target = workspace_dir / entry
            if not target.exists():
                raise HTTPException(status_code=400, detail=f"Binary '{entry}' does not exist. Did you compile it first?")
            
            # Make executable on Unix
            if sys.platform != "win32":
                try:
                    os.chmod(target, 0o755)
                except Exception:
                    pass
                cmd = [f"./{entry}"] + (req.args or [])
            else:
                cmd = [str(target)] + (req.args or [])
        else:
            raise HTTPException(status_code=400, detail="Unsupported command type.")

        async def on_event(evt):
            await self.broadcast_to_session(session_id, evt)

        proc = ManagedProcess(
            process_id=process_id,
            session_id=session_id,
            name=req.name,
            command=cmd,
            cwd=workspace_dir,
            env=req.env_vars or {},
            on_event=on_event,
            timeout_seconds=settings.DEFAULT_TIMEOUT_SECONDS
        )

        self.sessions[session_id][process_id] = proc
        await proc.start()
        return proc.to_info()

    def get_processes(self, session_id: str) -> List[ProcessInfo]:
        if session_id not in self.sessions:
            return []
        return [p.to_info() for p in self.sessions[session_id].values()]

    def get_process(self, session_id: str, process_id: str) -> ManagedProcess:
        if session_id not in self.sessions or process_id not in self.sessions[session_id]:
            raise HTTPException(status_code=404, detail=f"Process '{process_id}' not found in session.")
        return self.sessions[session_id][process_id]

    async def stop_process(self, session_id: str, process_id: str) -> ProcessInfo:
        proc = self.get_process(session_id, process_id)
        await proc.stop()
        return proc.to_info()

    async def stop_all_session_processes(self, session_id: str):
        if session_id in self.sessions:
            for proc in self.sessions[session_id].values():
                await proc.stop()

    def get_history(self, session_id: str, process_id: str) -> List[Dict[str, Any]]:
        proc = self.get_process(session_id, process_id)
        return proc.output_history

supervisor = ProcessSupervisor()

