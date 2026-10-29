# Professional Online IDE & Concurrent Multi-Process Execution Platform

A production-grade, browser-based coding platform engineered to run **multiple client and server programs concurrently within the same project**. Designed specifically for network programs written in Python and C, allowing developers to run servers and clients simultaneously, stream real-time logs independently, interact via stdin, compile with GCC, and observe TCP socket communication over loopback.

---

## Key Capabilities

- **Concurrent Multi-Process Execution**: Launch `server.py` and `client.py` (or compiled `server` and `client` binaries) simultaneously in isolated execution sessions.
- **Independent Terminal Streaming**: Non-blocking asynchronous I/O captures stdout and stderr independently for each process and streams updates via WebSockets without interleaving or buffer lag.
- **Side-by-Side Dual Split Terminal**: View Server and Client processes simultaneously side-by-side to observe socket connections, handshakes, and packet transfers in real time.
- **Interactive Stdin**: Send direct keyboard input and interactive commands to any active process independently.
- **GCC C Compilation Engine**: Compiles C files with `-Wall -Wextra -O0 -g`. Parses GCC output into structured diagnostics with error/warning line numbers that render directly inside Monaco Editor markers.
- **Cross-Platform Socket Support**: Includes `socket_compat.h` supporting both standard POSIX sockets (`sys/socket.h`) and Windows MinGW Sockets (`winsock2.h` with `-lws2_32`).
- **Full File Explorer & Monaco Editor**: Multi-file workspaces with syntax highlighting for Python and C, unsaved-change dirty indicators, folder creation, deletion, and quick starter templates.
- **Security & Sandboxing**: Strict path traversal prevention, process group isolation, execution timeouts, memory limits, and containerized runner support.

---

## Architecture Overview

```
project-root/
├── backend/
│   ├── app/
│   │   ├── api/             # REST endpoints (projects, sessions, system) & WebSockets
│   │   ├── core/            # Config, security, path resolution, sandboxing
│   │   ├── schemas/         # Pydantic schemas (Project, Session, Diagnostics)
│   │   ├── services/        # Project service, Process supervisor, GCC compiler
│   │   ├── templates/       # Python & C socket starter templates
│   │   └── tests/           # Automated pytest suite (sockets, C compile, security)
│   ├── main.py              # FastAPI application entrypoint
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend container
├── frontend/
│   ├── src/
│   │   ├── components/      # Header, FileExplorer, CodeEditor, Terminal, StatusBar
│   │   ├── services/        # REST API & WebSocket managers
│   │   ├── types/           # TypeScript definitions
│   │   ├── App.tsx          # Main IDE workspace layout & orchestration
│   │   └── index.css        # Professional light/dark theme styling
│   ├── package.json         # React 19, TypeScript, Monaco Editor, Lucide icons
│   └── Dockerfile           # Production Nginx container
├── runner/
│   └── Dockerfile           # Unprivileged runner container (coder user, dropped caps)
├── examples/
│   ├── python/              # Standalone Python socket server & client
│   └── c/                   # Standalone C socket server, client, socket_compat.h, Makefile
├── docker-compose.yml       # Production orchestration
└── .env.example             # Configurable environment variables
```

---

## Quickstart & Local Setup

### Prerequisites
- **Python**: Python 3.10+ (Python 3.12 verified)
- **Node.js**: Node 18+ (Node 22 verified) with npm
- **GCC**: GCC / MinGW (on Windows, MinGW GCC with `gcc` in PATH; on Linux, `build-essential`)

### 1. Backend Setup
From the repository root:
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
The FastAPI backend starts on `http://127.0.0.1:8000`. You can inspect interactive API docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## How to Run Server & Client Simultaneously

### Scenario A: Python Socket Server & Client
1. In the top toolbar, select the **Python TCP Socket Pair** template (or open an existing Python project with `server.py` and `client.py`).
2. Click **Run Server & Client** in the toolbar.
   - The platform starts `server.py` in Process tab 1.
   - The platform switches to **Split View**, launching `client.py` in Process tab 2.
3. Observe live output:
   - Server logs: `[+] Server is listening on 127.0.0.1:5000`
   - Client logs: `[+] Connected to server on 127.0.0.1:5000!`
   - Real-time message exchange and acknowledgment echoes.
4. Stop or restart either process independently using the **Stop** or **Restart** buttons in each process header.

### Scenario B: Native C Socket Server & Client
1. Select the **C Native Socket Pair** template.
2. Select `server.c` in the editor and click **Compile GCC** (produces `c_server`).
3. Select `client.c` in the editor and click **Compile GCC** (produces `c_client`).
4. Click **Run Server & Client**:
   - Both native binaries run concurrently in isolated loopback.
   - Watch C socket packets transmit and acknowledge with microsecond performance!

### Scenario C: Cross-Language (Python Server + C Client)
1. Select the **Cross-Language Sockets** template.
2. Click **Run Server & Client**:
   - `server.py` listens on port 5002.
   - Native `client.c` compiles and connects, demonstrating interoperability between Python and C!

---

## Running the Automated Test Suite

The repository includes a comprehensive automated test suite covering unit execution, GCC compilation, syntax errors, directory traversal security, and simultaneous client/server socket communication:

```bash
python -m pytest backend/app/tests -v
```

