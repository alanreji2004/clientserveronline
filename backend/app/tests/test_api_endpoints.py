import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/system/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "gcc" in data
    assert "python_version" in data

def test_api_templates():
    res = client.get("/api/projects/templates")
    assert res.status_code == 200
    tpls = res.json()
    tpl_ids = [t["id"] for t in tpls]
    assert "python-sockets" in tpl_ids
    assert "c-sockets" in tpl_ids
    assert "cross-sockets" in tpl_ids

def test_api_project_lifecycle_and_session():
    # 1. Create project
    create_res = client.post("/api/projects", json={
        "name": "API Socket Test",
        "description": "Integration test project",
        "template": "python-sockets"
    })
    assert create_res.status_code == 200
    proj_data = create_res.json()
    proj_id = proj_data["id"]

    # 2. Verify file retrieval
    file_res = client.get(f"/api/projects/{proj_id}/file?path=server.py")
    assert file_res.status_code == 200
    assert "server_socket" in file_res.json()["content"]

    # 3. Create execution session
    sess_res = client.post("/api/sessions", json={"project_id": proj_id})
    assert sess_res.status_code == 200
    session_data = sess_res.json()
    session_id = session_data["session_id"]
    assert session_data["status"] == "active"

    # 4. Launch python server process via API
    launch_res = client.post(f"/api/sessions/{session_id}/processes", json={
        "name": "API Python Server",
        "command_type": "python",
        "entry_point": "server.py"
    })
    assert launch_res.status_code == 200
    proc_info = launch_res.json()
    proc_id = proc_info["process_id"]
    assert proc_info["status"] in ("starting", "running")

    # 5. List processes in session
    list_res = client.get(f"/api/sessions/{session_id}/processes")
    assert list_res.status_code == 200
    procs = list_res.json()
    assert any(p["process_id"] == proc_id for p in procs)

    # 6. Stop process via API
    stop_res = client.post(f"/api/sessions/{session_id}/processes/{proc_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] == "stopped"

    # 7. Stop session
    client.post(f"/api/sessions/{session_id}/stop")

    # 8. Delete project
    del_res = client.delete(f"/api/projects/{proj_id}")
    assert del_res.status_code == 200

