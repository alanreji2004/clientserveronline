import asyncio
import os
import sys
import shutil
import pytest
from app.services.project_service import project_service
from app.services.session_service import session_service
from app.services.compiler_service import compiler_service
from app.services.supervisor import supervisor
from app.schemas.project import ProjectCreate
from app.schemas.session import ProcessLaunchRequest, CompileRequest

@pytest.mark.asyncio
async def test_python_interactive_input_prompt_flush_immediately():
    """
    Verifies that Python input prompts without newlines (e.g. `input('Enter name: ')`)
    are streamed to listeners immediately, BEFORE any stdin input is submitted.
    """
    proj = project_service.create_project(ProjectCreate(name="Interactive Py Test", template="blank"))
    
    code = (
        'name = input("Enter your name: ")\n'
        'age = input("Enter your age: ")\n'
        'print("Name:", name)\n'
        'print("Age:", age)\n'
    )
    project_service.save_file_content(proj.id, "interactive.py", code)
    
    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)
    
    events = []
    def on_event(evt):
        events.append(evt)
    
    supervisor.register_listener(session.session_id, on_event)
    
    proc_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(name="InteractivePy", command_type="python", entry_point="interactive.py")
    )
    
    proc = supervisor.get_process(session.session_id, proc_info.process_id)
    
    # 1. Wait briefly for process to start and verify prompt appears BEFORE sending any stdin
    for _ in range(30):
        await asyncio.sleep(0.1)
        stdout_texts = [e["data"] for e in events if e.get("stream") == "stdout"]
        combined = "".join(stdout_texts)
        if "Enter your name:" in combined:
            break
            
    combined = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Enter your name:" in combined, f"Prompt did not arrive before stdin. Got: {combined}"
    
    # 2. Now send first input
    await proc.write_stdin("Alice")
    
    # Wait for second prompt to appear
    for _ in range(30):
        await asyncio.sleep(0.1)
        stdout_texts = [e["data"] for e in events if e.get("stream") == "stdout"]
        combined = "".join(stdout_texts)
        if "Enter your age:" in combined:
            break
            
    combined = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Enter your age:" in combined, f"Second prompt did not arrive. Got: {combined}"
    
    # 3. Send second input
    await proc.write_stdin("28")
    
    # Wait for process to exit
    for _ in range(30):
        await asyncio.sleep(0.1)
        if proc.status in ("exited", "stopped", "error"):
            break
            
    assert proc.status == "exited"
    assert proc.exit_code == 0
    
    final_output = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Name: Alice" in final_output
    assert "Age: 28" in final_output
    
    supervisor.unregister_listener(session.session_id, on_event)
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)


@pytest.mark.asyncio
async def test_c_interactive_input_prompt_flush_immediately():
    """
    Verifies that C printf prompts without newlines before scanf/fgets
    are streamed to listeners immediately, BEFORE any stdin input is submitted.
    """
    if not shutil.which("gcc"):
        pytest.skip("GCC not installed")
        
    proj = project_service.create_project(ProjectCreate(name="Interactive C Test", template="blank"))
    
    c_code = (
        '#include <stdio.h>\n'
        'int main(void) {\n'
        '    char name[100];\n'
        '    int age = 0;\n'
        '    printf("Enter your name: ");\n'
        '    if (fgets(name, sizeof(name), stdin) == NULL) return 1;\n'
        '    printf("Enter your age: ");\n'
        '    if (scanf("%d", &age) != 1) return 1;\n'
        '    printf("Name: %s", name);\n'
        '    printf("Age: %d\\n", age);\n'
        '    return 0;\n'
        '}\n'
    )
    project_service.save_file_content(proj.id, "main.c", c_code)
    
    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)
    
    # Compile
    compile_res = await compiler_service.compile_c(
        workspace,
        CompileRequest(source_files=["main.c"], output_binary="interactive_c")
    )
    assert compile_res.success is True
    
    events = []
    def on_event(evt):
        events.append(evt)
        
    supervisor.register_listener(session.session_id, on_event)
    
    proc_info = await supervisor.launch_process(
        session.session_id,
        workspace,
        ProcessLaunchRequest(name="InteractiveC", command_type="binary", entry_point=compile_res.output_binary)
    )
    
    proc = supervisor.get_process(session.session_id, proc_info.process_id)
    
    # Wait for first prompt to arrive BEFORE sending stdin
    for _ in range(30):
        await asyncio.sleep(0.1)
        stdout_texts = [e["data"] for e in events if e.get("stream") == "stdout"]
        combined = "".join(stdout_texts)
        if "Enter your name:" in combined:
            break
            
    combined = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Enter your name:" in combined, f"C prompt did not arrive before stdin. Got: {combined}"
    
    # Send first input
    await proc.write_stdin("Charlie")
    
    # Wait for second prompt
    for _ in range(30):
        await asyncio.sleep(0.1)
        stdout_texts = [e["data"] for e in events if e.get("stream") == "stdout"]
        combined = "".join(stdout_texts)
        if "Enter your age:" in combined:
            break
            
    combined = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Enter your age:" in combined, f"Second C prompt did not arrive. Got: {combined}"
    
    # Send second input
    await proc.write_stdin("32")
    
    # Wait for exit
    for _ in range(30):
        await asyncio.sleep(0.1)
        if proc.status in ("exited", "stopped", "error"):
            break
            
    assert proc.status == "exited"
    assert proc.exit_code == 0
    
    final_output = "".join([e["data"] for e in events if e.get("stream") == "stdout"])
    assert "Name: Charlie" in final_output
    assert "Age: 32" in final_output
    
    supervisor.unregister_listener(session.session_id, on_event)
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)


