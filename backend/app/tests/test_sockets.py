import pytest
import asyncio
from app.services.project_service import project_service
from app.services.session_service import session_service
from app.services.supervisor import supervisor
from app.schemas.project import ProjectCreate
from app.schemas.session import ProcessLaunchRequest

@pytest.mark.asyncio
async def test_simultaneous_python_socket_server_and_client():
    # 1. Create project with python-sockets template
    proj = project_service.create_project(ProjectCreate(
        name="Concurrent Socket Test",
        template="python-sockets"
    ))

    # 2. Start session
    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)

    # 3. Launch Server in process 1
    server_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="Python Server",
            command_type="python",
            entry_point="server.py"
        )
    )
    server_proc = supervisor.get_process(session.session_id, server_info.process_id)
    assert server_proc.status == "running"

    # Wait for server to bind and output "Server is listening"
    server_ready = False
    for _ in range(50):
        output = "".join(o["data"] for o in server_proc.output_history)
        if "Server is listening" in output:
            server_ready = True
            break
        await asyncio.sleep(0.1)

    assert server_ready, "Server failed to reach listening state."

    # 4. Launch Client in process 2 concurrently
    client_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(
            name="Python Client",
            command_type="python",
            entry_point="client.py"
        )
    )
    client_proc = supervisor.get_process(session.session_id, client_info.process_id)

    # 5. Verify both processes are running concurrently
    active = supervisor.get_processes(session.session_id)
    running_pids = [p.process_id for p in active if p.status == "running"]
    assert server_info.process_id in running_pids
    assert client_info.process_id in running_pids

    # 6. Wait for client to complete sending messages
    for _ in range(80):
        c_output = "".join(o["data"] for o in client_proc.output_history)
        if "All messages transmitted successfully" in c_output:
            break
        await asyncio.sleep(0.15)

    client_output = "".join(o["data"] for o in client_proc.output_history)
    server_output = "".join(o["data"] for o in server_proc.output_history)

    # 7. Verify independent logs and message exchange
    assert "Successfully connected to server" in client_output
    assert "Server responded: SERVER_ACK" in client_output
    assert "[RECV] Received from client:" in server_output
    assert "Connection accepted from" in server_output

    # 8. Test independent stopping: stop server without affecting client or session
    await supervisor.stop_process(session.session_id, server_info.process_id)
    assert server_proc.status == "stopped"

    # 9. Cleanup
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

