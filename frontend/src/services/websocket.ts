export type WSMessageCallback = (msg: any) => void;

export class ExecutionWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private listeners: Set<WSMessageCallback> = new Set();
  private reconnectTimer: any = null;
  private shouldReconnect = true;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  connect() {
    this.shouldReconnect = true;
    let wsBase: string;

    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      try {
        const u = new URL(envUrl);
        const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${wsProto}//${u.host}/api`;
      } catch {
        wsBase = 'ws://127.0.0.1:8000/api';
      }
    } else if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        wsBase = 'ws://127.0.0.1:8000/api';
      } else {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${wsProto}//${window.location.host}/api`;
      }
    } else {
      wsBase = 'ws://127.0.0.1:8000/api';
    }

    const url = `${wsBase}/sessions/${encodeURIComponent(this.sessionId)}/stream`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Connected
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.listeners.forEach((callback) => callback(parsed));
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = () => {
        // Handled via onclose
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }

  subscribe(callback: WSMessageCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  sendStdin(processId: string, data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'stdin',
        process_id: processId,
        data,
      }));
    }
  }

  stopProcess(processId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'stop_process',
        process_id: processId,
      }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

