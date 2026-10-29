"""
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
        print("[+] Ready for client connections. Start 'client.py' in a separate process tab!\n", flush=True)

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
                        reply = "SERVER_ACK: Goodbye! Connection closing.\n"
                        client_conn.sendall(reply.encode("utf-8"))
                        break
                    
                    reply = f"SERVER_ACK: Echoing message -> '{message}' (Timestamp: {time.strftime('%H:%M:%S')})\n"
                    client_conn.sendall(reply.encode("utf-8"))
                    print(f"[SENT] Sent response back to client.", flush=True)

    except KeyboardInterrupt:
        print("\n[*] Server shutting down gracefully...", flush=True)
    except Exception as e:
        print(f"[!] Server exception: {e}", file=sys.stderr, flush=True)
    finally:
        server_socket.close()
        print("[*] Server socket closed.", flush=True)

if __name__ == "__main__":
    run_server()
