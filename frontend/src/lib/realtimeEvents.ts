import type { CargoItem, EmergencyAlert, LocationPoint } from "./api";

export type CargoRealtimeUpdate = Pick<CargoItem, "id" | "expeditionId" | "status" | "updatedAt" | "location" | "currentLocation">;

export type LocationRealtimeUpdate = {
  entityType: "personnel" | "cargo" | "emergency";
  entityId: string;
  expeditionId: string;
  location: LocationPoint;
};

export type EmergencyCreatedUpdate = Pick<EmergencyAlert, "id" | "expeditionId" | "title" | "message" | "severity" | "status" | "createdAt" | "resolvedAt">;
export type LegacyAlertUpdate = EmergencyAlert;
export type RoomAcknowledgement = { ok: true } | { ok: false; error: string };

export interface ClientToServerEvents {
  "expedition:join": (payload: { expeditionId: string }, acknowledge?: (result: RoomAcknowledgement) => void) => void;
  "expedition:leave": (payload: { expeditionId: string }, acknowledge?: (result: RoomAcknowledgement) => void) => void;
}

export interface ServerToClientEvents {
  "cargo.updated": (update: CargoRealtimeUpdate) => void;
  "cargo:update": (update: CargoRealtimeUpdate) => void;
  "location.updated": (update: LocationRealtimeUpdate) => void;
  "emergency.created": (update: EmergencyCreatedUpdate) => void;
  "alert:new": (update: LegacyAlertUpdate) => void;
}