import type { ClientToServerEvents, ServerToClientEvents } from "./realtimeEvents";

type EventHandler = (...args: any[]) => void;

export interface ICEGRIDSocket {
  connected: boolean;
  on(event: string, callback: (...args: any[]) => void): this;
  off(event: string, callback: (...args: any[]) => void): this;
  emit(event: string, payload?: any, acknowledge?: (result: any) => void): this;
  disconnect(): void;
}

export class SSERealtimeSocket implements ICEGRIDSocket {
  public connected = false;
  private clientId: string | null = null;
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private apiUrl: string;
  private token: string;
  private isExplicitlyClosed = false;

  constructor(token: string) {
    this.token = token;
    const baseApi = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";
    this.apiUrl = baseApi.replace(/\/$/, "");
    this.connect();
  }

  private connect() {
    if (this.isExplicitlyClosed) return;
    if (typeof EventSource === "undefined") return;

    try {
      const url = `${this.apiUrl}/realtime/stream?token=${encodeURIComponent(this.token)}`;
      const es = new EventSource(url);
      this.eventSource = es;

      es.addEventListener("connect", (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          this.clientId = parsed.clientId ?? null;
        } catch {
          // Ignore parse errors
        }
        this.connected = true;
        this.dispatch("connect");
      });

      const eventsToForward = [
        "cargo.updated",
        "cargo:update",
        "location.updated",
        "emergency.created",
        "alert:new",
      ];

      for (const eventName of eventsToForward) {
        es.addEventListener(eventName, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            this.dispatch(eventName, data);
          } catch {
            this.dispatch(eventName, event.data);
          }
        });
      }

      es.onerror = (err) => {
        if (this.connected) {
          this.connected = false;
          this.dispatch("disconnect");
        }
        this.dispatch("connect_error", err);
      };
    } catch (err) {
      this.connected = false;
      this.dispatch("connect_error", err);
    }
  }

  public on(event: string, callback: EventHandler): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  public off(event: string, callback: EventHandler): this {
    this.listeners.get(event)?.delete(callback);
    return this;
  }

  private dispatch(event: string, ...args: any[]) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in realtime event handler for ${event}:`, e);
        }
      }
    }
  }

  public emit(event: string, payload?: any, acknowledge?: (result: any) => void): this {
    if (event === "expedition:join") {
      void fetch(`${this.apiUrl}/realtime/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          clientId: this.clientId,
          expeditionId: payload?.expeditionId,
        }),
      })
        .then((res) => res.json())
        .then((data) => acknowledge?.(data))
        .catch(() => acknowledge?.({ ok: false, error: "Network error joining expedition" }));
    } else if (event === "expedition:leave") {
      void fetch(`${this.apiUrl}/realtime/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          clientId: this.clientId,
          expeditionId: payload?.expeditionId,
        }),
      })
        .then((res) => res.json())
        .then((data) => acknowledge?.(data))
        .catch(() => acknowledge?.({ ok: false, error: "Network error leaving expedition" }));
    }
    return this;
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.connected) {
      this.connected = false;
      this.dispatch("disconnect");
    }
    this.listeners.clear();
  }
}

type SocketFactory = (token: string) => ICEGRIDSocket;

function createSocket(token: string): ICEGRIDSocket {
  return new SSERealtimeSocket(token);
}

export class RealtimeSocketManager {
  private socket: ICEGRIDSocket | null = null;
  private token: string | null = null;

  constructor(private readonly factory: SocketFactory = createSocket) {}

  get(token: string) {
    if (this.socket && this.token === token) return this.socket;
    this.disconnect();
    this.token = token;
    this.socket = this.factory(token);
    return this.socket;
  }

  disconnect(socket?: ICEGRIDSocket) {
    if (socket && socket !== this.socket) return;
    this.socket?.disconnect();
    this.socket = null;
    this.token = null;
  }
}

export const realtimeSocketManager = new RealtimeSocketManager();