### Verified Test Cases:
1. `test_api_health`: System health and GCC detection API.
2. `test_api_templates`: Starter templates retrieval.
3. `test_api_project_lifecycle_and_session`: Full CRUD, file management, and process launch via REST.
4. `test_compilation_success_and_diagnostics`: GCC build success and structured line/column error diagnostic parsing.
5. `test_python_single_run_and_stdin`: Subprocess execution, unbuffered stdout capture, and interactive stdin typing.
6. `test_project_create_and_files`: Multi-file workspace management.
7. `test_path_traversal_prevention`: Rejection of `../` traversal attempts and unauthorized paths.
8. `test_simultaneous_python_socket_server_and_client`: Python socket pair communication on port 5000.
9. `test_simultaneous_c_socket_server_and_client`: C socket pair compilation and communication on port 5001.
10. `test_cross_language_python_server_and_c_client`: Interoperability between Python server and C client on port 5002.

---

## Docker Deployment (Production / Containerized)

To build and run all components using Docker Compose:

```bash
docker-compose up --build
```

- **Frontend**: Available at `http://localhost:5173`
- **Backend API**: Available at `http://localhost:8000`
- **Runner Sandbox**: Dedicated unprivileged container (`coder` user uid:1000, dropped capabilities, no root access).

---

## Security Model & Sandboxing

1. **Path Traversal Shield**: All file interactions pass through `resolve_safe_path()` which validates path segments, strips directory traversal patterns, and asserts that the canonical path resides inside the authorized session directory.
2. **Process Tree Supervision**: Process groups are created using `CREATE_NEW_PROCESS_GROUP` on Windows and `os.setsid` on POSIX. Process termination terminates the entire process tree using `taskkill /F /T` or `psutil` to prevent orphaned child processes.
3. **Execution Timeouts**: A non-blocking background timeout guard monitors each process and terminates execution if it exceeds `DEFAULT_TIMEOUT_SECONDS` (180s by default).
4. **No Arbitrary Shell Injection**: All process arguments and compiler commands are assembled as explicit string arrays (`List[str]`) passed directly to OS execution syscalls without `shell=True`.
5. **Output Buffer Caps**: In-memory logs are bounded to a sliding window of `MAX_OUTPUT_BUFFER_LINES` (5,000 lines) to prevent denial-of-service via memory exhaustion.

---

## REST & WebSocket API Reference

### REST Endpoints
- `GET /api/system/health`: Reports host platform, GCC compiler status, Docker status, and active execution mode.
- `GET /api/projects`: List all saved projects.
- `POST /api/projects`: Create project (`{ name, description, template }`).
- `GET /api/projects/{project_id}`: Retrieve project details and recursive file tree.
- `GET /api/projects/{project_id}/file?path=...`: Read file content.
- `POST /api/projects/{project_id}/file`: Create new file or folder.
- `PUT /api/projects/{project_id}/file?path=...`: Update file content.
- `DELETE /api/projects/{project_id}/file?path=...`: Delete file or folder.
- `POST /api/sessions`: Create isolated workspace execution session for a project.
- `POST /api/sessions/{session_id}/compile`: Compile C source files with GCC (`{ source_files, output_binary, compiler_flags }`).
- `POST /api/sessions/{session_id}/processes`: Launch process (`{ name, command_type, entry_point, args }`).
- `GET /api/sessions/{session_id}/processes`: List active and stopped processes.
- `POST /api/sessions/{session_id}/processes/{process_id}/stdin`: Send input text to process stdin.
- `POST /api/sessions/{session_id}/processes/{process_id}/stop`: Terminate a specific process.
- `POST /api/sessions/{session_id}/stop`: Terminate session and kill all child processes.

### WebSocket Endpoint
- `WS /api/sessions/{session_id}/stream`: Real-time bidirectional streaming for:
  - Inbound: `{ action: "stdin", process_id: "...", data: "..." }`, `{ action: "stop_process", process_id: "..." }`.
  - Outbound: `{ type: "output", process_id: "...", stream: "stdout"|"stderr"|"system", data: "..." }`, `{ type: "status_change", ... }`, `{ type: "compile_result", ... }`.

---

## Troubleshooting Guide

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `GCC compiler not found on PATH` | GCC is not installed or not in system PATH | Install MinGW-w64 on Windows or `build-essential` on Linux and ensure `gcc` is reachable in command prompt. |
| `Port already in use` error during socket bind | A previous server process was not stopped before starting a new one | The server templates use `SO_REUSEADDR` to prevent socket locking. Click **Stop All** in the IDE toolbar to terminate lingering processes. |
| `Connection Refused` on client startup | The client process started before the server completed its socket bind | The client programs include automatic retry loops with exponential backoff (up to 5 retries). Clicking **Run Server & Client** automatically spaces process launches by 800ms. |
| Output lines not appearing in real time | Python stdout buffering | Python is automatically launched with `-u` flag and `PYTHONUNBUFFERED=1` environment variable. In C, `setvbuf(stdout, NULL, _IONBF, 0)` is included in starter templates. |
| Monaco Editor squiggly error markers | Compilation warning/error detected | Click the **GCC Compiler** tab in the bottom panel to inspect the exact compiler diagnostic and jump to the error line. |

