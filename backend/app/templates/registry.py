from typing import Dict, List
from app.schemas.project import ProjectTemplateInfo

SOCKET_COMPAT_H = """#ifndef SOCKET_COMPAT_H
#define SOCKET_COMPAT_H

#ifdef _WIN32
    #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
    #endif
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    typedef int socklen_t;
    #define CLOSESOCKET(s) closesocket(s)
    #define INIT_SOCKETS() do { \\
        WSADATA wsa; \\
        if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) { \\
            fprintf(stderr, "[ERROR] WSAStartup failed.\\n"); \\
            exit(1); \\
        } \\
    } while(0)
    #define CLEANUP_SOCKETS() WSACleanup()
    #define SLEEP_MS(ms) Sleep(ms)
#else
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #include <netdb.h>
    typedef int SOCKET;
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR (-1)
    #define CLOSESOCKET(s) close(s)
    #define INIT_SOCKETS() do {} while(0)
    #define CLEANUP_SOCKETS() do {} while(0)
    #define SLEEP_MS(ms) usleep((ms) * 1000)
#endif

#endif // SOCKET_COMPAT_H
"""

PYTHON_SERVER_PY = '''"""
Professional Python Socket Server
Listens for incoming client connections, echoes messages, and logs in real-time.
"""
import socket
import sys
import time

HOST = "127.0.0.1"
PORT = 5000

def run_server():
    print(f"[*] Initializing Server on {HOST}:{PORT}...", flush=True)
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server_socket.bind((HOST, PORT))
        server_socket.listen(5)
        print(f"[+] Server is listening on {HOST}:{PORT}", flush=True)
        print("[+] Ready for client connections. Start 'client.py' in a separate process tab!\\n", flush=True)

        session_count = 0
        while True:
            client_conn, client_addr = server_socket.accept()
            session_count += 1
            print(f"[+] Connection accepted from {client_addr[0]}:{client_addr[1]} (Session #{session_count})", flush=True)

            with client_conn:
                while True:
                    data = client_conn.recv(1024)
                    if not data:
                        print(f"[-] Client {client_addr[0]}:{client_addr[1]} disconnected.", flush=True)
                        break
                    
                    message = data.decode("utf-8").strip()
                    print(f"[RECV] Received from client: '{message}'", flush=True)
                    
                    if message.lower() == "exit" or message.lower() == "quit":
                        reply = "SERVER_ACK: Goodbye! Connection closing.\\n"
                        client_conn.sendall(reply.encode("utf-8"))
                        break
                    
                    reply = f"SERVER_ACK: Echoing message -> '{message}' (Timestamp: {time.strftime('%H:%M:%S')})\\n"
                    client_conn.sendall(reply.encode("utf-8"))
                    print(f"[SENT] Sent response back to client.", flush=True)

    except KeyboardInterrupt:
        print("\\n[*] Server shutting down gracefully...", flush=True)
    except Exception as e:
        print(f"[!] Server exception: {e}", file=sys.stderr, flush=True)
    finally:
        server_socket.close()
        print("[*] Server socket closed.", flush=True)

if __name__ == "__main__":
    run_server()
'''

