import type { Location, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { LocationEntityType, LocationInput } from "./types.js";

export class LocationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type LocationPoint = {
  id: string;
  latitude: number;
  longitude: number;
  observedAt: Date;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  source: Location["source"];
  eventId: string | null;
  expeditionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeLocation(location: Location): LocationPoint {
  return {
    id: location.id,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    observedAt: location.observedAt,
    accuracyMeters: location.accuracyMeters === null ? null : Number(location.accuracyMeters),
    altitudeMeters: location.altitudeMeters === null ? null : Number(location.altitudeMeters),
    source: location.source,
    eventId: location.eventId,
    expeditionId: location.expeditionId,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

export function formatLegacyLocation(location: Pick<LocationPoint, "latitude" | "longitude">) {
  return `${location.latitude},${location.longitude}`;
}

async function getEntity(tx: Prisma.TransactionClient, entityType: LocationEntityType, entityId: string) {
  switch (entityType) {
    case "personnel": return tx.personnel.findUnique({ where: { id: entityId }, select: { id: true, expeditionId: true, currentLocation: { select: { observedAt: true } } } });
    case "cargo": return tx.cargoItem.findUnique({ where: { id: entityId }, select: { id: true, expeditionId: true, currentLocation: { select: { observedAt: true } } } });
    case "emergency": return tx.emergencyAlert.findUnique({ where: { id: entityId }, select: { id: true, expeditionId: true, currentLocation: { select: { observedAt: true } } } });
  }
}

async function isLinkedToEntity(tx: Prisma.TransactionClient, entityType: LocationEntityType, entityId: string, locationId: string) {
  switch (entityType) {
    case "personnel": return Boolean(await tx.personnelLocationHistory.findUnique({ where: { personnelId_locationId: { personnelId: entityId, locationId } } }));
    case "cargo": return Boolean(await tx.cargoLocationHistory.findUnique({ where: { cargoItemId_locationId: { cargoItemId: entityId, locationId } } }));
    case "emergency": return Boolean(await tx.emergencyLocationHistory.findUnique({ where: { emergencyAlertId_locationId: { emergencyAlertId: entityId, locationId } } }));
  }
}

async function attachLocation(tx: Prisma.TransactionClient, entityType: LocationEntityType, entityId: string, locationId: string, legacyValue: string, updateCurrent: boolean) {
  switch (entityType) {
    case "personnel":
      if (updateCurrent) await tx.personnel.update({ where: { id: entityId }, data: { currentLocationId: locationId, lastKnownLocation: legacyValue } });
      await tx.personnelLocationHistory.create({ data: { personnelId: entityId, locationId } });
      break;
    case "cargo":
      if (updateCurrent) await tx.cargoItem.update({ where: { id: entityId }, data: { currentLocationId: locationId, location: legacyValue } });
      await tx.cargoLocationHistory.create({ data: { cargoItemId: entityId, locationId } });
      break;
    case "emergency":
      if (updateCurrent) await tx.emergencyAlert.update({ where: { id: entityId }, data: { currentLocationId: locationId, location: legacyValue } });
      await tx.emergencyLocationHistory.create({ data: { emergencyAlertId: entityId, locationId } });
      break;
  }
}

export async function createLocationInTransaction(
  tx: Prisma.TransactionClient,
  entityType: LocationEntityType,
  entityId: string,
  input: LocationInput,
) {
  const entity = await getEntity(tx, entityType, entityId);
  if (!entity) throw new LocationError("Location owner not found", 404);
  if (input.expeditionId && input.expeditionId !== entity.expeditionId) {
    throw new LocationError("Location expedition must match the location owner's expedition", 400);
  }

  const eventId = input.eventId;
  const existing = await tx.location.findUnique({ where: { eventId } });
  if (existing) {
    if (!(await isLinkedToEntity(tx, entityType, entityId, existing.id))) {
      throw new LocationError("Event ID has already been used for another entity", 409);
    }
    return { location: serializeLocation(existing), replayed: true };
  }

  const location = await tx.location.create({
    data: {
      latitude: input.latitude,
      longitude: input.longitude,
      observedAt: input.observedAt ?? new Date(),
      accuracyMeters: input.accuracyMeters,
      altitudeMeters: input.altitudeMeters,
      source: input.source,
      eventId,
      expeditionId: input.expeditionId ?? entity.expeditionId,
    },
  });
  const serialized = serializeLocation(location);
  const updateCurrent = !entity.currentLocation || serialized.observedAt >= entity.currentLocation.observedAt;
  await attachLocation(tx, entityType, entityId, location.id, formatLegacyLocation(serialized), updateCurrent);
  return { location: serialized, replayed: false };
}

export async function recordLocation(entityType: LocationEntityType, entityId: string, input: LocationInput) {
  return prisma.$transaction((tx) => createLocationInTransaction(tx, entityType, entityId, input), { isolationLevel: "Serializable" });
}

export async function getCurrentLocation(entityType: LocationEntityType, entityId: string) {
  let result;
  switch (entityType) {
    case "personnel": result = await prisma.personnel.findUnique({ where: { id: entityId }, select: { id: true, currentLocation: true } }); break;
    case "cargo": result = await prisma.cargoItem.findUnique({ where: { id: entityId }, select: { id: true, currentLocation: true } }); break;
    case "emergency": result = await prisma.emergencyAlert.findUnique({ where: { id: entityId }, select: { id: true, currentLocation: true } }); break;
  }
  if (!result) throw new LocationError("Location owner not found", 404);
  return result.currentLocation ? serializeLocation(result.currentLocation) : null;
}

export async function getLocationHistory(entityType: LocationEntityType, entityId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  let data: Location[];
  let total: number;
  switch (entityType) {
    case "personnel": {
      const [rows, count] = await Promise.all([
        prisma.personnelLocationHistory.findMany({ where: { personnelId: entityId }, include: { location: true }, orderBy: { location: { observedAt: "desc" } }, skip, take: pageSize }),
        prisma.personnelLocationHistory.count({ where: { personnelId: entityId } }),
      ]);
      if (!(await prisma.personnel.findUnique({ where: { id: entityId }, select: { id: true } }))) throw new LocationError("Location owner not found", 404);
      data = rows.map((row) => row.location); total = count; break;
    }
    case "cargo": {
      const [rows, count] = await Promise.all([
        prisma.cargoLocationHistory.findMany({ where: { cargoItemId: entityId }, include: { location: true }, orderBy: { location: { observedAt: "desc" } }, skip, take: pageSize }),
        prisma.cargoLocationHistory.count({ where: { cargoItemId: entityId } }),
      ]);
      if (!(await prisma.cargoItem.findUnique({ where: { id: entityId }, select: { id: true } }))) throw new LocationError("Location owner not found", 404);
      data = rows.map((row) => row.location); total = count; break;
    }
    case "emergency": {
      const [rows, count] = await Promise.all([
        prisma.emergencyLocationHistory.findMany({ where: { emergencyAlertId: entityId }, include: { location: true }, orderBy: { location: { observedAt: "desc" } }, skip, take: pageSize }),
        prisma.emergencyLocationHistory.count({ where: { emergencyAlertId: entityId } }),
      ]);
      if (!(await prisma.emergencyAlert.findUnique({ where: { id: entityId }, select: { id: true } }))) throw new LocationError("Location owner not found", 404);
      data = rows.map((row) => row.location); total = count; break;
    }
  }
  return { data: data.map(serializeLocation), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}