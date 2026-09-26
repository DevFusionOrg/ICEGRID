import assert from "node:assert/strict";
import { test } from "node:test";
import { RealtimeSocketManager, type ICEGRIDSocket } from "../src/lib/realtimeClient.ts";

test("reuses one socket for the authenticated session and disconnects it on token change", () => {
  const connections: Array<{ token: string; disconnect: () => void }> = [];
  const manager = new RealtimeSocketManager((token) => {
    const connection = { token, disconnect: () => { connection.disconnectCount += 1; }, disconnectCount: 0 };
    connections.push(connection);
    return connection as unknown as ICEGRIDSocket;
  });

  const firstConsumer = manager.get("session-token");
  const secondConsumer = manager.get("session-token");
  assert.equal(firstConsumer, secondConsumer);
  assert.equal(connections.length, 1);

  manager.get("refreshed-token");
  assert.equal(connections.length, 2);
  assert.equal(connections[0].disconnectCount, 1);
  manager.disconnect();
  assert.equal(connections[1].disconnectCount, 1);
});