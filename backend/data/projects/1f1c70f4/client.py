"""
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
            print(f"\n[MSG #{idx}] Sending: '{msg}'", flush=True)
            client_socket.sendall(f"{msg}\n".encode("utf-8"))

            response = client_socket.recv(1024)
            if response:
                print(f"[REPLY] Server responded: {response.decode('utf-8').strip()}", flush=True)
            else:
                print("[-] Server closed connection.", flush=True)
                break
                
        print("\n[+] All messages transmitted successfully. Client exiting cleanly.", flush=True)

    except Exception as e:
        print(f"[!] Client error: {e}", file=sys.stderr, flush=True)
    finally:
        client_socket.close()
        print("[*] Client socket closed.", flush=True)

if __name__ == "__main__":
    run_client()
