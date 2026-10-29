import os
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Online IDE & Multi-Process Execution Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Storage paths
    DATA_DIR: Path = DATA_DIR
    PROJECTS_DIR: Path = DATA_DIR / "projects"
    WORKSPACES_DIR: Path = DATA_DIR / "workspaces"
    DB_PATH: Path = DATA_DIR / "ide.db"
    
    # Execution
    EXECUTION_MODE: Literal["auto", "local", "docker"] = "auto"
    DOCKER_IMAGE: str = "ide-runner:latest"
    DEFAULT_TIMEOUT_SECONDS: int = 180
    MAX_PROCESSES_PER_SESSION: int = 10
    MAX_OUTPUT_BUFFER_LINES: int = 5000
    MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5MB
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()

# Ensure critical directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
settings.WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
