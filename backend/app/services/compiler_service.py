import os
import re
import sys
import time
import asyncio
from pathlib import Path
from typing import List, Tuple
from fastapi import HTTPException

from app.core.security import resolve_safe_path
from app.schemas.session import CompileRequest, CompileResponse, Diagnostic

GCC_DIAGNOSTIC_REGEX = re.compile(
    r"^(?P<file>[^:\n]+):(?P<line>\d+):(?P<col>\d+):\s+(?P<severity>error|warning|fatal error|note):\s+(?P<msg>.+)$",
    re.MULTILINE
)

class CompilerService:
    def __init__(self):
        self.is_windows = sys.platform == "win32"

    def parse_diagnostics(self, stderr_text: str, workspace_dir: Path) -> List[Diagnostic]:
        diagnostics: List[Diagnostic] = []
        for match in GCC_DIAGNOSTIC_REGEX.finditer(stderr_text):
            raw_file = match.group("file").strip()
            # Normalize file relative to workspace
            try:
                p = Path(raw_file)
                if p.is_absolute():
                    rel = p.relative_to(workspace_dir).as_posix()
                else:
                    rel = p.as_posix()
            except Exception:
                rel = raw_file

            sev = match.group("severity").lower()
            if "error" in sev:
                severity = "error"
            elif "warning" in sev:
                severity = "warning"
            else:
                severity = "note"

            if ".ide_unbuf" in rel:
                continue

            diagnostics.append(Diagnostic(
                file=rel,
                line=int(match.group("line")),
                column=int(match.group("col")),
                severity=severity,
                message=match.group("msg").strip()
            ))
        return diagnostics

    async def compile_c(self, workspace_dir: Path, req: CompileRequest) -> CompileResponse:
        start_time = time.time()
        
        # 1. Validate source files
        safe_sources: List[str] = []
        for src in req.source_files:
            p = resolve_safe_path(workspace_dir, src)
            if not p.exists():
                raise HTTPException(status_code=400, detail=f"Source file '{src}' does not exist.")
            # Use relative path inside workspace
            safe_sources.append(p.name)

        # 2. Output binary name
        out_name = req.output_binary.strip()
        if not re.match(r"^[a-zA-Z0-9_\-]+$", out_name):
            raise HTTPException(status_code=400, detail="Invalid output binary name.")
        
        if self.is_windows and not out_name.endswith(".exe"):
            binary_filename = f"{out_name}.exe"
        else:
            binary_filename = out_name

        out_path = workspace_dir / binary_filename

        # Write unbuffering runtime constructor helper into workspace to eliminate pipe block-buffering
        unbuf_c = workspace_dir / ".ide_unbuf.c"
        try:
            with open(unbuf_c, "w", encoding="utf-8") as f:
                f.write(
                    "#include <stdio.h>\n"
                    "__attribute__((constructor))\n"
                    "static void __ide_init_unbuf(void) {\n"
                    "    setvbuf(stdout, NULL, _IONBF, 0);\n"
                    "    setvbuf(stderr, NULL, _IONBF, 0);\n"
                    "}\n"
                )
        except Exception:
            pass

        # 3. Assemble compiler command
        cmd = ["gcc"]
        
        # Allowed flags to prevent malicious options
        allowed_flags = {"-Wall", "-Wextra", "-O0", "-O1", "-O2", "-O3", "-g", "-std=c11", "-std=c99", "-pthread"}
        flags = [f for f in req.compiler_flags if f in allowed_flags]
        if not flags:
            flags = ["-Wall", "-Wextra", "-O0", "-g"]
            
        cmd.extend(flags)
        cmd.extend(safe_sources)
        if unbuf_c.exists():
            cmd.append(".ide_unbuf.c")
        cmd.extend(["-o", binary_filename])

        # If on Windows, link ws2_32 for sockets
        if self.is_windows:
            cmd.append("-lws2_32")

        # 4. Execute gcc process
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(workspace_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout_data, stderr_data = await proc.communicate()
            stdout_text = stdout_data.decode("utf-8", errors="replace")
            stderr_text = stderr_data.decode("utf-8", errors="replace")
            returncode = proc.returncode

        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="GCC compiler not found on system PATH.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Compiler execution failed: {str(e)}")

        duration_ms = (time.time() - start_time) * 1000.0
        success = (returncode == 0) and out_path.exists()
        diagnostics = self.parse_diagnostics(stderr_text, workspace_dir)

        return CompileResponse(
            success=success,
            output_binary=binary_filename if success else None,
            stdout=stdout_text,
            stderr=stderr_text,
            diagnostics=diagnostics,
            duration_ms=round(duration_ms, 2)
        )

compiler_service = CompilerService()

