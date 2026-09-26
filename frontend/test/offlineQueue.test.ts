import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { claimNextOperation, enqueueRequest, queueCounts, queuedOperations, updateOperation } from "../src/lib/offlineQueue.ts";

const databaseName = "ncpors-offline";

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

test("persists token-free operations and isolates them by user", async () => {
  await enqueueRequest({
    userId: "user-a", operationId: "op-a", path: "/locations/cargo/cargo-1", method: "POST",
    body: { latitude: -77, longitude: 166, observedAt: "2026-09-26T10:15:00.000Z", eventId: "op-a" },
  });

  const afterReopen = await queuedOperations("user-a");
  assert.equal(afterReopen.length, 1);
  assert.equal(afterReopen[0].observedAt, "2026-09-26T10:15:00.000Z");
  assert.equal(afterReopen[0].operationId, "op-a");
  assert.equal(Object.hasOwn(afterReopen[0], "token"), false);
  assert.deepEqual(await queuedOperations("user-b"), []);
});

test("atomically claims one pending operation for a single worker", async () => {
  await enqueueRequest({ userId: "user-a", path: "/alerts", method: "POST", body: { operationId: "sos-1" } });
  const [workerA, workerB] = await Promise.all([
    claimNextOperation("user-a", "worker-a"),
    claimNextOperation("user-a", "worker-b"),
  ]);

  assert.equal([workerA, workerB].filter(Boolean).length, 1);
  const claimed = workerA ?? workerB;
  assert.equal(claimed?.status, "SYNCING");
  assert.equal(claimed?.attemptCount, 1);
  await updateOperation(claimed!, { status: "SYNCED", leaseOwner: null, leaseExpiresAt: null, body: null });
  assert.equal((await queueCounts("user-a")).synced, 1);
});

test("upgrades legacy token-bearing records, attributes by JWT subject, and never retains the token", async () => {
  const legacyToken = `header.${btoa(JSON.stringify({ sub: "legacy-user" })).replace(/=/g, "")}.signature`;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("requests", "readwrite");
      transaction.objectStore("requests").add({
        path: "/locations/cargo/cargo-old", method: "POST", token: legacyToken,
        body: { latitude: -77, longitude: 166, observedAt: "2026-09-26T10:15:00.000Z" }, createdAt: 100,
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  });

  const upgraded = await queuedOperations("legacy-user");
  assert.equal(upgraded.length, 1);
  assert.equal(upgraded[0].status, "PENDING");
  assert.equal(upgraded[0].observedAt, "2026-09-26T10:15:00.000Z");
  assert.equal(Object.hasOwn(upgraded[0], "token"), false);
  assert.equal((await queuedOperations("someone-else")).length, 0);
});

test("quarantines legacy operations that cannot be safely attributed", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("requests", "readwrite");
      transaction.objectStore("requests").add({ path: "/alerts", method: "POST", body: { title: "queued" }, createdAt: 100 });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  });

  assert.deepEqual(await queuedOperations("user-a"), []);
  assert.equal((await queueCounts("user-a")).unassignedFailed, 1);
});