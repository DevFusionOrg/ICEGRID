import { z } from "zod";
import { hasPermission, PERMISSIONS, USER_ROLES, type Permission, type UserRole } from "./auth/roles.js";
import { prisma } from "./db/prisma.js";

// ─── Exported Types ─────────────────────────────────────────────────────────

export type RealtimeUser = {
  id: string;
  role: UserRole;
  permissions: readonly Permission[];
  tokenIssuedAt: number;
  tokenExpiresAt: number;
};

export type RealtimeLocation = {
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
};

export type CargoUpdate = {
  id: string;
  expeditionId: string;
  location: string | null;
  currentLocation?: RealtimeLocation | null;
  status: string;
  updatedAt: Date;
};

export type LocationUpdate = {
  entityType: "personnel" | "cargo" | "emergency";
  entityId: string;
  expeditionId: string;
  location: RealtimeLocation;
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
  resolvedAt: Date | null;
};

export type EmergencyCreated = Omit<AlertUpdate, "location">;

export type RoomAcknowledgement = { ok: true } | { ok: false; error: string };

// Kept for frontend type compatibility
export interface ClientToServerEvents {
  "expedition:join": (payload: { expeditionId: string }, acknowledge?: (r: RoomAcknowledgement) => void) => void;
  "expedition:leave": (payload: { expeditionId: string }, acknowledge?: (r: RoomAcknowledgement) => void) => void;
}

export interface ServerToClientEvents {
  "cargo.updated": (update: CargoUpdate) => void;
  "cargo:update": (update: CargoUpdate) => void;
  "location.updated": (update: LocationUpdate) => void;
  "emergency.created": (update: EmergencyCreated) => void;
  "alert:new": (update: AlertUpdate) => void;
}

// ─── SSE Client Registry ────────────────────────────────────────────────────

export type RealtimeClient = {
  id: string;
  user: RealtimeUser;
  expeditions: Set<string>;
  send: (event: string, data: unknown) => void;
  close: () => void;
};

const activeClients = new Map<string, RealtimeClient>();

export const userRoom = (userId: string) => `user:${userId}`;
export const roleRoom = (role: UserRole) => `role:${role}`;
export const expeditionRoom = (expeditionId: string) => `expedition:${expeditionId}`;
export const expeditionRoleRoom = (expeditionId: string, role: UserRole) =>
  `${expeditionRoom(expeditionId)}:role:${role}`;

export function registerRealtimeClient(client: RealtimeClient): void {
  activeClients.set(client.id, client);
}

export function unregisterRealtimeClient(clientId: string): void {
  activeClients.delete(clientId);
}

export function getConnectedClientCount(): number {
  return activeClients.size;
}

// ─── Room Handlers ──────────────────────────────────────────────────────────

const expeditionPayloadSchema = z
  .object({ expeditionId: z.string().trim().min(1).max(100) })
  .strict();

export async function handleExpeditionJoin(
  clientId: string,
  expeditionId: string,
): Promise<RoomAcknowledgement> {
  const client = activeClients.get(clientId);
  if (!client) return { ok: false, error: "Client not found or disconnected" };

  const parsed = expeditionPayloadSchema.safeParse({ expeditionId });
  if (!parsed.success) return { ok: false, error: "Invalid expedition ID" };

  if (!hasPermission(client.user.role, "expeditions.read")) {
    return { ok: false, error: "Insufficient permissions" };
  }

  try {
    const expedition = await prisma.expedition.findUnique({
      where: { id: parsed.data.expeditionId },
      select: { id: true },
    });
    if (!expedition) return { ok: false, error: "Expedition not found or inaccessible" };
    client.expeditions.add(parsed.data.expeditionId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to authorize expedition room" };
  }
}

export function handleExpeditionLeave(
  clientId: string,
  expeditionId: string,
): RoomAcknowledgement {
  const client = activeClients.get(clientId);
  if (!client) return { ok: false, error: "Client not found or disconnected" };

  const parsed = expeditionPayloadSchema.safeParse({ expeditionId });
  if (!parsed.success) return { ok: false, error: "Invalid expedition ID" };

  client.expeditions.delete(parsed.data.expeditionId);
  return { ok: true };
}

// ─── Broadcast Functions ────────────────────────────────────────────────────

export function broadcastCargoUpdate(update: CargoUpdate): void {
  for (const client of activeClients.values()) {
    if (!hasPermission(client.user.role, "cargo.read")) continue;
    // Client must have joined at least one room, and it must match this expedition
    if (client.expeditions.size === 0 || !client.expeditions.has(update.expeditionId)) continue;

    const roleUpdate = hasPermission(client.user.role, "locations.read")
      ? update
      : { ...update, location: null, currentLocation: null };

    client.send("cargo.updated", roleUpdate);
    client.send("cargo:update", roleUpdate);
  }
}

export function broadcastLocationUpdated(update: LocationUpdate): void {
  for (const client of activeClients.values()) {
    if (!hasPermission(client.user.role, "locations.read")) continue;
    // Client must have joined at least one room, and it must match this expedition
    if (client.expeditions.size === 0 || !client.expeditions.has(update.expeditionId)) continue;
    client.send("location.updated", update);
  }
}

export function broadcastAlertNew(update: AlertUpdate): void {
  const safeUpdate: EmergencyCreated = {
    id: update.id,
    expeditionId: update.expeditionId,
    title: update.title,
    message: update.message,
    severity: update.severity,
    status: update.status,
    createdAt: update.createdAt,
    resolvedAt: update.resolvedAt,
  };

  for (const client of activeClients.values()) {
    // ADMIN / COORDINATOR get the full alert with location
    if (client.user.role === "ADMIN" || client.user.role === "COORDINATOR") {
      client.send("alert:new", update);
    }
    // Anyone with emergency.read gets the safe (no location) version scoped to joined expeditions
    if (hasPermission(client.user.role, "emergency.read")) {
      if (client.expeditions.size > 0 && client.expeditions.has(update.expeditionId)) {
        client.send("emergency.created", safeUpdate);
      }
    }
  }
}