PYTHON_CLIENT_PY = '''"""
Professional Python Socket Client
Connects to the server, sends messages, and receives responses.
"""
import socket
import sys
import time

HOST = "127.0.0.1"
PORT = 5000

def run_client():
    print(f"[*] Starting client...", flush=True)
    print(f"[*] Attempting connection to {HOST}:{PORT}...", flush=True)

    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    connected = False
    retries = 5
    for attempt in range(1, retries + 1):
        try:
            client_socket.connect((HOST, PORT))
            connected = True
            print(f"[+] Successfully connected to server on {HOST}:{PORT}!", flush=True)
            break
        except ConnectionRefusedError:
            print(f"[!] Attempt {attempt}/{retries}: Connection refused. Is server.py running? Retrying in 1s...", flush=True)
            time.sleep(1)

    if not connected:
        print("[ERROR] Could not connect to server after multiple attempts. Make sure server.py is running first.", file=sys.stderr, flush=True)
        sys.exit(1)

    messages = [
        "Hello from Python client!",
        "Ping: Testing concurrent process networking",
        "Data payload: { 'user': 'developer', 'action': 'compile_and_run' }",
        "Final message before close",
        "quit"
    ]

    try:
        for idx, msg in enumerate(messages, 1):
            time.sleep(1.2)  # Space out messages to see live flow
            print(f"\\n[MSG #{idx}] Sending: '{msg}'", flush=True)
            client_socket.sendall(f"{msg}\\n".encode("utf-8"))

            response = client_socket.recv(1024)
            if response:
                print(f"[REPLY] Server responded: {response.decode('utf-8').strip()}", flush=True)
            else:
                print("[-] Server closed connection.", flush=True)
                break
                
        print("\\n[+] All messages transmitted successfully. Client exiting cleanly.", flush=True)

    except Exception as e:
        print(f"[!] Client error: {e}", file=sys.stderr, flush=True)
    finally:
        client_socket.close()
        print("[*] Client socket closed.", flush=True)

if __name__ == "__main__":
    run_client()
'''

C_SERVER_C = '''/**
 * Professional C Socket Server
 * Cross-platform TCP server communicating via stream sockets.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "socket_compat.h"

#define PORT 5001
#define BUFFER_SIZE 1024

int main(void) {
    // Disable stdout buffering for instant real-time IDE terminal output
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

    INIT_SOCKETS();

    SOCKET server_fd, client_fd;
    struct sockaddr_in address;
    socklen_t addrlen = sizeof(address);
    char buffer[BUFFER_SIZE] = {0};

    printf("[C SERVER] Initializing TCP Server on port %d...\\n", PORT);

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCKET) {
        perror("[C SERVER ERROR] Socket creation failed");
        CLEANUP_SOCKETS();
        return 1;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
        perror("[C SERVER ERROR] Bind failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    if (listen(server_fd, 3) == SOCKET_ERROR) {
        perror("[C SERVER ERROR] Listen failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    printf("[C SERVER] Listening on 127.0.0.1:%d\\n", PORT);
    printf("[C SERVER] Ready for connections. Start 'client' in a separate process tab!\\n\\n");

    client_fd = accept(server_fd, (struct sockaddr*)&address, &addrlen);
    if (client_fd == INVALID_SOCKET) {
        perror("[C SERVER ERROR] Accept failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    printf("[C SERVER] Client connected successfully!\\n");

    int bytes_read;
    while ((bytes_read = recv(client_fd, buffer, BUFFER_SIZE - 1, 0)) > 0) {
        buffer[bytes_read] = '\\0';
        printf("[C SERVER RECV] Received %d bytes: %s\\n", bytes_read, buffer);

        char response[BUFFER_SIZE];
        snprintf(response, sizeof(response), "C_SERVER_ACK: Message acknowledged -> %s", buffer);
        send(client_fd, response, (int)strlen(response), 0);
        printf("[C SERVER SENT] Reply dispatched.\\n");
        memset(buffer, 0, BUFFER_SIZE);
    }

    printf("[C SERVER] Client disconnected. Shutting down server.\\n");
    CLOSESOCKET(client_fd);
    CLOSESOCKET(server_fd);
    CLEANUP_SOCKETS();
    return 0;
}
'''

