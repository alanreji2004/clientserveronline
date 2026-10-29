import sys
import shutil
import subprocess
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/health")
def get_system_health():
    # Detect GCC
    gcc_path = shutil.which("gcc")
    gcc_version = None
    if gcc_path:
        try:
            res = subprocess.run([gcc_path, "--version"], capture_output=True, text=True, timeout=3)
            gcc_version = res.stdout.splitlines()[0] if res.stdout else "Available"
        except Exception:
            gcc_version = "Error checking"

    # Detect Docker
    docker_path = shutil.which("docker")
    docker_available = False
    docker_version = None
    if docker_path:
        try:
            res = subprocess.run([docker_path, "version"], capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                docker_available = True
                docker_version = "Docker Daemon Running"
            else:
                docker_version = "Docker CLI installed (Daemon not running)"
        except Exception:
            docker_version = "Unavailable"

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "platform": sys.platform,
        "python_version": sys.version,
        "gcc": {
            "available": bool(gcc_path),
            "version": gcc_version
        },
        "docker": {
            "available": docker_available,
            "status": docker_version
        },
        "execution_mode": settings.EXECUTION_MODE,
        "limits": {
            "max_processes_per_session": settings.MAX_PROCESSES_PER_SESSION,
            "default_timeout_seconds": settings.DEFAULT_TIMEOUT_SECONDS,
            "max_file_size_bytes": settings.MAX_FILE_SIZE_BYTES
        }
    }

