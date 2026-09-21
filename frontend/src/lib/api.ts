const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type Role = "ADMIN" | "COORDINATOR" | "FIELD_PERSONNEL" | "LOGISTICS_OFFICER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
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
  return request<{ data: T[]; pagination: { total: number } }>(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