C_CLIENT_C = '''/**
 * Professional C Socket Client
 * Connects to C Server on port 5001, transmits messages, and prints replies.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "socket_compat.h"

#define SERVER_IP "127.0.0.1"
#define PORT 5001
#define BUFFER_SIZE 1024

int main(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

    INIT_SOCKETS();

    SOCKET client_fd = INVALID_SOCKET;
    struct sockaddr_in serv_addr;
    char buffer[BUFFER_SIZE] = {0};

    printf("[C CLIENT] Starting socket client...\\n");
    printf("[C CLIENT] Connecting to %s:%d...\\n", SERVER_IP, PORT);

    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(PORT);
    serv_addr.sin_addr.s_addr = inet_addr(SERVER_IP);

    int connected = 0;
    for (int attempt = 1; attempt <= 5; attempt++) {
        client_fd = socket(AF_INET, SOCK_STREAM, 0);
        if (client_fd == INVALID_SOCKET) {
            perror("[C CLIENT ERROR] Socket creation failed");
            CLEANUP_SOCKETS();
            return 1;
        }

        if (connect(client_fd, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) == 0) {
            connected = 1;
            printf("[C CLIENT] Connected to server successfully!\\n\\n");
            break;
        }

        printf("[C CLIENT] Attempt %d/5 failed. Server may still be starting. Retrying in 1s...\\n", attempt);
        CLOSESOCKET(client_fd);
        SLEEP_MS(1000);
    }

    if (!connected) {
        fprintf(stderr, "[C CLIENT ERROR] Failed to connect to server after multiple attempts.\\n");
        CLEANUP_SOCKETS();
        return 1;
    }

    const char* messages[] = {
        "Hello from C client program!",
        "Testing high-performance native C sockets",
        "Stream packet verification: 0xDEADBEEF",
        "Final message from client"
    };

    int num_messages = sizeof(messages) / sizeof(messages[0]);
    for (int i = 0; i < num_messages; i++) {
        SLEEP_MS(1200);
        printf("[C CLIENT SEND #%d] %s\\n", i + 1, messages[i]);
        send(client_fd, messages[i], (int)strlen(messages[i]), 0);

        int bytes_read = recv(client_fd, buffer, BUFFER_SIZE - 1, 0);
        if (bytes_read > 0) {
            buffer[bytes_read] = '\\0';
            printf("[C CLIENT RECV #%d] %s\\n\\n", i + 1, buffer);
        } else {
            printf("[C CLIENT] Server closed socket connection.\\n");
            break;
        }
        memset(buffer, 0, BUFFER_SIZE);
    }

    printf("[C CLIENT] All packets sent and acknowledged. Exiting.\\n");
    CLOSESOCKET(client_fd);
    CLEANUP_SOCKETS();
    return 0;
}
'''

PYTHON_SERVER_CROSS_PY = '''"""
Cross-Language Python Server for C Client communication
Listens on port 5002
"""
import socket
import sys

HOST = "127.0.0.1"
PORT = 5002

def main():
    print(f"[*] Starting Cross-Language Python Server on {HOST}:{PORT}...", flush=True)
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    server.bind((HOST, PORT))
    server.listen(1)
    print(f"[+] Listening on {HOST}:{PORT}. Ready for client.c connection!", flush=True)
    
    conn, addr = server.accept()
    print(f"[+] Accepted connection from native C client at {addr}", flush=True)
    
    try:
        while True:
            data = conn.recv(1024)
            if not data:
                break
            msg = data.decode("utf-8", errors="replace").strip()
            print(f"[PYTHON SERVER RECV] '{msg}'", flush=True)
            response = f"PYTHON_SERVER: Handled C Client msg -> '{msg}'\\n"
            conn.sendall(response.encode("utf-8"))
    finally:
        conn.close()
        server.close()
        print("[*] Python server connection finished.", flush=True)

if __name__ == "__main__":
    main()
'''

