import { createLocationEventId } from "./locationEventId";
import {
  claimNextOperation,
  queueCounts,
  queuedOperations,
  retryFailedOperations,
  updateOperation,
  type OfflineOperation,
  type QueueCounts,
} from "./offlineQueue";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;
const MAX_BATCH_SIZE = 50;

export class QueuedOperationError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type OfflineSyncResult = QueueCounts & {
  syncedThisRun: number;
  networkUnavailable: boolean;
  nextRetryAt: number | null;
};

type Sender = (operation: OfflineOperation, token: string) => Promise<void>;

function isSupportedOperation(operation: OfflineOperation) {
  if (operation.method !== "POST") return false;
  return /^\/locations\/cargo\/[A-Za-z0-9_-]+$/.test(operation.path) ||
    /^\/cargo-items\/[A-Za-z0-9_-]+\/location$/.test(operation.path) ||
    operation.path === "/alerts";
}

export async function sendQueuedRequest(operation: OfflineOperation, token: string, apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api") {
  if (!isSupportedOperation(operation)) throw new QueuedOperationError("Unsupported offline operation", 400);
  const body = operation.path === "/alerts" && typeof operation.body === "object" && operation.body !== null
    ? { ...operation.body as Record<string, unknown>, operationId: operation.operationId }
    : operation.body;
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${operation.path}`, {
      method: operation.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": operation.operationId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new QueuedOperationError("Server is unreachable");
  }
  if (!response.ok) {
    const permanent = response.status >= 400 && response.status < 500 && ![408, 425, 429].includes(response.status);
    throw new QueuedOperationError(permanent ? `Request rejected (${response.status})` : `Temporary server failure (${response.status})`, response.status);
  }
}

function isPermanentFailure(error: unknown) {
  if (!(error instanceof QueuedOperationError)) return false;
  return error.status !== undefined && error.status >= 400 && error.status < 500 && ![408, 425, 429].includes(error.status);
}

function safeError(error: unknown) {
  if (error instanceof QueuedOperationError && error.status === 401) return "Authentication required; sign in before retrying.";
  if (error instanceof QueuedOperationError && error.status === 403) return "Not authorized to submit this operation.";
  return error instanceof QueuedOperationError ? error.message : "Network request failed";
}

function retryDelay(attemptCount: number) {
  return Math.min(BASE_RETRY_MS * 2 ** Math.max(0, attemptCount - 1), MAX_RETRY_MS);
}

function tokenSubject(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { sub?: unknown };
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

async function resultFor(userId: string, syncedThisRun: number, networkUnavailable: boolean): Promise<OfflineSyncResult> {
  const counts = await queueCounts(userId);
  const now = Date.now();
  const dueTimes = (await queuedOperations(userId))
    .filter((operation) => operation.status === "PENDING" && operation.nextAttemptAt !== null && operation.nextAttemptAt > now)
    .map((operation) => operation.nextAttemptAt!);
  return { ...counts, syncedThisRun, networkUnavailable, nextRetryAt: dueTimes.length ? Math.min(...dueTimes) : null };
}

async function runWorker(userId: string, token: string, send: Sender): Promise<OfflineSyncResult> {
  const workerId = createLocationEventId();
  let syncedThisRun = 0;
  let networkUnavailable = false;

  for (let index = 0; index < MAX_BATCH_SIZE; index += 1) {
    const operation = await claimNextOperation(userId, workerId);
    if (!operation) break;
    try {
      await send(operation, token);
      await updateOperation(operation, { status: "SYNCED", body: null, lastError: null, nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null });
      syncedThisRun += 1;
    } catch (error) {
      const permanent = isPermanentFailure(error);
      const exhausted = operation.attemptCount >= MAX_ATTEMPTS;
      networkUnavailable = error instanceof QueuedOperationError && (error.status === undefined || error.status >= 500);
      const failed = permanent || exhausted;
      await updateOperation(operation, {
        status: failed ? "FAILED" : "PENDING",
        lastError: safeError(error),
        nextAttemptAt: failed ? null : Date.now() + retryDelay(operation.attemptCount),
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      break;
    }
  }

  return resultFor(userId, syncedThisRun, networkUnavailable);
}

let activeWorker: { userId: string; promise: Promise<OfflineSyncResult> } | null = null;

export function syncOfflineQueue(userId: string, token: string, send: Sender = sendQueuedRequest) {
  if (tokenSubject(token) !== userId) return Promise.reject(new QueuedOperationError("Authenticated user does not match queued operation owner", 403));
  if (activeWorker) return activeWorker.userId === userId ? activeWorker.promise : resultFor(userId, 0, false);
  const promise = runWorker(userId, token, send).finally(() => { activeWorker = null; });
  activeWorker = { userId, promise };
  return promise;
}

export async function retryFailedOfflineQueue(userId: string, token: string, send: Sender = sendQueuedRequest) {
  if (tokenSubject(token) !== userId) throw new QueuedOperationError("Authenticated user does not match queued operation owner", 403);
  if (activeWorker) return activeWorker.userId === userId ? activeWorker.promise : resultFor(userId, 0, false);
  await retryFailedOperations(userId);
  return syncOfflineQueue(userId, token, send);
}

let syncTrigger: (() => void) | null = null;

export function registerOfflineSyncTrigger(trigger: (() => void) | null) {
  syncTrigger = trigger;
}

export function notifyApiReachable() {
  syncTrigger?.();
}