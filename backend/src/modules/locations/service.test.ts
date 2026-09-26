import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Location, Prisma } from "@prisma/client";

const database = vi.hoisted(() => ({
  personnel: { findUnique: vi.fn() },
  cargoItem: { findUnique: vi.fn() },
  emergencyAlert: { findUnique: vi.fn() },
  location: { findUnique: vi.fn(), create: vi.fn() },
  personnelLocationHistory: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  cargoLocationHistory: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  emergencyLocationHistory: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

vi.mock("../../db/prisma.js", () => ({ prisma: database }));

import { prisma } from "../../db/prisma.js";
import { createLocationInTransaction, getCurrentLocation, getLocationHistory } from "./service.js";

const observedAt = new Date("2026-09-26T12:00:00.000Z");
const point = {
  id: "loc-1", latitude: 78.12345678, longitude: -12.45678901, observedAt,
  accuracyMeters: 4.5, altitudeMeters: null, source: "GPS", eventId: "3d0e2547-62ca-4339-b6b2-6c0df52a2260",
  expeditionId: "exp-1", createdAt: new Date("2026-09-26T12:01:00.000Z"), updatedAt: new Date("2026-09-26T12:01:00.000Z"),
} as unknown as Location;

function transaction(currentObservedAt: Date | null = null) {
  return {
    personnel: { findUnique: vi.fn().mockResolvedValue({ id: "person-1", expeditionId: "exp-1", currentLocation: currentObservedAt ? { observedAt: currentObservedAt } : null }), update: vi.fn() },
    cargoItem: { findUnique: vi.fn(), update: vi.fn() },
    emergencyAlert: { findUnique: vi.fn(), update: vi.fn() },
    location: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(point) },
    personnelLocationHistory: { findUnique: vi.fn(), create: vi.fn() },
    cargoLocationHistory: { findUnique: vi.fn(), create: vi.fn() },
    emergencyLocationHistory: { findUnique: vi.fn(), create: vi.fn() },
  };
}

describe("location service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a structured location, history row, and expedition association", async () => {
    const tx = transaction();
    const result = await createLocationInTransaction(tx as unknown as Prisma.TransactionClient, "personnel", "person-1", {
      latitude: 78.12345678,
      longitude: -12.45678901,
      observedAt,
      accuracyMeters: 4.5,
      source: "GPS",
      eventId: point.eventId!,
    });

    expect(tx.location.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      latitude: 78.12345678,
      longitude: -12.45678901,
      observedAt,
      source: "GPS",
      eventId: point.eventId,
      expeditionId: "exp-1",
    }) });
    expect(tx.personnel.update).toHaveBeenCalledWith({ where: { id: "person-1" }, data: { currentLocationId: "loc-1", lastKnownLocation: "78.12345678,-12.45678901" } });
    expect(tx.personnelLocationHistory.create).toHaveBeenCalledWith({ data: { personnelId: "person-1", locationId: "loc-1" } });
    expect(result.location.observedAt).toEqual(observedAt);
    expect(result.location.expeditionId).toBe("exp-1");
  });

  it("does not replace current location with an older offline observation", async () => {
    const tx = transaction(new Date("2026-09-27T12:00:00.000Z"));
    await createLocationInTransaction(tx as unknown as Prisma.TransactionClient, "personnel", "person-1", {
      latitude: 78.12345678,
      longitude: -12.45678901,
      observedAt,
      source: "MANUAL",
      eventId: point.eventId!,
    });

    expect(tx.personnel.update).not.toHaveBeenCalled();
    expect(tx.personnelLocationHistory.create).toHaveBeenCalledOnce();
  });

  it("returns a replay without duplicating history", async () => {
    const tx = transaction();
    tx.location.findUnique.mockResolvedValue(point);
    tx.personnelLocationHistory.findUnique.mockResolvedValue({ id: "history-1" });
    const result = await createLocationInTransaction(tx as unknown as Prisma.TransactionClient, "personnel", "person-1", {
      latitude: 78.12345678,
      longitude: -12.45678901,
      observedAt,
      source: "MANUAL",
      eventId: point.eventId!,
    });

    expect(result.replayed).toBe(true);
    expect(tx.location.create).not.toHaveBeenCalled();
    expect(tx.personnelLocationHistory.create).not.toHaveBeenCalled();
  });

  it("retrieves current and timestamped location history", async () => {
    vi.mocked(prisma.personnel.findUnique).mockResolvedValueOnce({ id: "person-1", currentLocation: point } as never).mockResolvedValueOnce({ id: "person-1" } as never);
    vi.mocked(prisma.personnelLocationHistory.findMany).mockResolvedValue([{ id: "history-1", location: point } as never]);
    vi.mocked(prisma.personnelLocationHistory.count).mockResolvedValue(1);

    await expect(getCurrentLocation("personnel", "person-1")).resolves.toMatchObject({ latitude: 78.12345678, observedAt });
    await expect(getLocationHistory("personnel", "person-1", 1, 20)).resolves.toMatchObject({
      data: [{ latitude: 78.12345678, observedAt, expeditionId: "exp-1" }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
  });
});