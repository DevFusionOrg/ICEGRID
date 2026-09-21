import { createServer } from "node:http";
import { io as connect } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { signAuthToken } from "./auth/jwt.js";
import { broadcastCargoUpdate, createRealtimeServer } from "./realtime.js";

describe("realtime server", () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    servers.length = 0;
  });

  it("accepts authenticated websocket clients", async () => {
    process.env.JWT_SECRET = "test-secret";
    const server = createServer();
    const realtime = createRealtimeServer(server);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server did not bind");

    const client = connect(`http://localhost:${address.port}`, {
      auth: { token: signAuthToken({ sub: "u1", email: "field@ncpors.local", role: "FIELD_PERSONNEL" }) },
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => {
        expect(realtime.sockets.sockets.size).toBe(1);
        client.once("cargo:update", (update) => {
          expect(update.id).toBe("cargo-1");
          expect(update.location).toBe("South Pole");
          client.close();
          resolve();
        });
        broadcastCargoUpdate({
          id: "cargo-1",
          location: "South Pole",
          status: "IN_TRANSIT",
          updatedAt: new Date(),
        });
      });
      client.once("connect_error", (error) => {
        client.close();
        reject(error);
      });
    });
  });
});
