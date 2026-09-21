export type QueuedRequest = {
  id?: number;
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
  token: string;
  createdAt: number;
};

const DB_NAME = "ncpors-offline";
const STORE = "requests";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueRequest(request: Omit<QueuedRequest, "id" | "createdAt">) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).add({ ...request, createdAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function queuedRequests() {
  const database = await openDatabase();
  const requests = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return requests.sort((left, right) => left.createdAt - right.createdAt);
}

async function removeRequest(id: number) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function flushQueue(send: (request: QueuedRequest) => Promise<void>) {
  for (const request of await queuedRequests()) {
    if (request.id === undefined) continue;
    try {
      await send(request);
      await removeRequest(request.id);
    } catch {
      break;
    }
  }
}
