import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../../app.js";
import { signAuthToken } from "../../auth/jwt.js";
import { prisma } from "../../db/prisma.js";

vi.mock("../../db/prisma.js", () => ({
  prisma: {
    expedition: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    personnel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("expedition routes", () => {
  const adminToken = signAuthToken({ sub: "u-admin", role: "ADMIN" });
  const coordToken = signAuthToken({ sub: "u-coord", role: "COORDINATOR" });
  const fieldToken = signAuthToken({ sub: "u-field", role: "FIELD_PERSONNEL" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates next sequential code", async () => {
    vi.mocked(prisma.expedition.findMany).mockResolvedValueOnce([
      { code: "IEA-45" },
      { code: "IEA-46" },
    ] as never);

    const res = await request(app)
      .get("/api/expeditions/generate-code?prefix=IEA")
      .set("Authorization", `Bearer ${coordToken}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("IEA-47");
  });

  it("validates expedition code uniqueness and formatting", async () => {
    vi.mocked(prisma.expedition.findMany).mockResolvedValueOnce([
      { id: "e1", code: "IEA-46" },
    ] as never);

    const takenRes = await request(app)
      .get("/api/expeditions/validate-code?code=IEA-46")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(takenRes.status).toBe(400);
    expect(takenRes.body.valid).toBe(false);

    vi.mocked(prisma.expedition.findMany).mockResolvedValueOnce([
      { id: "e1", code: "IEA-46" },
    ] as never);

    const availRes = await request(app)
      .get("/api/expeditions/validate-code?code=IEA-47")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(availRes.status).toBe(200);
    expect(availRes.body.valid).toBe(true);
  });

  it("creates an expedition with coordinator and computes readiness", async () => {
    vi.mocked(prisma.expedition.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: "Dr. ABC" } as never);

    const mockCreated = {
      id: "exp-1",
      name: "Indian Antarctic Expedition",
      code: "IEA-46",
      destination: "Maitri Station",
      description: "Atmospheric & polar research",
      status: "ACTIVE",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2027-03-25"),
      coordinatorId: "user-abc",
      coordinatorName: "Dr. ABC",
      leadScientistId: null,
      leadScientist: null,
      coordinator: { id: "user-abc", name: "Dr. ABC", email: "abc@ncpors.gov", role: "COORDINATOR" },
      _count: { personnel: 42, cargoItems: 187, inventoryItems: 0, emergencyAlerts: 0 },
      emergencyAlerts: [],
    };
    vi.mocked(prisma.expedition.create).mockResolvedValueOnce(mockCreated as never);

    const res = await request(app)
      .post("/api/expeditions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Indian Antarctic Expedition",
        code: "IEA-46",
        destination: "Maitri Station",
        description: "Atmospheric & polar research",
        status: "ACTIVE",
        startDate: "2026-12-10",
        endDate: "2027-03-25",
        coordinatorId: "user-abc",
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("IEA-46");
    expect(res.body.coordinatorName).toBe("Dr. ABC");
    expect(res.body.readiness.score).toBe(82);
  });

  it("lists expeditions with attached readiness scores", async () => {
    const mockExpedition = {
      id: "exp-1",
      name: "Indian Antarctic Expedition",
      code: "IEA-46",
      destination: "Maitri Station",
      description: "Indian Antarctic Expedition",
      status: "ACTIVE",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2027-03-25"),
      coordinatorId: "u1",
      coordinatorName: "Dr. ABC",
      leadScientistId: null,
      leadScientist: null,
      coordinator: { id: "u1", name: "Dr. ABC", email: "abc@ncpors.gov", role: "COORDINATOR" },
      _count: { personnel: 42, cargoItems: 187, inventoryItems: 0, emergencyAlerts: 0 },
      emergencyAlerts: [],
    };

    vi.mocked(prisma.expedition.findMany).mockResolvedValueOnce([mockExpedition] as never);
    vi.mocked(prisma.expedition.count).mockResolvedValueOnce(1);

    const res = await request(app)
      .get("/api/expeditions")
      .set("Authorization", `Bearer ${fieldToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].readiness.score).toBe(82);
  });

  it("allows coordinator to update expedition details", async () => {
    const updated = {
      id: "exp-1",
      name: "Updated Mission",
      code: "IEA-46",
      destination: "Bharati Station",
      status: "ACTIVE",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2027-03-25"),
      coordinatorName: "Dr. ABC",
      leadScientistId: null,
      leadScientist: null,
      coordinator: null,
      _count: { personnel: 0, cargoItems: 0, inventoryItems: 0, emergencyAlerts: 0 },
      emergencyAlerts: [],
    };

    vi.mocked(prisma.expedition.update).mockResolvedValueOnce(updated as never);

    const res = await request(app)
      .patch("/api/expeditions/exp-1")
      .set("Authorization", `Bearer ${coordToken}`)
      .send({ destination: "Bharati Station" });

    expect(res.status).toBe(200);
    expect(res.body.destination).toBe("Bharati Station");
  });

  it("denies FIELD_PERSONNEL from creating or deleting expeditions", async () => {
    const createRes = await request(app)
      .post("/api/expeditions")
      .set("Authorization", `Bearer ${fieldToken}`)
      .send({ name: "Deny", code: "IEA-99" });
    expect(createRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete("/api/expeditions/exp-1")
      .set("Authorization", `Bearer ${fieldToken}`);
    expect(deleteRes.status).toBe(403);
  });
});

