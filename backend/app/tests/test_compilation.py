import pytest
import shutil
from pathlib import Path
from app.services.project_service import project_service
from app.services.session_service import session_service
from app.services.compiler_service import compiler_service
from app.schemas.project import ProjectCreate
from app.schemas.session import CompileRequest

@pytest.mark.asyncio
async def test_c_compilation_success_and_diagnostics():
    if not shutil.which("gcc"):
        pytest.skip("GCC not installed on system")

    # 1. Create a C project
    proj = project_service.create_project(ProjectCreate(name="C Compile Test", template="blank"))
    
    # Write valid C file
    valid_c = """#include <stdio.h>
int main(void) {
    printf("Hello from C unit test!\\n");
    return 0;
}
"""
    project_service.save_file_content(proj.id, "hello.c", valid_c)

    # Write invalid C file with syntax error
    invalid_c = """#include <stdio.h>
int main(void) {
    this_is_a_syntax_error();
    return 0
}
"""
    project_service.save_file_content(proj.id, "error.c", invalid_c)

    # 2. Create session
    session = session_service.create_session(proj.id)
    workspace_dir = session_service.get_workspace_dir(session.session_id)

    # 3. Test successful compile
    compile_req = CompileRequest(source_files=["hello.c"], output_binary="hello")
    res_ok = await compiler_service.compile_c(workspace_dir, compile_req)
    assert res_ok.success is True
    assert res_ok.output_binary is not None
    assert len(res_ok.diagnostics) == 0

    # 4. Test compile with errors
    compile_err_req = CompileRequest(source_files=["error.c"], output_binary="err_bin")
    res_err = await compiler_service.compile_c(workspace_dir, compile_err_req)
    assert res_err.success is False
    assert len(res_err.diagnostics) > 0
    # Line number and severity check
    has_error_diag = any(d.severity == "error" for d in res_err.diagnostics)
    assert has_error_diag is True

    # Cleanup
    await session_service.stop_session(session.session_id)
    project_service.delete_project(proj.id)

