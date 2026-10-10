import { Router, type Request, type Response } from "express";
import { z, type ZodType, type ZodTypeAny } from "zod";
import type { AuthenticatedRequest } from "../auth/middleware.js";
import { requirePermission } from "../auth/middleware.js";
import { hasPermission } from "../auth/roles.js";
import { prisma } from "../db/prisma.js";
import { broadcastCargoUpdate, broadcastLocationUpdated } from "../realtime.js";
import { formatLegacyLocation, serializeLocation, recordLocation } from "../modules/locations/service.js";
import { parseLegacyCoordinates } from "../modules/locations/validation.js";

export { prisma };

const idSchema = z.string().min(1);
const dateSchema = z.coerce.date().nullable().optional();
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const expeditionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  destination: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  leadScientistId: idSchema.nullable().optional(),
});

const personnelSchema = z.object({
  expeditionId: idSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  organization: z.string().trim().max(200).nullable().optional(),
  role: z.enum(["LEAD", "SCIENTIST", "LOGISTICS", "MEDICAL", "ENGINEER", "MEMBER"]).optional(),
  status: z.enum(["ASSIGNED", "ON_SITE", "RETURNED", "INACTIVE"]).optional(),
  lastKnownLocation: z.string().trim().max(200).nullable().optional(),
  emergencyContact: z.string().trim().max(200).nullable().optional(),
});

const cargoSchema = z.object({
  expeditionId: idSchema,
  trackingCode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  quantity: z.number().int().min(1).optional(),
  weightKg: z.number().nonnegative().nullable().optional(),
  priority: z.enum(["LOW", "STANDARD", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["PLANNED", "IN_TRANSIT", "AT_DESTINATION", "RECEIVED", "LOST"]).optional(),
  origin: z.string().trim().max(200).nullable().optional(),
  destination: z.string().trim().max(200).nullable().optional(),
  expectedAt: dateSchema,
  receivedAt: dateSchema,
});

const inventorySchema = z.object({
  expeditionId: idSchema.nullable().optional(),
  cargoItemId: idSchema.nullable().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().int().min(0).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  condition: z.enum(["NEW", "GOOD", "NEEDS_REPAIR", "DAMAGED", "RETIRED"]).optional(),
  lastCountedAt: dateSchema,
});

export const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response) => {
    void handler(request, response).catch(() => response.status(500).json({ error: "Internal server error" }));
  };

function validationError(response: Response, error: z.ZodError) {
  response.status(400).json({ error: "Validation failed", details: error.flatten() });
}

export function parseBody<TSchema extends ZodTypeAny>(schema: TSchema, request: Request, response: Response): z.infer<TSchema> | undefined {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    validationError(response, result.error);
    return undefined;
  }
  return result.data;
}

export function parseId(request: Request, response: Response) {
  const result = idSchema.safeParse(request.params.id);
  if (!result.success) {
    response.status(400).json({ error: "Invalid id" });
    return undefined;
  }
  return result.data;
}

export function parsePagination(request: Request, response: Response) {
  const result = paginationSchema.safeParse(request.query);
  if (!result.success) {
    validationError(response, result.error);
    return undefined;
  }
  return result.data;
}

