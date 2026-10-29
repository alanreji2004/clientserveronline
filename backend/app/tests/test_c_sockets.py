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
async def test_simultaneous_c_socket_server_and_client():
    if not shutil.which("gcc"):
        pytest.skip("GCC not installed on system")

    # 1. Create project with c-sockets template
    proj = project_service.create_project(ProjectCreate(
        name="C Concurrent Socket Test",
        template="c-sockets"
    ))

    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)

    # 2. Compile server.c
    res_srv = await compiler_service.compile_c(
        workspace,
        CompileRequest(source_files=["server.c"], output_binary="c_server")
    )
    assert res_srv.success is True, f"server.c compilation failed: {res_srv.stderr}"

    # 3. Compile client.c
    res_cli = await compiler_service.compile_c(
        workspace,
        CompileRequest(source_files=["client.c"], output_binary="c_client")
    )
    assert res_cli.success is True, f"client.c compilation failed: {res_cli.stderr}"

    # 4. Launch C Server process
    server_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="C Native Server",
            command_type="binary",
            entry_point=res_srv.output_binary
        )
    )
    server_proc = supervisor.get_process(session.session_id, server_info.process_id)
    assert server_proc.status == "running"

    # Wait for server to be listening
    server_ready = False
    for _ in range(50):
        output = "".join(o["data"] for o in server_proc.output_history)
        if "Listening on 127.0.0.1:5001" in output or "Ready for connections" in output:
            server_ready = True
            break
        await asyncio.sleep(0.1)

    assert server_ready, f"C Server failed to output ready: {''.join(o['data'] for o in server_proc.output_history)}"

    # 5. Launch C Client process concurrently
    client_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="C Native Client",
            command_type="binary",
            entry_point=res_cli.output_binary
        )
    )
    client_proc = supervisor.get_process(session.session_id, client_info.process_id)

    # 6. Wait for client to complete packet exchange
    for _ in range(80):
        c_output = "".join(o["data"] for o in client_proc.output_history)
        if "All packets sent and acknowledged" in c_output or client_proc.status in ("exited", "stopped"):
            break
        await asyncio.sleep(0.15)

    client_output = "".join(o["data"] for o in client_proc.output_history)
    server_output = "".join(o["data"] for o in server_proc.output_history)

    # 7. Assertions
    assert "Connected to server successfully" in client_output or "Connected!" in client_output
    assert "C_SERVER_ACK: Message acknowledged" in client_output
    assert "[C SERVER RECV]" in server_output

    # 8. Clean up
    await supervisor.stop_process(session.session_id, server_info.process_id)
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

