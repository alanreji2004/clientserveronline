import pytest
import asyncio
from app.services.project_service import project_service
from app.services.session_service import session_service
from app.services.supervisor import supervisor
from app.schemas.project import ProjectCreate
from app.schemas.session import ProcessLaunchRequest

@pytest.mark.asyncio
async def test_python_single_run_and_stdin():
    proj = project_service.create_project(ProjectCreate(name="Execution Test", template="blank"))
    
    # 1. Simple stdout script
    simple_py = """import sys
print("Output Line 1")
print("Output Line 2")
"""
    project_service.save_file_content(proj.id, "simple.py", simple_py)

    # 2. Interactive stdin script
    interactive_py = """import sys
print("Enter your name: ", flush=True)
name = sys.stdin.readline().strip()
print(f"Welcome, {name}!", flush=True)
"""
    project_service.save_file_content(proj.id, "interactive.py", interactive_py)

    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)

    # Launch simple.py
    p1 = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(name="SimpleRunner", command_type="python", entry_point="simple.py")
    )
    assert p1.process_id is not None

    # Wait for completion
    managed_p1 = supervisor.get_process(session.session_id, p1.process_id)
    for _ in range(50):
        if managed_p1.status in ("exited", "stopped", "error"):
            break
        await asyncio.sleep(0.1)

    assert managed_p1.status == "exited"
    assert managed_p1.exit_code == 0
    all_output = "".join(o["data"] for o in managed_p1.output_history)
    assert "Output Line 1" in all_output
    assert "Output Line 2" in all_output

    # Launch interactive.py and test stdin
    p2 = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(name="InteractiveRunner", command_type="python", entry_point="interactive.py")
    )
    managed_p2 = supervisor.get_process(session.session_id, p2.process_id)

    # Wait for prompt to appear in stdout
    for _ in range(30):
        all_output = "".join(o["data"] for o in managed_p2.output_history)
        if "Enter your name:" in all_output:
            break
        await asyncio.sleep(0.1)

    # Write stdin
    await managed_p2.write_stdin("Alice\n")

    # Wait for completion
    for _ in range(50):
        if managed_p2.status in ("exited", "stopped", "error"):
            break
        await asyncio.sleep(0.1)

    assert managed_p2.status == "exited"
    all_output_final = "".join(o["data"] for o in managed_p2.output_history)
    assert "Welcome, Alice!" in all_output_final

    # Cleanup
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

