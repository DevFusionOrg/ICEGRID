import { flushQueue, type QueuedRequest } from "./offlineQueue";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export async function sendQueuedRequest(request: QueuedRequest) {
  const response = await fetch(`${API_URL}${request.path}`, {
    method: request.method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.token}` },
    body: JSON.stringify(request.body),
  });
  if (!response.ok) throw new Error(`Queued request failed with ${response.status}`);
}

export function syncOfflineQueue() {
  return flushQueue(sendQueuedRequest);
}
