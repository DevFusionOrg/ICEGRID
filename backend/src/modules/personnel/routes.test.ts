import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../../auth/jwt.js";

// ---------------------------------------------------------------------------
// Hoisted Prisma mock
// ---------------------------------------------------------------------------
const database = vi.hoisted(() => ({
  personnel: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  expedition: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../../db/prisma.js", () => ({ prisma: database }));

import { app } from "../../app.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function token(role: "ADMIN" | "COORDINATOR" | "FIELD_PERSONNEL" | "LOGISTICS_OFFICER") {
  return `Bearer ${signAuthToken({ sub: "user-1", role })}`;
}

const basePersonnel = {
  id: "person-1",
  expeditionId: "exp-1",
  firstName: "Anna",
  lastName: "Kowalski",
  email: "anna@polar.org",
  phone: null,
  organization: null,
  role: "SCIENTIST",
  status: "ON_SITE",
  lastKnownLocation: null,
  emergencyContact: null,
  currentLocationId: null,
  currentLocation: null,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const point = {
  id: "loc-1",
  latitude: 78.12345678,
  longitude: -12.45678901,
  observedAt: new Date("2026-09-26T12:00:00Z"),
  accuracyMeters: null,
  altitudeMeters: null,
  source: "MANUAL",
  eventId: null,
  expeditionId: "exp-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockTransaction() {
  database.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) =>
      fn({
        personnel: database.personnel,
        expedition: database.expedition,
      }),
  );
}

describe("personnel routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "personnel-routes-test-secret";
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 401 – unauthenticated
  // -------------------------------------------------------------------------
  describe("authentication", () => {
    for (const [method, path] of [
      ["get", "/api/personnel"],
      ["get", "/api/personnel/person-1"],
      ["post", "/api/personnel"],
      ["patch", "/api/personnel/person-1"],
      ["delete", "/api/personnel/person-1"],
    ] as const) {
      it(`${method.toUpperCase()} ${path} requires authentication`, async () => {
        const res = await (request(app) as unknown as Record<string, (path: string) => request.Test>)[method](path);
        expect(res.status).toBe(401);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 403 – mutation role denial
  // -------------------------------------------------------------------------
  describe("mutation role denial", () => {
    it("denies FIELD_PERSONNEL from creating personnel", async () => {
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("FIELD_PERSONNEL"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "K" });
      expect(res.status).toBe(403);
      expect(database.personnel.create).not.toHaveBeenCalled();
    });

    it("denies FIELD_PERSONNEL from updating personnel", async () => {
      const res = await request(app)
        .patch("/api/personnel/person-1")
        .set("Authorization", token("FIELD_PERSONNEL"))
        .send({ firstName: "Updated" });
      expect(res.status).toBe(403);
    });

    it("denies FIELD_PERSONNEL from deleting personnel", async () => {
      const res = await request(app)
        .delete("/api/personnel/person-1")
        .set("Authorization", token("FIELD_PERSONNEL"));
      expect(res.status).toBe(403);
      expect(database.personnel.delete).not.toHaveBeenCalled();
    });

    it("denies LOGISTICS_OFFICER from creating personnel", async () => {
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("LOGISTICS_OFFICER"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "K" });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Reads – allowed for all roles with personnel.read
  // -------------------------------------------------------------------------
  describe("reads allowed for all roles with personnel.read", () => {
    it("allows FIELD_PERSONNEL to list personnel", async () => {
      database.personnel.findMany.mockResolvedValue([basePersonnel]);
      database.personnel.count.mockResolvedValue(1);
      const res = await request(app)
        .get("/api/personnel")
        .set("Authorization", token("FIELD_PERSONNEL"));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("allows COORDINATOR to list personnel", async () => {
      database.personnel.findMany.mockResolvedValue([basePersonnel]);
      database.personnel.count.mockResolvedValue(1);
      const res = await request(app)
        .get("/api/personnel")
        .set("Authorization", token("COORDINATOR"));
      expect(res.status).toBe(200);
    });

    it("allows FIELD_PERSONNEL to read a single personnel record", async () => {
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      const res = await request(app)
        .get("/api/personnel/person-1")
        .set("Authorization", token("FIELD_PERSONNEL"));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("person-1");
    });
  });

  // -------------------------------------------------------------------------
  // 400 – invalid bodies (one field per test)
  // -------------------------------------------------------------------------
  describe("validation errors", () => {
    it("rejects a create body with an invalid email", async () => {
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "K", email: "not-email" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details).toBeDefined();
    });

    it("rejects a create body with an invalid role", async () => {
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "K", role: "INVALID" });
      expect(res.status).toBe(400);
    });

    it("rejects a create body with an unknown property", async () => {
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "K", hackerField: "x" });
      expect(res.status).toBe(400);
    });

    it("rejects a PATCH body with an invalid status", async () => {
      const res = await request(app)
        .patch("/api/personnel/person-1")
        .set("Authorization", token("ADMIN"))
        .send({ status: "GONE" });
      expect(res.status).toBe(400);
    });

    it("rejects an empty PATCH body", async () => {
      const res = await request(app)
        .patch("/api/personnel/person-1")
        .set("Authorization", token("ADMIN"))
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects a list request with pageSize > 100", async () => {
      const res = await request(app)
        .get("/api/personnel?pageSize=101")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 404 – missing records
  // -------------------------------------------------------------------------
  describe("missing records", () => {
    it("returns 404 for a GET on a missing personnel record", async () => {
      database.personnel.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .get("/api/personnel/missing-id")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Personnel not found");
    });

    it("returns 404 for a PATCH on a missing personnel record", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .patch("/api/personnel/missing-id")
        .set("Authorization", token("ADMIN"))
        .send({ firstName: "Bob" });
      expect(res.status).toBe(404);
    });

    it("returns 404 for a DELETE on a missing personnel record", async () => {
      database.personnel.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete("/api/personnel/missing-id")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 201 on create
  // -------------------------------------------------------------------------
  describe("create", () => {
    it("returns 201 with the created record", async () => {
      database.expedition.findUnique.mockResolvedValue({ id: "exp-1" });
      database.personnel.create.mockResolvedValue({ ...basePersonnel, currentLocation: null });
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "Kowalski" });
      expect(res.status).toBe(201);
      expect(res.body.firstName).toBe("Anna");
    });

    it("returns 400 when the expedition does not exist", async () => {
      database.expedition.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "missing-exp", firstName: "Anna", lastName: "K" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Expedition not found");
    });
  });

  // -------------------------------------------------------------------------
  // 204 on delete
  // -------------------------------------------------------------------------
  describe("delete", () => {
    it("returns 204 on successful delete", async () => {
      database.personnel.findUnique.mockResolvedValue({ id: "person-1" });
      database.personnel.delete.mockResolvedValue({});
      const res = await request(app)
        .delete("/api/personnel/person-1")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // leadCleared on update
  // -------------------------------------------------------------------------
  describe("update – leadCleared", () => {
    it("includes leadCleared: false in PATCH response when no lead was cleared", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.personnel.update.mockResolvedValue({ ...basePersonnel, firstName: "Bob", currentLocation: null });

      const res = await request(app)
        .patch("/api/personnel/person-1")
        .set("Authorization", token("ADMIN"))
        .send({ firstName: "Bob" });
      expect(res.status).toBe(200);
      expect(res.body.leadCleared).toBe(false);
    });

    it("includes leadCleared: true when reassignment cleared a lead", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.expedition.findUnique.mockResolvedValue({ id: "exp-new" });
      database.expedition.updateMany.mockResolvedValue({ count: 1 });
      database.personnel.update.mockResolvedValue({
        ...basePersonnel,
        expeditionId: "exp-new",
        currentLocation: null,
      });

      const res = await request(app)
        .patch("/api/personnel/person-1")
        .set("Authorization", token("ADMIN"))
        .send({ expeditionId: "exp-new" });
      expect(res.status).toBe(200);
      expect(res.body.leadCleared).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Response redaction – filterStructuredLocation
  // -------------------------------------------------------------------------
  describe("response redaction", () => {
    it("redacts currentLocation for FIELD_PERSONNEL (no locations.read)", async () => {
      database.personnel.findMany.mockResolvedValue([
        { ...basePersonnel, currentLocation: point },
      ]);
      database.personnel.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/personnel")
        .set("Authorization", token("FIELD_PERSONNEL"));
      expect(res.status).toBe(200);
      expect(res.body.data[0].currentLocation).toBeNull();
    });

    it("returns currentLocation for ADMIN (has locations.read)", async () => {
      database.personnel.findMany.mockResolvedValue([
        { ...basePersonnel, currentLocation: point },
      ]);
      database.personnel.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/personnel")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(200);
      expect(res.body.data[0].currentLocation).toMatchObject({ latitude: 78.12345678 });
    });

    it("returns currentLocation on create response for COORDINATOR (has locations.read)", async () => {
      // COORDINATOR has both personnel.manage and locations.read, so the location is not redacted
      database.expedition.findUnique.mockResolvedValue({ id: "exp-1" });
      database.personnel.create.mockResolvedValue({
        ...basePersonnel,
        currentLocation: point,
      });

      const res = await request(app)
        .post("/api/personnel")
        .set("Authorization", token("COORDINATOR"))
        .send({ expeditionId: "exp-1", firstName: "Anna", lastName: "Kowalski" });
      expect(res.status).toBe(201);
      // COORDINATOR has locations.read so structured location is returned
      expect(res.body.currentLocation).toMatchObject({ latitude: 78.12345678 });
    });

    it("redacts coordinate-like lastKnownLocation for roles without locations.read", async () => {
      const personnelWithLegacyLocation = {
        ...basePersonnel,
        lastKnownLocation: "78.12,-12.45",
        currentLocation: null,
      };
      database.personnel.findUnique.mockResolvedValue(personnelWithLegacyLocation);

      const res = await request(app)
        .get("/api/personnel/person-1")
        .set("Authorization", token("FIELD_PERSONNEL"));
      expect(res.status).toBe(200);
      expect(res.body.lastKnownLocation).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // List filter construction
  // -------------------------------------------------------------------------
  describe("list filter forwarding", () => {
    it("forwards expeditionId filter to service", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/personnel?expeditionId=exp-99")
        .set("Authorization", token("ADMIN"));
      expect(res.status).toBe(200);
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ expeditionId: "exp-99" }) }),
      );
    });

    it("forwards status and role filters to service", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);

      await request(app)
        .get("/api/personnel?status=RETURNED&role=MEDICAL")
        .set("Authorization", token("ADMIN"));
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "RETURNED", role: "MEDICAL" }),
        }),
      );
    });

    it("forwards q search parameter to OR filter", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);

      await request(app)
        .get("/api/personnel?q=polar")
        .set("Authorization", token("ADMIN"));
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: "polar", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });
  });
});
