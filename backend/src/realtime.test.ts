import { createServer } from "node:http";
import { io as connect } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { signAuthToken } from "./auth/jwt.js";
import { broadcastAlertNew, broadcastCargoUpdate, createRealtimeServer } from "./realtime.js";

describe("realtime server", () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    servers.length = 0;
  });

  it("accepts authenticated websocket clients and broadcasts cargo updates", async () => {
    process.env.JWT_SECRET = "test-secret";
    const server = createServer();
    const realtime = createRealtimeServer(server);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server did not bind");
    const client = connect(`http://localhost:${address.port}`, {
      auth: { token: signAuthToken({ sub: "u1", role: "ADMIN" }) },
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => {
        expect(realtime.sockets.sockets.size).toBe(1);
        client.once("cargo:update", (update) => {
          expect(update.id).toBe("cargo-1");
          expect(update.location).toBe("South Pole");
          expect(update.currentLocation?.latitude).toBe(78.12345678);
          client.close();
          resolve();
        });
        broadcastCargoUpdate({
          id: "cargo-1", location: "South Pole", status: "IN_TRANSIT", updatedAt: new Date(),
          currentLocation: {
            id: "loc-1", latitude: 78.12345678, longitude: -12.45678901, observedAt: new Date(),
            accuracyMeters: null, altitudeMeters: null, source: "GPS", eventId: "event-1", expeditionId: "exp-1",
            createdAt: new Date(), updatedAt: new Date(),
          },
        });
      });
      client.once("connect_error", (error) => { client.close(); reject(error); });
    });
  });

  it("keeps cargo status updates but redacts coordinates from roles without locations.read", async () => {
    process.env.JWT_SECRET = "test-secret";
    const server = createServer();
    createRealtimeServer(server);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server did not bind");
    const client = connect(`http://localhost:${address.port}`, { auth: { token: signAuthToken({ sub: "field", role: "FIELD_PERSONNEL" }) } });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => {
        client.once("cargo:update", (update) => {
          expect(update.id).toBe("cargo-2");
          expect(update.status).toBe("IN_TRANSIT");
          expect(update.location).toBeNull();
          expect(update.currentLocation).toBeNull();
          client.close();
          resolve();
        });
        broadcastCargoUpdate({ id: "cargo-2", location: "-77.85,166.67", status: "IN_TRANSIT", updatedAt: new Date() });
      });
      client.once("connect_error", (error) => { client.close(); reject(error); });
    });
  });

  it("broadcasts new alerts only to admin and coordinator clients", async () => {
    process.env.JWT_SECRET = "test-secret";
    const server = createServer();
    createRealtimeServer(server);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server did not bind");
    const clients = (["ADMIN", "COORDINATOR", "FIELD_PERSONNEL"] as const).map((role) =>
      connect(`http://localhost:${address.port}`, { auth: { token: signAuthToken({ sub: role, role }) } }),
    );
    await Promise.all(clients.map((client) => new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", reject);
    })));
    const received = [0, 0, 0];
    clients.forEach((client, index) => client.on("alert:new", () => { received[index] += 1; }));
    broadcastAlertNew({
      id: "alert-1", expeditionId: "exp-1", title: "Whiteout", message: "Visibility reduced",
      severity: "HIGH", status: "OPEN", location: null, createdAt: new Date(),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    clients.forEach((client) => client.close());
    expect(received).toEqual([1, 1, 0]);
  });
});
