import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAuthToken } from "./auth/jwt.js";
import { hasPermission, USER_ROLES } from "./auth/roles.js";

export type CargoUpdate = {
  id: string;
  location: string | null;
  currentLocation?: {
    id: string;
    latitude: number;
    longitude: number;
    observedAt: Date;
    accuracyMeters: number | null;
    altitudeMeters: number | null;
    source: string;
    eventId: string | null;
    expeditionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  status: string;
  updatedAt: Date;
};

export type AlertUpdate = {
  id: string;
  expeditionId: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  location: string | null;
  createdAt: Date;
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
      socket.join(`role:${socket.data.user.role}`);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  return io;
}

export function broadcastCargoUpdate(update: CargoUpdate) {
  if (!io) return;
  for (const role of USER_ROLES) {
    const roleUpdate = hasPermission(role, "locations.read") ? update : { ...update, location: null, currentLocation: null };
    io.to(`role:${role}`).emit("cargo:update", roleUpdate);
  }
}

export function broadcastAlertNew(update: AlertUpdate) {
  io?.to("role:ADMIN").to("role:COORDINATOR").emit("alert:new", update);
}

export function getRealtimeServer() {
  return io;
}
