import os
import re
from pathlib import Path
from fastapi import HTTPException

# Disallow path traversal patterns and dangerous filenames
TRAVERSAL_PATTERN = re.compile(r"(\.\./|\.\.\\|/\.\.|\\\.\.)")
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\./]+$")

def sanitize_relative_path(rel_path: str) -> str:
    """
    Sanitizes and validates a relative file path within a project or workspace.
    Raises HTTPException 400 on unsafe or invalid paths.
    """
    clean_path = rel_path.strip().replace("\\", "/")
    while clean_path.startswith("/"):
        clean_path = clean_path[1:]

    if not clean_path:
        raise HTTPException(status_code=400, detail="Path cannot be empty.")
        
    if TRAVERSAL_PATTERN.search(clean_path):
        raise HTTPException(status_code=400, detail="Invalid path: Directory traversal not allowed.")
        
    parts = clean_path.split("/")
    for part in parts:
        if part in (".", "..", ""):
            raise HTTPException(status_code=400, detail=f"Invalid path segment: '{part}'")
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", part):
            raise HTTPException(status_code=400, detail=f"Invalid characters in path segment: '{part}'")
            
    return clean_path

def resolve_safe_path(base_dir: Path, rel_path: str) -> Path:
    """
    Resolves a relative path against a base directory and strictly verifies
    that the resolved path is inside base_dir.
    """
    sanitized = sanitize_relative_path(rel_path)
    base_dir = base_dir.resolve()
    target_path = (base_dir / sanitized).resolve()
    
    try:
        target_path.relative_to(base_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Resolved path is outside authorized workspace.")
        
    return target_path

