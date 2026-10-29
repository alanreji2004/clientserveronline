"""
Standalone Python Socket Client Example
Connects to 127.0.0.1:5000 and sends messages with acknowledgment verification.
"""
import socket
import sys
import time

HOST = "127.0.0.1"
PORT = 5000

def main():
    print(f"[*] Starting Python Socket Client...", flush=True)
    print(f"[*] Connecting to {HOST}:{PORT}...", flush=True)

    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    connected = False
    for attempt in range(1, 6):
        try:
            client_socket.connect((HOST, PORT))
            connected = True
            print(f"[+] Connected to server on {HOST}:{PORT}!", flush=True)
            break
        except ConnectionRefusedError:
            print(f"[!] Server not ready yet (attempt {attempt}/5). Retrying in 1s...", flush=True)
            time.sleep(1)

    if not connected:
        print("[ERROR] Connection failed. Please ensure server.py is running.", file=sys.stderr, flush=True)
        sys.exit(1)

    messages = [
        "Hello server from Python client!",
        "Simultaneous process communication test",
        "Stream message test 123",
        "quit"
    ]

    try:
        for msg in messages:
            time.sleep(1)
            print(f"[SEND] Sending: '{msg}'", flush=True)
            client_socket.sendall(f"{msg}\n".encode("utf-8"))

            response = client_socket.recv(1024)
            if response:
                print(f"[RECV] Server reply: {response.decode('utf-8').strip()}", flush=True)
            else:
                break
        print("[+] Finished message exchange successfully.", flush=True)
    finally:
        client_socket.close()

if __name__ == "__main__":
    main()

