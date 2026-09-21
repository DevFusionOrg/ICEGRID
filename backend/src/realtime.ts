import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAuthToken } from "./auth/jwt.js";

export type CargoUpdate = {
  id: string;
  location: string | null;
  status: string;
  updatedAt: Date;
};

let io: Server | undefined;

export function createRealtimeServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") {
      next(new Error("Authentication required"));
      return;
    }
    try {
      socket.data.user = verifyAuthToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  return io;
}

export function broadcastCargoUpdate(update: CargoUpdate) {
  io?.emit("cargo:update", update);
}

export function getRealtimeServer() {
  return io;
}
