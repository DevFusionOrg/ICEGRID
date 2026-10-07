import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "./auth/jwt.js";
import type { CargoUpdate, LocationUpdate, AlertUpdate, RealtimeClient, RealtimeUser } from "./realtime.js";
import {
  registerRealtimeClient,
  unregisterRealtimeClient,
  handleExpeditionJoin,
  handleExpeditionLeave,
  broadcastCargoUpdate,
  broadcastLocationUpdated,
  broadcastAlertNew,
  expeditionRoom,
  getConnectedClientCount,
} from "./realtime.js";

const findExpedition = vi.hoisted(() => vi.fn());
vi.mock("./db/prisma.js", () => ({ prisma: { expedition: { findUnique: findExpedition } } }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides?: Partial<RealtimeUser>): RealtimeUser {
  const token = signAuthToken({ sub: overrides?.id ?? "u1", role: overrides?.role ?? "ADMIN" });
  const { sub, role, iat, exp } = (() => {
    // decode without verify to extract claims for test user
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
    return payload as { sub: string; role: any; iat: number; exp: number };
  })();
  return {
    id: sub,
    role,
    permissions: [],
    tokenIssuedAt: iat,
    tokenExpiresAt: exp,
    ...overrides,
  };
}

function makeClient(
  id: string,
  user: RealtimeUser,
  expeditions: string[] = [],
): { client: RealtimeClient; events: Array<{ event: string; data: unknown }> } {
  const events: Array<{ event: string; data: unknown }> = [];
  const client: RealtimeClient = {
    id,
    user,
    expeditions: new Set(expeditions),
    send: (event, data) => events.push({ event, data }),
    close: () => unregisterRealtimeClient(id),
  };
  return { client, events };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("realtime SSE registry", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "realtime-test-secret";
    vi.mocked(findExpedition).mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }));
  });

  afterEach(() => {
    // Unregister any clients left over between tests
    // (tests should clean up themselves, but just in case)
  });

  // ── Register / Unregister ──────────────────────────────────────────────────

  it("registers and unregisters clients", () => {
    const { client } = makeClient("c1", makeUser());
    expect(getConnectedClientCount()).toBe(0);
    registerRealtimeClient(client);
    expect(getConnectedClientCount()).toBe(1);
    unregisterRealtimeClient("c1");
    expect(getConnectedClientCount()).toBe(0);
  });

  // ── Expedition join / leave ────────────────────────────────────────────────

  it("allows a client with expeditions.read to join an expedition", async () => {
    const { client } = makeClient("c2", makeUser({ role: "FIELD_PERSONNEL", permissions: [] }));
    registerRealtimeClient(client);

    const result = await handleExpeditionJoin("c2", "exp-1");
    expect(result).toEqual({ ok: true });
    expect(client.expeditions.has("exp-1")).toBe(true);

    unregisterRealtimeClient("c2");
  });

  it("rejects join when expedition does not exist", async () => {
    const { client } = makeClient("c3", makeUser({ role: "ADMIN" }));
    registerRealtimeClient(client);
    vi.mocked(findExpedition).mockResolvedValueOnce(null);

    const result = await handleExpeditionJoin("c3", "missing");
    expect(result).toEqual({ ok: false, error: "Expedition not found or inaccessible" });

    unregisterRealtimeClient("c3");
  });

  it("returns error when client is not found", async () => {
    const result = await handleExpeditionJoin("nonexistent", "exp-1");
    expect(result).toEqual({ ok: false, error: "Client not found or disconnected" });
  });

  it("removes expedition on leave", async () => {
    const { client } = makeClient("c4", makeUser(), ["exp-1"]);
    registerRealtimeClient(client);

    const result = handleExpeditionLeave("c4", "exp-1");
    expect(result).toEqual({ ok: true });
    expect(client.expeditions.has("exp-1")).toBe(false);

    unregisterRealtimeClient("c4");
  });

  // ── broadcastCargoUpdate ───────────────────────────────────────────────────

  it("scopes cargo events to joined expeditions only", () => {
    const adminUser = makeUser({ id: "admin", role: "ADMIN" });
    const { client: joined, events: joinedEvents } = makeClient("c5", adminUser, ["exp-1"]);
    const { client: notJoined, events: notJoinedEvents } = makeClient("c6", adminUser);

    registerRealtimeClient(joined);
    registerRealtimeClient(notJoined);

    const update: CargoUpdate = {
      id: "cargo-1",
      expeditionId: "exp-1",
      location: "-77,166",
      status: "IN_TRANSIT",
      updatedAt: new Date(),
    };
    broadcastCargoUpdate(update);

    expect(joinedEvents.map((e) => e.event)).toEqual(
      expect.arrayContaining(["cargo.updated", "cargo:update"]),
    );
    expect(notJoinedEvents).toHaveLength(0);

    unregisterRealtimeClient("c5");
    unregisterRealtimeClient("c6");
  });

  it("redacts location for roles without locations.read", () => {
    // FIELD_PERSONNEL does NOT have locations.read
    const fieldUser = makeUser({ id: "field", role: "FIELD_PERSONNEL" });
    const { client, events } = makeClient("c7", fieldUser, ["exp-1"]);
    registerRealtimeClient(client);

    const update: CargoUpdate = {
      id: "cargo-1",
      expeditionId: "exp-1",
      location: "-77.85,166.67",
      currentLocation: {
        id: "loc-1",
        latitude: -77.85,
        longitude: 166.67,
        observedAt: new Date(),
        accuracyMeters: null,
        altitudeMeters: null,
        source: "GPS",
        eventId: null,
        expeditionId: "exp-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      status: "IN_TRANSIT",
      updatedAt: new Date(),
    };
    broadcastCargoUpdate(update);

    const cargoUpdated = events.find((e) => e.event === "cargo.updated")?.data as CargoUpdate;
    expect(cargoUpdated.location).toBeNull();
    expect(cargoUpdated.currentLocation).toBeNull();

    unregisterRealtimeClient("c7");
  });

  // ── broadcastLocationUpdated ───────────────────────────────────────────────

  it("delivers location.updated only to roles with locations.read", () => {
    const adminUser = makeUser({ id: "admin", role: "ADMIN" });
    const fieldUser = makeUser({ id: "field", role: "FIELD_PERSONNEL" });
    const { client: adminClient, events: adminEvents } = makeClient("c8", adminUser, ["exp-1"]);
    const { client: fieldClient, events: fieldEvents } = makeClient("c9", fieldUser, ["exp-1"]);

    registerRealtimeClient(adminClient);
    registerRealtimeClient(fieldClient);

    const update: LocationUpdate = {
      entityType: "personnel",
      entityId: "person-1",
      expeditionId: "exp-1",
      location: {
        id: "loc-1",
        latitude: -77.85,
        longitude: 166.67,
        observedAt: new Date(),
        accuracyMeters: null,
        altitudeMeters: null,
        source: "GPS",
        eventId: null,
        expeditionId: "exp-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    broadcastLocationUpdated(update);

    expect(adminEvents.some((e) => e.event === "location.updated")).toBe(true);
    expect(fieldEvents.some((e) => e.event === "location.updated")).toBe(false);

    unregisterRealtimeClient("c8");
    unregisterRealtimeClient("c9");
  });

  // ── broadcastAlertNew ──────────────────────────────────────────────────────

  it("sends alert:new to ADMIN/COORDINATOR and emergency.created to all with emergency.read", () => {
    const adminUser = makeUser({ id: "admin", role: "ADMIN" });
    const fieldUser = makeUser({ id: "field", role: "FIELD_PERSONNEL" });
    const { client: adminClient, events: adminEvents } = makeClient("c10", adminUser, ["exp-1"]);
    const { client: fieldClient, events: fieldEvents } = makeClient("c11", fieldUser, ["exp-1"]);

    registerRealtimeClient(adminClient);
    registerRealtimeClient(fieldClient);

    const alert: AlertUpdate = {
      id: "alert-1",
      expeditionId: "exp-1",
      title: "SOS",
      message: "Help needed",
      severity: "CRITICAL",
      status: "OPEN",
      location: "-77,166",
      createdAt: new Date(),
      resolvedAt: null,
    };
    broadcastAlertNew(alert);

    // Admin gets alert:new (with location) + emergency.created
    expect(adminEvents.some((e) => e.event === "alert:new")).toBe(true);
    expect(adminEvents.some((e) => e.event === "emergency.created")).toBe(true);

    // FIELD_PERSONNEL does NOT get alert:new, but gets emergency.created (no location field)
    expect(fieldEvents.some((e) => e.event === "alert:new")).toBe(false);
    const fieldEmergency = fieldEvents.find((e) => e.event === "emergency.created")?.data as Record<string, unknown>;
    expect(fieldEmergency).toBeDefined();
    expect(fieldEmergency).not.toHaveProperty("location");

    unregisterRealtimeClient("c10");
    unregisterRealtimeClient("c11");
  });

  // ── Helper types ───────────────────────────────────────────────────────────

  it("expeditionRoom helper returns correct string", () => {
    expect(expeditionRoom("exp-42")).toBe("expedition:exp-42");
  });
});