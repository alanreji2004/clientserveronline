from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.schemas.project import (
    ProjectCreate, ProjectResponse, ProjectTemplateInfo,
    FileItem, FileContent, FileCreateRequest, FileUpdateRequest, FileDeleteRequest
)
from app.services.project_service import project_service
from app.templates.registry import TEMPLATE_METADATA

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[dict])
def list_projects():
    return project_service.list_projects()

@router.get("/templates", response_model=List[ProjectTemplateInfo])
def get_templates():
    return TEMPLATE_METADATA

@router.post("", response_model=ProjectResponse)
def create_project(req: ProjectCreate):
    return project_service.create_project(req)

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str):
    return project_service.get_project(project_id)

@router.delete("/{project_id}")
def delete_project(project_id: str):
    project_service.delete_project(project_id)
    return {"message": "Project deleted successfully."}

@router.get("/{project_id}/file", response_model=FileContent)
def get_file(project_id: str, path: str = Query(..., description="Relative file path")):
    return project_service.get_file_content(project_id, path)

@router.post("/{project_id}/file")
def create_file(project_id: str, req: FileCreateRequest):
    project_service.save_file_content(project_id, req.path, req.content, is_directory=req.is_directory)
    return {"message": "File created successfully."}

@router.put("/{project_id}/file")
def update_file(project_id: str, path: str = Query(..., description="Relative file path"), req: FileUpdateRequest = None):
    if req is None:
        raise HTTPException(status_code=400, detail="Missing request body")
    project_service.save_file_content(project_id, path, req.content, is_directory=False)
    return {"message": "File saved successfully."}

@router.delete("/{project_id}/file")
def delete_file(project_id: str, path: str = Query(..., description="Relative file path")):
    project_service.delete_file(project_id, path)
    return {"message": "File deleted successfully."}

