import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { enqueueRequest, queueCounts, queuedOperations, updateOperation } from "../src/lib/offlineQueue.ts";
import { QueuedOperationError, retryFailedOfflineQueue, sendQueuedRequest, syncOfflineQueue } from "../src/lib/offlineSync.ts";

const databaseName = "ncpors-offline";
const userId = "user-a";
const token = `header.${btoa(JSON.stringify({ sub: userId }))}.signature`;

function deleteQueueDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Queue database is still open"));
  });
}

beforeEach(async () => { await deleteQueueDatabase(); });
afterEach(async () => { await deleteQueueDatabase(); });

test("synchronizes in FIFO order using the active token and marks requests synced", async () => {
  await enqueueRequest({ userId, operationId: "op-1", path: "/locations/cargo/1", method: "POST", body: { observedAt: "10:15" } });
  await enqueueRequest({ userId, operationId: "op-2", path: "/alerts", method: "POST", body: { operationId: "op-2" } });
  const sent: string[] = [];
  const result = await syncOfflineQueue(userId, token, async (operation, currentToken) => {
    assert.equal(currentToken, token);
    sent.push(operation.operationId);
  });

  assert.deepEqual(sent, ["op-1", "op-2"]);
  assert.equal(result.syncedThisRun, 2);
  assert.equal(result.synced, 2);
  assert.equal((await queueCounts(userId)).pending, 0);
});

test("runs only one worker for concurrent triggers in the same session", async () => {
  await enqueueRequest({ userId, operationId: "op-single", path: "/alerts", method: "POST", body: {} });
  let releaseSend!: () => void;
  let sendCount = 0;
  const send = async () => {
    sendCount += 1;
    await new Promise<void>((resolve) => { releaseSend = resolve; });
  };
  const first = syncOfflineQueue(userId, token, send);
  const second = syncOfflineQueue(userId, token, send);
  while (!releaseSend) await new Promise<void>((resolve) => setImmediate(resolve));
  releaseSend();

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(sendCount, 1);
  assert.equal(firstResult.syncedThisRun, 1);
  assert.equal(secondResult.syncedThisRun, 1);
});

test("retries temporary failures with backoff then stops after the maximum attempts", async () => {
  await enqueueRequest({ userId, operationId: "op-retry", path: "/alerts", method: "POST", body: {} });
  let attempts = 0;
  let result = await syncOfflineQueue(userId, token, async () => {
    attempts += 1;
    throw new QueuedOperationError("Temporary server failure (503)", 503);
  });
  assert.equal(result.pending, 1);
  assert.equal(result.networkUnavailable, true);
  assert.ok((result.nextRetryAt ?? 0) - Date.now() >= 900);
  assert.ok((result.nextRetryAt ?? 0) - Date.now() <= 1_100);

  while (attempts < 5) {
    const [operation] = await queuedOperations(userId);
    await updateOperation(operation, { nextAttemptAt: Date.now() - 1 });
    result = await syncOfflineQueue(userId, token, async () => {
      attempts += 1;
      throw new QueuedOperationError("Temporary server failure (503)", 503);
    });
    if (attempts < 5) {
      const expectedDelay = 1_000 * 2 ** (attempts - 1);
      const remainingDelay = (result.nextRetryAt ?? 0) - Date.now();
      assert.ok(remainingDelay >= expectedDelay - 100);
      assert.ok(remainingDelay <= expectedDelay + 100);
    }
  }
  assert.equal(result.failed, 1);
  assert.equal((await queuedOperations(userId))[0].status, "FAILED");
});

test("marks validation/auth failures permanent and preserves FIFO behind the failed operation", async () => {
  await enqueueRequest({ userId, operationId: "op-invalid", path: "/alerts", method: "POST", body: {} });
  await enqueueRequest({ userId, operationId: "op-following", path: "/alerts", method: "POST", body: {} });
  const sent: string[] = [];
  const result = await syncOfflineQueue(userId, token, async (operation) => {
    sent.push(operation.operationId);
    throw new QueuedOperationError("Request rejected (400)", 400);
  });

  assert.deepEqual(sent, ["op-invalid"]);
  assert.equal(result.failed, 1);
  assert.equal(result.pending, 1);
});

test("marks expired-token responses authentication-required and does not retry automatically", async () => {
  await enqueueRequest({ userId, operationId: "op-expired", path: "/alerts", method: "POST", body: {} });
  const result = await syncOfflineQueue(userId, token, async () => {
    throw new QueuedOperationError("Request rejected (401)", 401);
  });

  assert.equal(result.authenticationRequired, 1);
  assert.equal(result.pending, 0);
  assert.equal((await queuedOperations(userId))[0].lastError, "Authentication required; sign in before retrying.");
});

test("refuses to process another user's queue with the current user's token", async () => {
  await enqueueRequest({ userId: "user-b", operationId: "op-b", path: "/alerts", method: "POST", body: {} });
  let sendCount = 0;
  await assert.rejects(syncOfflineQueue("user-b", token, async () => { sendCount += 1; }), /does not match queued operation owner/);
  await assert.rejects(retryFailedOfflineQueue("user-b", token, async () => { sendCount += 1; }), /does not match queued operation owner/);
  assert.equal(sendCount, 0);
  assert.equal((await queueCounts("user-b")).pending, 1);
});

test("sends the unchanged observation time and operation ID with the active session token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(null, { status: 201 });
  };
  try {
    await sendQueuedRequest({
      operationId: "op-location", userId, path: "/locations/cargo/cargo-1", method: "POST",
      body: { latitude: -77, longitude: 166, observedAt: "2026-09-26T10:15:00.000Z", eventId: "op-location" },
      createdAt: Date.now(), observedAt: "2026-09-26T10:15:00.000Z", attemptCount: 1, status: "SYNCING",
      lastAttemptAt: Date.now(), nextAttemptAt: null, lastError: null, leaseOwner: "worker", leaseExpiresAt: Date.now() + 1000,
    }, token, "http://api.test/api");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedUrl, "http://api.test/api/locations/cargo/cargo-1");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("Authorization"), `Bearer ${token}`);
  assert.equal(headers.get("Idempotency-Key"), "op-location");
  const payload = JSON.parse(String(capturedInit?.body)) as { observedAt: string };
  assert.equal(payload.observedAt, "2026-09-26T10:15:00.000Z");
});