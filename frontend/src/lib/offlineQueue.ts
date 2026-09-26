import { createLocationEventId } from "./locationEventId";

export type OfflineOperationStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type OfflineOperation = {
  id?: number;
  operationId: string;
  userId: string;
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
  createdAt: number;
  observedAt: string | null;
  attemptCount: number;
  status: OfflineOperationStatus;
  lastAttemptAt: number | null;
  nextAttemptAt: number | null;
  lastError: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
};

export type NewOfflineOperation = Pick<OfflineOperation, "userId" | "path" | "method" | "body"> & {
  operationId?: string;
  observedAt?: string | null;
};

export type QueueCounts = { pending: number; syncing: number; synced: number; failed: number; authenticationRequired: number; unassignedFailed: number };

type LegacyOperation = {
  id?: number;
  path?: string;
  method?: "POST" | "PATCH";
  body?: unknown;
  token?: string;
  createdAt?: number;
};

const DB_NAME = "ncpors-offline";
const STORE = "requests";
const DB_VERSION = 2;
const LEASE_MS = 60_000;

function notifyQueueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ncpors:offline-queue-changed"));
}

function asBodyRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

function observedAtFrom(body: unknown) {
  const record = asBodyRecord(body);
  const observedAt = record?.observedAt ?? asBodyRecord(record?.locationCoordinates)?.observedAt;
  return typeof observedAt === "string" ? observedAt : null;
}

function userIdFromLegacyToken(token: string | undefined) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { sub?: unknown };
    return typeof decoded.sub === "string" && decoded.sub.length > 0 ? decoded.sub : null;
  } catch {
    return null;
  }
}

function migrateLegacyOperation(legacy: LegacyOperation): OfflineOperation {
  const userId = userIdFromLegacyToken(legacy.token);
  const body = legacy.body ?? null;
  const bodyOperationId = asBodyRecord(body)?.eventId;
  return {
    id: legacy.id,
    operationId: typeof bodyOperationId === "string" ? bodyOperationId : createLocationEventId(),
    userId: userId ?? "unassigned",
    path: typeof legacy.path === "string" ? legacy.path : "",
    method: legacy.method === "PATCH" ? "PATCH" : "POST",
    body,
    createdAt: typeof legacy.createdAt === "number" ? legacy.createdAt : Date.now(),
    observedAt: observedAtFrom(body),
    attemptCount: 0,
    status: userId ? "PENDING" : "FAILED",
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: userId ? null : "Legacy request could not be safely associated with its original user; review and re-submit it.",
    leaseOwner: null,
    leaseExpiresAt: null,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        return;
      }
      if (event.oldVersion < 2 && transaction) {
        const store = transaction.objectStore(STORE);
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          cursor.update(migrateLegacyOperation(cursor.value as LegacyOperation));
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Offline queue upgrade is blocked by another tab"));
  });
}

export async function enqueueRequest(input: NewOfflineOperation) {
  if (!input.userId) throw new Error("Offline operation must belong to an authenticated user");
  const database = await openDatabase();
  const operation: OfflineOperation = {
    ...input,
    operationId: input.operationId ?? createLocationEventId(),
    createdAt: Date.now(),
    observedAt: input.observedAt ?? observedAtFrom(input.body),
    attemptCount: 0,
    status: "PENDING",
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).add(operation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  notifyQueueChanged();
}

export async function queuedOperations(userId: string): Promise<OfflineOperation[]> {
  const database = await openDatabase();
  const operations = await new Promise<OfflineOperation[]>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as OfflineOperation[]).filter((operation) => operation.userId === userId));
    request.onerror = () => reject(request.error);
  });
  database.close();
  return operations.sort((left, right) => left.createdAt - right.createdAt);
}

export async function queueCounts(userId: string): Promise<QueueCounts> {
  const database = await openDatabase();
  const operations = await new Promise<OfflineOperation[]>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as OfflineOperation[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  const ownOperations = operations.filter((operation) => operation.userId === userId);
  return {
    pending: ownOperations.filter((operation) => operation.status === "PENDING").length,
    syncing: ownOperations.filter((operation) => operation.status === "SYNCING").length,
    synced: ownOperations.filter((operation) => operation.status === "SYNCED").length,
    failed: ownOperations.filter((operation) => operation.status === "FAILED").length,
    authenticationRequired: ownOperations.filter((operation) => operation.status === "FAILED" && operation.lastError === "Authentication required; sign in before retrying.").length,
    unassignedFailed: operations.filter((operation) => operation.userId === "unassigned" && operation.status === "FAILED").length,
  };
}

export async function claimNextOperation(userId: string, workerId: string, now = Date.now()) {
  const database = await openDatabase();
  const claimed = await new Promise<OfflineOperation | null>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAll();
    let result: OfflineOperation | null = null;
    request.onsuccess = () => {
      const operations = (request.result as OfflineOperation[])
        .filter((operation) => operation.userId === userId && (
          (operation.status === "PENDING" && (operation.nextAttemptAt === null || operation.nextAttemptAt <= now)) ||
          (operation.status === "SYNCING" && (operation.leaseExpiresAt ?? 0) <= now)
        ))
        .sort((left, right) => left.createdAt - right.createdAt);
      const next = operations[0];
          if (!next || next.id === undefined) return;
      result = {
        ...next,
        attemptCount: next.attemptCount + 1,
        status: "SYNCING",
        lastAttemptAt: now,
        leaseOwner: workerId,
        leaseExpiresAt: now + LEASE_MS,
      };
      store.put(result);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return claimed;
}

export async function updateOperation(operation: OfflineOperation, update: Partial<OfflineOperation>) {
  if (operation.id === undefined) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get(operation.id!);
    request.onsuccess = () => {
      const current = request.result as OfflineOperation | undefined;
      if (!current || current.operationId !== operation.operationId || current.leaseOwner !== operation.leaseOwner) return;
      store.put({ ...current, ...update });
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function retryFailedOperations(userId: string) {
  const operations = await queuedOperations(userId);
  await Promise.all(operations.filter((operation) => operation.status === "FAILED").map((operation) => updateOperation(operation, {
    status: "PENDING", attemptCount: 0, lastError: null, nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null,
  })));
}