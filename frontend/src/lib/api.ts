const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
import { enqueueRequest } from "./offlineQueue";
import { createLocationEventId } from "./locationEventId";

export type Role = "ADMIN" | "COORDINATOR" | "FIELD_PERSONNEL" | "LOGISTICS_OFFICER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type CargoStatus = "PLANNED" | "IN_TRANSIT" | "AT_DESTINATION" | "RECEIVED" | "LOST";

export type LocationSource = "MANUAL" | "GPS" | "SYSTEM" | "IMPORT" | "SIMULATION";

export type LocationPoint = {
  id: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  source: LocationSource;
  eventId: string | null;
  expeditionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocationInput = Pick<LocationPoint, "latitude" | "longitude"> & {
  observedAt?: string;
  accuracyMeters?: number;
  altitudeMeters?: number;
  source?: LocationSource;
  eventId?: string;
};

export type CargoItem = {
  id: string;
  expeditionId: string;
  trackingCode: string;
  name: string;
  location: string | null;
  currentLocation?: LocationPoint | null;
  status: CargoStatus;
  updatedAt: string;
};

export type Expedition = {
  id: string;
  name: string;
  code: string;
  destination: string | null;
  description: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string | null;
  endDate: string | null;
};

export type Personnel = {
  id: string;
  expeditionId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  lastKnownLocation: string | null;
  currentLocation?: LocationPoint | null;
};

export type InventoryItem = {
  id: string;
  expeditionId: string | null;
  cargoItemId: string | null;
  sku: string;
  name: string;
  quantity: number;
  reorderThreshold: number;
  unit: string;
  location: string | null;
  condition: string;
};

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export type EmergencyAlert = {
  id: string;
  expeditionId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  location: string | null;
  currentLocation?: LocationPoint | null;
  createdAt: string;
  resolvedAt: string | null;
};

type AuthResponse = { user: User; token: string };

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCollection<T>(path: string, token: string) {
  return request<{ data: T[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } }>(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createAlert(token: string, data: Pick<EmergencyAlert, "expeditionId" | "title" | "message" | "severity" | "location"> & { locationCoordinates?: LocationInput }) {
  return request<EmergencyAlert>("/alerts", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function resolveAlert(token: string, id: string) {
  return request<EmergencyAlert>(`/alerts/${id}/resolve`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
}

export function createExpedition(token: string, data: Record<string, unknown>) {
  return request<Expedition>("/expeditions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function createPersonnel(token: string, data: Record<string, unknown>) {
  return request<Personnel>("/personnel", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function createCargoItem(token: string, data: Record<string, unknown>) {
  return request<CargoItem>("/cargo-items", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function createInventoryItem(token: string, data: Record<string, unknown>) {
  return request<InventoryItem>("/inventory-items", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function updateInventoryItem(token: string, id: string, data: Record<string, unknown>) {
  return request<InventoryItem>(`/inventory-items/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export async function updateCargoLocation(token: string, id: string, location: string) {
  const match = location.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) throw new Error("Enter a latitude,longitude coordinate pair");
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Coordinates are outside valid latitude/longitude ranges");
  }
  const body: LocationInput = {
    latitude,
    longitude,
    observedAt: new Date().toISOString(),
    source: "MANUAL",
    eventId: createLocationEventId(),
  };
  const path = `/locations/cargo/${id}`;
  if (!navigator.onLine) {
    await enqueueRequest({ path, method: "POST", body, token });
    return { queued: true };
  }
  return request<{ data: LocationPoint }>(path, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

export function getLocation(token: string, entityType: "personnel" | "cargo" | "emergency", entityId: string) {
  return request<{ data: LocationPoint | null }>(`/locations/${entityType}/${entityId}`, { headers: { Authorization: `Bearer ${token}` } });
}

export function getLocationHistory(token: string, entityType: "personnel" | "cargo" | "emergency", entityId: string, page = 1, pageSize = 20) {
  return request<{ data: LocationPoint[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    `/locations/${entityType}/${entityId}/history?page=${page}&pageSize=${pageSize}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
