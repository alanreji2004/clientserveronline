import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import resolve_safe_path, sanitize_relative_path
from app.schemas.project import ProjectCreate, ProjectResponse, FileItem, FileContent
from app.templates.registry import TEMPLATES_DATA, TEMPLATE_METADATA

PROJECT_META_FILE = ".project.json"

class ProjectService:
    def __init__(self):
        self.base_dir = settings.PROJECTS_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_project_dir(self, project_id: str) -> Path:
        # Prevent ID manipulation
        clean_id = sanitize_relative_path(project_id)
        proj_dir = (self.base_dir / clean_id).resolve()
        if not proj_dir.exists() or not proj_dir.is_dir():
            raise HTTPException(status_code=404, detail="Project not found.")
        return proj_dir

    def _read_metadata(self, proj_dir: Path) -> dict:
        meta_file = proj_dir / PROJECT_META_FILE
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _write_metadata(self, proj_dir: Path, data: dict):
        meta_file = proj_dir / PROJECT_META_FILE
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def list_projects(self) -> List[dict]:
        projects = []
        for entry in self.base_dir.iterdir():
            if entry.is_dir():
                meta = self._read_metadata(entry)
                if meta:
                    projects.append({
                        "id": meta.get("id", entry.name),
                        "name": meta.get("name", entry.name),
                        "description": meta.get("description", ""),
                        "template": meta.get("template"),
                        "created_at": meta.get("created_at"),
                        "updated_at": meta.get("updated_at")
                    })
        projects.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
        return projects

    def create_project(self, req: ProjectCreate) -> ProjectResponse:
        project_id = str(uuid.uuid4())[:8]
        proj_dir = (self.base_dir / project_id).resolve()
        proj_dir.mkdir(parents=True, exist_ok=False)

        now = datetime.now(timezone.utc).isoformat()
        metadata = {
            "id": project_id,
            "name": req.name,
            "description": req.description or "",
            "template": req.template,
            "created_at": now,
            "updated_at": now
        }
        self._write_metadata(proj_dir, metadata)

        # Populate starter files based on template
        template_files = TEMPLATES_DATA.get(req.template or "blank", TEMPLATES_DATA["blank"])
        for rel_path, content in template_files.items():
            file_path = resolve_safe_path(proj_dir, rel_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        return self.get_project(project_id)

    def get_project(self, project_id: str) -> ProjectResponse:
        proj_dir = self._get_project_dir(project_id)
        metadata = self._read_metadata(proj_dir)
        
        files: List[FileItem] = []
        for root, dirs, filenames in os.walk(proj_dir):
            # Skip hidden files/directories like .project.json or .git
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            
            for d in dirs:
                full_d = Path(root) / d
                rel_d = full_d.relative_to(proj_dir).as_posix()
                files.append(FileItem(
                    path=rel_d,
                    name=d,
                    is_directory=True,
                    size=0,
                    modified_at=datetime.fromtimestamp(full_d.stat().st_mtime, tz=timezone.utc)
                ))
                
            for fname in filenames:
                if fname.startswith("."):
                    continue
                full_f = Path(root) / fname
                rel_f = full_f.relative_to(proj_dir).as_posix()
                stat = full_f.stat()
                files.append(FileItem(
                    path=rel_f,
                    name=fname,
                    is_directory=False,
                    size=stat.st_size,
                    modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                ))

        files.sort(key=lambda x: (not x.is_directory, x.path.lower()))

        return ProjectResponse(
            id=project_id,
            name=metadata.get("name", project_id),
            description=metadata.get("description", ""),
            template=metadata.get("template"),
            created_at=datetime.fromisoformat(metadata.get("created_at", datetime.now(timezone.utc).isoformat())),
            updated_at=datetime.fromisoformat(metadata.get("updated_at", datetime.now(timezone.utc).isoformat())),
            files=files
        )

    def delete_project(self, project_id: str):
        proj_dir = self._get_project_dir(project_id)
        shutil.rmtree(proj_dir, ignore_errors=True)

    def get_file_content(self, project_id: str, rel_path: str) -> FileContent:
        proj_dir = self._get_project_dir(project_id)
        safe_path = resolve_safe_path(proj_dir, rel_path)
        
        if not safe_path.exists():
            raise HTTPException(status_code=404, detail="File not found.")
            
        if safe_path.is_dir():
            return FileContent(path=rel_path, content="", is_directory=True)

        if safe_path.stat().st_size > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds maximum allowed size.")

        try:
            with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return FileContent(path=rel_path, content=content, is_directory=False)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    def save_file_content(self, project_id: str, rel_path: str, content: str, is_directory: bool = False):
        proj_dir = self._get_project_dir(project_id)
        safe_path = resolve_safe_path(proj_dir, rel_path)
        
        if len(content.encode("utf-8")) > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File content exceeds size limit.")

        if is_directory:
            safe_path.mkdir(parents=True, exist_ok=True)
        else:
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            with open(safe_path, "w", encoding="utf-8") as f:
                f.write(content)

        # Update metadata timestamp
        meta = self._read_metadata(proj_dir)
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._write_metadata(proj_dir, meta)

    def delete_file(self, project_id: str, rel_path: str):
        proj_dir = self._get_project_dir(project_id)
        safe_path = resolve_safe_path(proj_dir, rel_path)
        
        if not safe_path.exists():
            raise HTTPException(status_code=404, detail="File or directory does not exist.")
            
        if safe_path.is_dir():
            shutil.rmtree(safe_path, ignore_errors=True)
        else:
            safe_path.unlink()

        # Update metadata timestamp
        meta = self._read_metadata(proj_dir)
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._write_metadata(proj_dir, meta)

    def copy_to_workspace(self, project_id: str, workspace_dir: Path):
        """Copies all project files into an execution workspace directory."""
        proj_dir = self._get_project_dir(project_id)
        workspace_dir.mkdir(parents=True, exist_ok=True)
        
        for item in proj_dir.iterdir():
            if item.name.startswith("."):
                continue
            dest = workspace_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

project_service = ProjectService()

