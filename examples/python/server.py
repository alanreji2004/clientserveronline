"""
Standalone Python Socket Server Example
Listens on 127.0.0.1:5000 and echoes received messages.
"""
import socket
import sys
import time

HOST = "127.0.0.1"
PORT = 5000

def main():
    print(f"[*] Starting Python Socket Server on {HOST}:{PORT}...", flush=True)
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server_socket.bind((HOST, PORT))
        server_socket.listen(5)
        print(f"[+] Server is listening on {HOST}:{PORT}", flush=True)
        print("[+] Waiting for client connection...", flush=True)

        while True:
            client_conn, client_addr = server_socket.accept()
            print(f"[+] Connection accepted from {client_addr[0]}:{client_addr[1]}", flush=True)

            with client_conn:
                while True:
                    data = client_conn.recv(1024)
                    if not data:
                        print("[-] Client disconnected.", flush=True)
                        break

                    message = data.decode("utf-8").strip()
                    print(f"[RECV] Received from client: '{message}'", flush=True)

                    if message.lower() in ("quit", "exit"):
                        client_conn.sendall(b"SERVER_ACK: Session closed.\n")
                        break

                    reply = f"SERVER_ACK: Echoing '{message}' at {time.strftime('%H:%M:%S')}\n"
                    client_conn.sendall(reply.encode("utf-8"))
                    print(f"[SENT] Dispatched reply.", flush=True)

    except KeyboardInterrupt:
        print("\n[*] Server stopped by user.", flush=True)
    finally:
        server_socket.close()

if __name__ == "__main__":
    main()

