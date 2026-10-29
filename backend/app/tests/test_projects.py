import pytest
from app.services.project_service import project_service
from app.schemas.project import ProjectCreate
from fastapi import HTTPException

def test_project_create_and_files():
    req = ProjectCreate(
        name="Test Socket Project",
        description="Testing project creation",
        template="python-sockets"
    )
    proj = project_service.create_project(req)
    assert proj.id is not None
    assert proj.name == "Test Socket Project"
    
    # Check that template files are present
    file_paths = [f.path for f in proj.files]
    assert "server.py" in file_paths
    assert "client.py" in file_paths
    assert "README.md" in file_paths

    # Read server.py content
    content_obj = project_service.get_file_content(proj.id, "server.py")
    assert "socket.socket" in content_obj.content

    # Create new file
    project_service.save_file_content(proj.id, "notes.txt", "Project notes content")
    notes = project_service.get_file_content(proj.id, "notes.txt")
    assert notes.content == "Project notes content"

    # Delete notes.txt
    project_service.delete_file(proj.id, "notes.txt")
    with pytest.raises(HTTPException):
        project_service.get_file_content(proj.id, "notes.txt")

    # Clean up project
    project_service.delete_project(proj.id)

def test_path_traversal_prevention():
    req = ProjectCreate(name="Security Test", template="blank")
    proj = project_service.create_project(req)
    
    # Attempt directory traversal
    with pytest.raises(HTTPException) as exc_info:
        project_service.get_file_content(proj.id, "../../../etc/passwd")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        project_service.save_file_content(proj.id, "..\\..\\evil.py", "malicious")
    assert exc_info.value.status_code == 400

    project_service.delete_project(proj.id)