export function sendPage(response: Response, data: unknown[], total: number, page: number, pageSize: number) {
  response.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export function filterStructuredLocation<T>(request: Request, value: T): T {
  const role = (request as AuthenticatedRequest).user.role;
  if (hasPermission(role, "locations.read") || typeof value !== "object" || value === null) return value;
  const filtered = { ...value, currentLocation: null } as Record<string, unknown>;
  for (const key of ["location", "lastKnownLocation"]) {
    if (typeof filtered[key] === "string" && parseLegacyCoordinates(filtered[key] as string)) filtered[key] = null;
  }
  return filtered as T;
}

export { expeditionRoutes } from "../modules/expeditions/routes.js";

function createSimpleCrudRoutes<T extends object>(
  router: Router,
  schema: ZodType<T>,
  patchSchema: ZodType<Partial<T>>,
  operations: {
    list: (skip: number, take: number) => Promise<{ data: unknown[]; total: number }>;
    create: (data: T) => Promise<unknown>;
    get: (id: string) => Promise<unknown>;
    update: (id: string, data: Partial<T>) => Promise<unknown>;
    delete: (id: string) => Promise<void>;
    name: string;
    readPermission: "personnel.read" | "cargo.read" | "inventory.read";
    managePermission: "personnel.manage" | "cargo.manage" | "inventory.manage";
    notifyUpdate?: (before: unknown, after: unknown) => void;
  },
) {
  router.get("/", requirePermission(operations.readPermission), asyncRoute(async (req, res) => {
    const pagination = parsePagination(req, res);
    if (!pagination) return;
    const result = await operations.list((pagination.page - 1) * pagination.pageSize, pagination.pageSize);
    sendPage(res, result.data.map((item) => filterStructuredLocation(req, item)), result.total, pagination.page, pagination.pageSize);
  }));
  router.post("/", requirePermission(operations.managePermission), asyncRoute(async (req, res) => {
    const data = parseBody(schema, req, res);
    if (!data) return;
    res.status(201).json(await operations.create(data));
  }));
  router.get("/:id", requirePermission(operations.readPermission), asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    if (!id) return;
    const data = await operations.get(id);
    if (!data) { res.status(404).json({ error: `${operations.name} not found` }); return; }
    res.json(filterStructuredLocation(req, data));
  }));
  router.patch("/:id", requirePermission(operations.managePermission), asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    const data = parseBody(patchSchema, req, res);
    if (!id || !data) return;
    const before = await operations.get(id);
    if (!before) { res.status(404).json({ error: `${operations.name} not found` }); return; }
    const updated = await operations.update(id, data);
    operations.notifyUpdate?.(before, updated);
    res.json(updated);
  }));
  router.delete("/:id", requirePermission(operations.managePermission), asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    if (!id) return;
    await operations.delete(id);
    res.status(204).send();
  }));
}

export const personnelRoutes = Router();
createSimpleCrudRoutes(personnelRoutes, personnelSchema, personnelSchema.partial(), {
  name: "Personnel",
  readPermission: "personnel.read",
  managePermission: "personnel.manage",
  list: async (skip, take) => {
    const [rows, total] = await Promise.all([prisma.personnel.findMany({ skip, take, orderBy: { createdAt: "desc" }, include: { currentLocation: true } }), prisma.personnel.count()]);
    const data = rows.map((row) => ({ ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null }));
    return { data, total };
  },
  create: async (data) => {
    const row = await prisma.personnel.create({ data, include: { currentLocation: true } });
    return { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null };
  },
  get: async (id) => {
    const row = await prisma.personnel.findUnique({ where: { id }, include: { currentLocation: true } });
    return row ? { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null } : null;
  },
  update: async (id, data) => {
    const row = await prisma.personnel.update({ where: { id }, data, include: { currentLocation: true } });
    return { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null };
  },
  delete: async (id) => { await prisma.personnel.delete({ where: { id } }); },
});