C_CLIENT_CROSS_C = '''/**
 * Cross-Language C Client connecting to Python Server on port 5002
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "socket_compat.h"

#define SERVER_IP "127.0.0.1"
#define PORT 5002
#define BUFFER_SIZE 1024

int main(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    INIT_SOCKETS();

    SOCKET client_fd = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in serv_addr;
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(PORT);
    serv_addr.sin_addr.s_addr = inet_addr(SERVER_IP);

    printf("[C CLIENT] Connecting to Python Server on %s:%d...\\n", SERVER_IP, PORT);
    if (connect(client_fd, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) != 0) {
        fprintf(stderr, "[C CLIENT ERROR] Failed to connect to Python server!\\n");
        CLOSESOCKET(client_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    printf("[C CLIENT] Connected! Sending messages to Python server...\\n");
    const char* msg = "Hello Python server from native C code!";
    send(client_fd, msg, (int)strlen(msg), 0);

    char buffer[BUFFER_SIZE] = {0};
    int n = recv(client_fd, buffer, BUFFER_SIZE - 1, 0);
    if (n > 0) {
        buffer[n] = '\\0';
        printf("[C CLIENT RECV] %s\\n", buffer);
    }

    CLOSESOCKET(client_fd);
    CLEANUP_SOCKETS();
    return 0;
}
'''

TEMPLATES_DATA: Dict[str, Dict[str, str]] = {
    "python-sockets": {
        "server.py": PYTHON_SERVER_PY,
        "client.py": PYTHON_CLIENT_PY,
        "README.md": """# Python Concurrent Socket Pair

This project demonstrates simultaneous multi-process networking in Python.

## How to Run:
1. Click **Start Process** or select `server.py` and click **Run**.
2. Notice the `server.py` process tab opens with real-time listening logs.
3. Select `client.py` and click **Run**.
4. Both processes execute concurrently in isolated panels!
5. Observe live message exchange, echo logs, and status updates.
6. Stop or restart either process independently using the process action controls.
"""
    },
    "c-sockets": {
        "socket_compat.h": SOCKET_COMPAT_H,
        "server.c": C_SERVER_C,
        "client.c": C_CLIENT_C,
        "README.md": """# C Native Concurrent Socket Pair

This project demonstrates GCC compilation and concurrent execution of native C network programs.

## How to Run:
1. Select `server.c` and click **Compile** (creates `server` executable).
2. Select `client.c` and click **Compile** (creates `client` executable).
3. Start `server` executable in the Process panel.
4. Start `client` executable in the Process panel.
5. Both native C processes communicate over TCP loopback with independent logs and process controls.
"""
    },
    "cross-sockets": {
        "socket_compat.h": SOCKET_COMPAT_H,
        "server.py": PYTHON_SERVER_CROSS_PY,
        "client.c": C_CLIENT_CROSS_C,
        "README.md": """# Cross-Language Socket Communication

Demonstrates interoperability between a Python TCP server and a native C client.

1. Start `server.py`.
2. Compile and run `client.c`.
3. Watch cross-language communication succeed in real time!
"""
    },
    "blank": {
        "main.py": """# Welcome to the Online IDE & Multi-Process Execution Platform
# You can create multiple files (Python, C, Headers) and run or compile them concurrently.

def main():
    print("Online IDE is ready!")

if __name__ == "__main__":
    main()
"""
    }
}

TEMPLATE_METADATA: List[ProjectTemplateInfo] = [
    ProjectTemplateInfo(
        id="python-sockets",
        name="Python TCP Socket Pair (Server & Client)",
        description="Concurrent Python server and client exchanging real-time socket messages",
        language="Python",
        files=["server.py", "client.py", "README.md"]
    ),
    ProjectTemplateInfo(
        id="c-sockets",
        name="C Native Socket Pair (GCC)",
        description="Cross-platform C TCP server and client with GCC compilation support",
        language="C",
        files=["server.c", "client.c", "socket_compat.h", "README.md"]
    ),
    ProjectTemplateInfo(
        id="cross-sockets",
        name="Cross-Language Sockets (Python + C)",
        description="Python TCP server communicating seamlessly with a native C socket client",
        language="Multi",
        files=["server.py", "client.c", "socket_compat.h", "README.md"]
    ),
    ProjectTemplateInfo(
        id="blank",
        name="Blank Project",
        description="Clean workspace with a starter main.py file",
        language="Python",
        files=["main.py"]
    )
]

