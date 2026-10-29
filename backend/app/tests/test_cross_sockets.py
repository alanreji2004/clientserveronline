import pytest
import asyncio
import shutil
from app.services.project_service import project_service
from app.services.session_service import session_service
from app.services.compiler_service import compiler_service
from app.services.supervisor import supervisor
from app.schemas.project import ProjectCreate
from app.schemas.session import CompileRequest, ProcessLaunchRequest

@pytest.mark.asyncio
async def test_cross_language_python_server_and_c_client():
    if not shutil.which("gcc"):
        pytest.skip("GCC not installed on system")

    # 1. Create project with cross-sockets template
    proj = project_service.create_project(ProjectCreate(
        name="Cross Socket Test",
        template="cross-sockets"
    ))

    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)

    # 2. Compile client.c
    res_cli = await compiler_service.compile_c(
        workspace,
        CompileRequest(source_files=["client.c"], output_binary="c_client_cross")
    )
    assert res_cli.success is True, f"Compilation failed: {res_cli.stderr}"

    # 3. Launch Python Server
    server_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="Cross Python Server",
            command_type="python",
            entry_point="server.py"
        )
    )
    server_proc = supervisor.get_process(session.session_id, server_info.process_id)
    assert server_proc.status == "running"

    # Wait for Python server to listen on port 5002
    server_ready = False
    for _ in range(50):
        output = "".join(o["data"] for o in server_proc.output_history)
        if "Listening on 127.0.0.1:5002" in output:
            server_ready = True
            break
        await asyncio.sleep(0.1)

    assert server_ready, "Cross Python server failed to start listening."

    # 4. Launch C Client concurrently
    client_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="Cross C Client",
            command_type="binary",
            entry_point=res_cli.output_binary
        )
    )
    client_proc = supervisor.get_process(session.session_id, client_info.process_id)

    # 5. Wait for communication to complete
    for _ in range(60):
        c_output = "".join(o["data"] for o in client_proc.output_history)
        if "PYTHON_SERVER: Handled C Client msg" in c_output or client_proc.status in ("exited", "stopped"):
            break
        await asyncio.sleep(0.15)

    client_output = "".join(o["data"] for o in client_proc.output_history)
    server_output = "".join(o["data"] for o in server_proc.output_history)

    # 6. Verify cross-language communication
    assert "Connected! Sending messages to Python server" in client_output
    assert "PYTHON_SERVER: Handled C Client msg" in client_output
    assert "[PYTHON SERVER RECV] 'Hello Python server from native C code!'" in server_output

    # 7. Cleanup
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