export const cargoRoutes = Router();
createSimpleCrudRoutes(cargoRoutes, cargoSchema, cargoSchema.partial(), {
  name: "Cargo item",
  readPermission: "cargo.read",
  managePermission: "cargo.manage",
  list: async (skip, take) => {
    const [rows, total] = await Promise.all([prisma.cargoItem.findMany({ skip, take, orderBy: { createdAt: "desc" }, include: { currentLocation: true } }), prisma.cargoItem.count()]);
    const data = rows.map((row) => ({ ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null }));
    return { data, total };
  },
  create: async (data) => {
    const row = await prisma.cargoItem.create({ data, include: { currentLocation: true } });
    return { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null };
  },
  get: async (id) => {
    const row = await prisma.cargoItem.findUnique({ where: { id }, include: { currentLocation: true } });
    return row ? { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null } : null;
  },
  update: async (id, data) => {
    const row = await prisma.cargoItem.update({ where: { id }, data, include: { currentLocation: true } });
    return { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null };
  },
  delete: async (id) => { await prisma.cargoItem.delete({ where: { id } }); },
  notifyUpdate: (before, after) => {
    const previous = before as { location: string | null; status: string };
    const current = after as { id: string; expeditionId: string; location: string | null; status: string; updatedAt: Date; currentLocation: import("../modules/locations/service.js").LocationPoint | null };
    if (previous.location !== current.location || previous.status !== current.status) {
      broadcastCargoUpdate({
        id: current.id,
        expeditionId: current.expeditionId,
        location: current.location,
        currentLocation: current.currentLocation,
        status: current.status,
        updatedAt: current.updatedAt,
      });
    }
  },
});

const cargoLocationSchema = z.object({
  location: z.string().trim().min(1).max(200),
  observedAt: dateSchema,
  accuracyMeters: z.number().nonnegative().optional(),
  altitudeMeters: z.number().optional(),
  source: z.enum(["MANUAL", "GPS", "SYSTEM", "IMPORT", "SIMULATION"]).optional(),
  eventId: z.string().uuid().optional(),
});

cargoRoutes.post("/:id/location", requirePermission("cargo.manage"), asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  const data = parseBody(cargoLocationSchema, req, res);
  if (!id || !data) return;
  const before = await prisma.cargoItem.findUnique({ where: { id } });
  if (!before) { res.status(404).json({ error: "Cargo item not found" }); return; }
  const coordinates = parseLegacyCoordinates(data.location);
  if (coordinates && data.eventId) {
    const recorded = await recordLocation("cargo", id, {
      ...coordinates,
      ...(data.observedAt ? { observedAt: data.observedAt } : {}),
      ...(data.accuracyMeters !== undefined ? { accuracyMeters: data.accuracyMeters } : {}),
      ...(data.altitudeMeters !== undefined ? { altitudeMeters: data.altitudeMeters } : {}),
      source: data.source ?? "MANUAL",
      eventId: data.eventId,
    });
    const updated = await prisma.cargoItem.findUnique({ where: { id } });
    if (!updated) { res.status(404).json({ error: "Cargo item not found" }); return; }
    if (!recorded.replayed) {
      broadcastLocationUpdated({ entityType: "cargo", entityId: id, expeditionId: updated.expeditionId, location: recorded.location });
      broadcastCargoUpdate({ id, expeditionId: updated.expeditionId, location: formatLegacyLocation(recorded.location), currentLocation: recorded.location, status: updated.status, updatedAt: updated.updatedAt });
    }
    res.json(updated);
    return;
  }
  const updated = await prisma.cargoItem.update({ where: { id }, data: { location: data.location, currentLocationId: null } });
  broadcastCargoUpdate({
    id: updated.id,
    expeditionId: updated.expeditionId,
    location: updated.location,
    currentLocation: null,
    status: updated.status,
    updatedAt: updated.updatedAt,
  });
  res.json(updated);
}));

export const inventoryRoutes = Router();
createSimpleCrudRoutes(inventoryRoutes, inventorySchema, inventorySchema.partial(), {
  name: "Inventory item",
  readPermission: "inventory.read",
  managePermission: "inventory.manage",
  list: async (skip, take) => {
    const [data, total] = await Promise.all([prisma.inventoryItem.findMany({ skip, take, orderBy: { createdAt: "desc" } }), prisma.inventoryItem.count()]);
    return { data, total };
  },
  create: (data) => prisma.inventoryItem.create({ data }),
  get: (id) => prisma.inventoryItem.findUnique({ where: { id } }),
  update: (id, data) => prisma.inventoryItem.update({ where: { id }, data }),
  delete: async (id) => { await prisma.inventoryItem.delete({ where: { id } }); },
});

