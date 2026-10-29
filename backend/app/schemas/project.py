from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class FileContent(BaseModel):
    path: str = Field(..., description="Relative path of the file, e.g. 'server.py' or 'src/utils.h'")
    content: str = Field(..., description="Text content of the file")
    is_directory: bool = False

class FileCreateRequest(BaseModel):
    path: str
    content: str = ""
    is_directory: bool = False

class FileUpdateRequest(BaseModel):
    content: str

class FileDeleteRequest(BaseModel):
    path: str

class FileItem(BaseModel):
    path: str
    name: str
    is_directory: bool
    size: int = 0
    modified_at: Optional[datetime] = None

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    template: Optional[str] = Field("python-sockets", description="starter template: 'python-sockets', 'c-sockets', 'cross-sockets', or 'blank'")

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    template: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    files: List[FileItem] = []

class ProjectTemplateInfo(BaseModel):
    id: str
    name: str
    description: str
    language: str
    files: List[str]