@pytest.mark.asyncio
async def test_execution_lifecycle_stop_all_active_execution():
    """
    Verifies that `stop_all_active_execution` terminates all running processes
    across sessions, releasing resources before starting a new run.
    """
    proj1 = project_service.create_project(ProjectCreate(name="Proj 1", template="blank"))
    project_service.save_file_content(proj1.id, "worker1.py", "import time\ntime.sleep(60)\n")
    sess1 = session_service.create_session(proj1.id)
    ws1 = session_service.get_workspace_dir(sess1.session_id)
    
    p1 = await supervisor.launch_process(
        sess1.session_id, ws1,
        ProcessLaunchRequest(name="Worker1", command_type="python", entry_point="worker1.py")
    )
    assert p1.status == "running"
    
    proj2 = project_service.create_project(ProjectCreate(name="Proj 2", template="blank"))
    project_service.save_file_content(proj2.id, "worker2.py", "import time\ntime.sleep(60)\n")
    sess2 = session_service.create_session(proj2.id)
    ws2 = session_service.get_workspace_dir(sess2.session_id)
    
    p2 = await supervisor.launch_process(
        sess2.session_id, ws2,
        ProcessLaunchRequest(name="Worker2", command_type="python", entry_point="worker2.py")
    )
    assert p2.status == "running"
    
    # Execute lifecycle stop
    stopped_count = await supervisor.stop_all_active_execution()
    assert stopped_count >= 2
    
    proc1_obj = supervisor.get_process(sess1.session_id, p1.process_id)
    proc2_obj = supervisor.get_process(sess2.session_id, p2.process_id)
    assert proc1_obj.status == "stopped"
    assert proc2_obj.status == "stopped"
    
    # Cleanup
    await session_service.stop_session(sess1.session_id)
    await session_service.stop_session(sess2.session_id)
    project_service.delete_project(proj1.id)
    project_service.delete_project(proj2.id)


@pytest.mark.asyncio
async def test_terminal_deletion_lifecycle():
    """
    Verifies that deleting a terminal tab:
    1. Stops the process if running.
    2. Removes the terminal/process from tracking.
    3. Preserves source files and other processes.
    """
    proj = project_service.create_project(ProjectCreate(name="Delete Terminal Test", template="blank"))
    project_service.save_file_content(proj.id, "keep.py", "import time\ntime.sleep(30)\n")
    project_service.save_file_content(proj.id, "to_delete.py", "import time\ntime.sleep(30)\n")
    
    session = session_service.create_session(proj.id)
    workspace = session_service.get_workspace_dir(session.session_id)
    
    p_keep = await supervisor.launch_process(
        session.session_id, workspace,
        ProcessLaunchRequest(name="KeepProc", command_type="python", entry_point="keep.py")
    )
    p_del = await supervisor.launch_process(
        session.session_id, workspace,
        ProcessLaunchRequest(name="DeleteProc", command_type="python", entry_point="to_delete.py")
    )
    
    assert len(supervisor.get_processes(session.session_id)) == 2
    
    # Delete p_del terminal
    await supervisor.delete_process(session.session_id, p_del.process_id)
    
    remaining = supervisor.get_processes(session.session_id)
    assert len(remaining) == 1
    assert remaining[0].process_id == p_keep.process_id
    # Other process still running
    assert supervisor.get_process(session.session_id, p_keep.process_id).status == "running"
    
    # Source files intact
    file_content = project_service.get_file_content(proj.id, "to_delete.py")
    assert "time.sleep(30)" in file_content.content
    
    # Cleanup
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

