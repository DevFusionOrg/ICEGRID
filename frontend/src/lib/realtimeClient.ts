import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./realtimeEvents";

export type ICEGRIDSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SocketFactory = (token: string) => ICEGRIDSocket;

function createSocket(token: string): ICEGRIDSocket {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
  const socketUrl = apiUrl.replace(/\/api\/?$/, "");
  return io(socketUrl, { auth: { token }, reconnection: true });
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