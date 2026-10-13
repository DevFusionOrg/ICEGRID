import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Hoisted Prisma mock — must be defined before any imports that load the db
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

import {
  listPersonnel,
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
} from "./service.js";
import { PersonnelError } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const basePersonnel = {
  id: "person-1",
  expeditionId: "exp-1",
  firstName: "Anna",
  lastName: "Kowalski",
  email: "anna@polar.org",
  phone: null,
  organization: null,
  role: "SCIENTIST" as const,
  status: "ON_SITE" as const,
  lastKnownLocation: null,
  emergencyContact: null,
  currentLocationId: null,
  currentLocation: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const point = {
  id: "loc-1",
  latitude: 78,
  longitude: -12,
  observedAt: new Date("2026-09-26T12:00:00Z"),
  accuracyMeters: null,
  altitudeMeters: null,
  source: "MANUAL",
  eventId: null,
  expeditionId: "exp-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Simulate a Prisma transaction by calling the callback with the mock db
function mockTransaction() {
  database.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) =>
      fn({
        personnel: database.personnel,
        expedition: database.expedition,
      }),
  );
}

describe("personnel service", () => {
  beforeEach(() => vi.clearAllMocks());

  // -------------------------------------------------------------------------
  // listPersonnel
  // -------------------------------------------------------------------------
  describe("listPersonnel", () => {
    it("returns paginated data with serialized location", async () => {
      const row = { ...basePersonnel, currentLocation: point };
      database.personnel.findMany.mockResolvedValue([row]);
      database.personnel.count.mockResolvedValue(1);

      const result = await listPersonnel({ page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentLocation).toMatchObject({ latitude: 78 });
      expect(result.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    });

    it("runs list and count concurrently (Promise.all)", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);
      await listPersonnel({ page: 1, pageSize: 20 });
      expect(database.personnel.findMany).toHaveBeenCalledOnce();
      expect(database.personnel.count).toHaveBeenCalledOnce();
    });

    it("builds an expeditionId filter", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);
      await listPersonnel({ page: 1, pageSize: 20, expeditionId: "exp-2" });
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ expeditionId: "exp-2" }) }),
      );
    });

    it("builds a case-insensitive OR filter for q", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);
      await listPersonnel({ page: 1, pageSize: 20, q: "anna" });
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: "anna", mode: "insensitive" } },
              { lastName: { contains: "anna", mode: "insensitive" } },
              { email: { contains: "anna", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });

    it("applies status and role filters", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);
      await listPersonnel({ page: 1, pageSize: 20, status: "ASSIGNED", role: "LEAD" });
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ASSIGNED", role: "LEAD" }),
        }),
      );
    });

    it("orders by createdAt desc", async () => {
      database.personnel.findMany.mockResolvedValue([]);
      database.personnel.count.mockResolvedValue(0);
      await listPersonnel({ page: 1, pageSize: 20 });
      expect(database.personnel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPersonnel
  // -------------------------------------------------------------------------
  describe("getPersonnel", () => {
    it("returns null for a missing record", async () => {
      database.personnel.findUnique.mockResolvedValue(null);
      await expect(getPersonnel("missing")).resolves.toBeNull();
    });

    it("serializes the currentLocation", async () => {
      database.personnel.findUnique.mockResolvedValue({ ...basePersonnel, currentLocation: point });
      const result = await getPersonnel("person-1");
      expect(result?.currentLocation).toMatchObject({ latitude: 78, longitude: -12 });
    });
  });

  // -------------------------------------------------------------------------
  // createPersonnel
  // -------------------------------------------------------------------------
  describe("createPersonnel", () => {
    const createData = {
      expeditionId: "exp-1",
      firstName: "Anna",
      lastName: "Kowalski",
    };

    it("throws PersonnelError(400) when expedition is missing", async () => {
      database.expedition.findUnique.mockResolvedValue(null);
      await expect(createPersonnel(createData)).rejects.toMatchObject({
        status: 400,
        message: "Expedition not found",
      });
    });

    it("creates and returns the record with serialized location", async () => {
      database.expedition.findUnique.mockResolvedValue({ id: "exp-1" });
      database.personnel.create.mockResolvedValue({ ...basePersonnel, currentLocation: null });
      const result = await createPersonnel(createData);
      expect(result.firstName).toBe("Anna");
      expect(result.currentLocation).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // updatePersonnel
  // -------------------------------------------------------------------------
  describe("updatePersonnel", () => {
    it("throws PersonnelError(404) when personnel is missing", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(null);
      await expect(updatePersonnel("missing", { firstName: "Bob" })).rejects.toMatchObject({
        status: 404,
        message: "Personnel not found",
      });
    });

    it("updates without lead clearing when expeditionId is unchanged", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.personnel.update.mockResolvedValue({ ...basePersonnel, firstName: "Bob", currentLocation: null });

      const { record, leadCleared } = await updatePersonnel("person-1", { firstName: "Bob" });
      expect(record.firstName).toBe("Bob");
      expect(leadCleared).toBe(false);
      expect(database.expedition.updateMany).not.toHaveBeenCalled();
    });

    it("throws PersonnelError(400) when the new expedition is missing", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.expedition.findUnique.mockResolvedValue(null);
      await expect(
        updatePersonnel("person-1", { expeditionId: "exp-new" }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("clears leadScientistId on the previous expedition and returns leadCleared=true", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.expedition.findUnique.mockResolvedValue({ id: "exp-new" });
      database.expedition.updateMany.mockResolvedValue({ count: 1 });
      database.personnel.update.mockResolvedValue({
        ...basePersonnel,
        expeditionId: "exp-new",
        currentLocation: null,
      });

      const { leadCleared } = await updatePersonnel("person-1", { expeditionId: "exp-new" });
      expect(leadCleared).toBe(true);
      expect(database.expedition.updateMany).toHaveBeenCalledWith({
        where: { id: "exp-1", leadScientistId: "person-1" },
        data: { leadScientistId: null },
      });
    });

    it("returns leadCleared=false when the previous expedition was not using this person as lead", async () => {
      mockTransaction();
      database.personnel.findUnique.mockResolvedValue(basePersonnel);
      database.expedition.findUnique.mockResolvedValue({ id: "exp-new" });
      database.expedition.updateMany.mockResolvedValue({ count: 0 });
      database.personnel.update.mockResolvedValue({
        ...basePersonnel,
        expeditionId: "exp-new",
        currentLocation: null,
      });

      const { leadCleared } = await updatePersonnel("person-1", { expeditionId: "exp-new" });
      expect(leadCleared).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // deletePersonnel
  // -------------------------------------------------------------------------
  describe("deletePersonnel", () => {
    it("throws PersonnelError(404) when personnel is missing", async () => {
      database.personnel.findUnique.mockResolvedValue(null);
      await expect(deletePersonnel("missing")).rejects.toMatchObject({
        status: 404,
        message: "Personnel not found",
      });
    });

    it("deletes an existing record", async () => {
      database.personnel.findUnique.mockResolvedValue({ id: "person-1" });
      database.personnel.delete.mockResolvedValue({});
      await expect(deletePersonnel("person-1")).resolves.toBeUndefined();
      expect(database.personnel.delete).toHaveBeenCalledWith({ where: { id: "person-1" } });
    });
  });
});
