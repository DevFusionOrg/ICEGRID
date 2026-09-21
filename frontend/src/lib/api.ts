const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type Role = "ADMIN" | "COORDINATOR" | "FIELD_PERSONNEL" | "LOGISTICS_OFFICER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type CargoStatus = "PLANNED" | "IN_TRANSIT" | "AT_DESTINATION" | "RECEIVED" | "LOST";

export type CargoItem = {
  id: string;
  expeditionId: string;
  trackingCode: string;
  name: string;
  location: string | null;
  status: CargoStatus;
  updatedAt: string;
};

export type Expedition = {
  id: string;
  name: string;
  code: string;
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

export function createAlert(token: string, data: Pick<EmergencyAlert, "expeditionId" | "title" | "message" | "severity" | "location">) {
  return request<EmergencyAlert>("/alerts", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
}

export function resolveAlert(token: string, id: string) {
  return request<EmergencyAlert>(`/alerts/${id}/resolve`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
}
