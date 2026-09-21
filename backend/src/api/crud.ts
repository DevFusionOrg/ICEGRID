import { PrismaClient } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { z, type ZodType } from "zod";
import type { AuthenticatedRequest } from "../auth/middleware.js";
import { broadcastAlertNew, broadcastCargoUpdate } from "../realtime.js";

export const prisma = new PrismaClient();

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
  unit: z.string().trim().min(1).max(50).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  condition: z.enum(["NEW", "GOOD", "NEEDS_REPAIR", "DAMAGED", "RETIRED"]).optional(),
  lastCountedAt: dateSchema,
});

const alertSchema = z.object({
  expeditionId: idSchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  resolvedAt: dateSchema,
});

export const sortAlertsBySeverity = <T extends { severity: keyof typeof alertSeverityRank; createdAt: Date }>(alerts: T[]) =>
  [...alerts].sort((left, right) => alertSeverityRank[left.severity] - alertSeverityRank[right.severity] || right.createdAt.getTime() - left.createdAt.getTime());

const alertSeverityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response) => {
    void handler(request, response).catch(() => response.status(500).json({ error: "Internal server error" }));
  };

function validationError(response: Response, error: z.ZodError) {
  response.status(400).json({ error: "Validation failed", details: error.flatten() });
}

function parseBody<T>(schema: ZodType<T>, request: Request, response: Response): T | undefined {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    validationError(response, result.error);
    return undefined;
  }
  return result.data;
}

function parseId(request: Request, response: Response) {
  const result = idSchema.safeParse(request.params.id);
  if (!result.success) {
    response.status(400).json({ error: "Invalid id" });
    return undefined;
  }
  return result.data;
}

function parsePagination(request: Request, response: Response) {
  const result = paginationSchema.safeParse(request.query);
  if (!result.success) {
    validationError(response, result.error);
    return undefined;
  }
  return result.data;
}

function sendPage(response: Response, data: unknown[], total: number, page: number, pageSize: number) {
  response.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export const expeditionRoutes = Router();
expeditionRoutes.get("/", asyncRoute(async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const [data, total] = await Promise.all([
    prisma.expedition.findMany({ skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize, orderBy: { createdAt: "desc" } }),
    prisma.expedition.count(),
  ]);
  sendPage(res, data, total, pagination.page, pagination.pageSize);
}));
expeditionRoutes.post("/", asyncRoute(async (req, res) => {
  const data = parseBody(expeditionSchema, req, res);
  if (!data) return;
  res.status(201).json(await prisma.expedition.create({ data }));
}));
expeditionRoutes.get("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  const data = await prisma.expedition.findUnique({ where: { id } });
  if (!data) { res.status(404).json({ error: "Expedition not found" }); return; }
  res.json(data);
}));
expeditionRoutes.patch("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  const data = parseBody(expeditionSchema.partial(), req, res);
  if (!id || !data) return;
  res.json(await prisma.expedition.update({ where: { id }, data }));
}));
expeditionRoutes.delete("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  await prisma.expedition.delete({ where: { id } });
  res.status(204).send();
}));

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
    notifyUpdate?: (before: unknown, after: unknown) => void;
  },
) {
  router.get("/", asyncRoute(async (req, res) => {
    const pagination = parsePagination(req, res);
    if (!pagination) return;
    const result = await operations.list((pagination.page - 1) * pagination.pageSize, pagination.pageSize);
    sendPage(res, result.data, result.total, pagination.page, pagination.pageSize);
  }));
  router.post("/", asyncRoute(async (req, res) => {
    const data = parseBody(schema, req, res);
    if (!data) return;
    res.status(201).json(await operations.create(data));
  }));
  router.get("/:id", asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    if (!id) return;
    const data = await operations.get(id);
    if (!data) { res.status(404).json({ error: `${operations.name} not found` }); return; }
    res.json(data);
  }));
  router.patch("/:id", asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    const data = parseBody(patchSchema, req, res);
    if (!id || !data) return;
    const before = await operations.get(id);
    if (!before) { res.status(404).json({ error: `${operations.name} not found` }); return; }
    const updated = await operations.update(id, data);
    operations.notifyUpdate?.(before, updated);
    res.json(updated);
  }));
  router.delete("/:id", asyncRoute(async (req, res) => {
    const id = parseId(req, res);
    if (!id) return;
    await operations.delete(id);
    res.status(204).send();
  }));
}

export const personnelRoutes = Router();
createSimpleCrudRoutes(personnelRoutes, personnelSchema, personnelSchema.partial(), {
  name: "Personnel",
  list: async (skip, take) => {
    const [data, total] = await Promise.all([prisma.personnel.findMany({ skip, take, orderBy: { createdAt: "desc" } }), prisma.personnel.count()]);
    return { data, total };
  },
  create: (data) => prisma.personnel.create({ data }),
  get: (id) => prisma.personnel.findUnique({ where: { id } }),
  update: (id, data) => prisma.personnel.update({ where: { id }, data }),
  delete: async (id) => { await prisma.personnel.delete({ where: { id } }); },
});

export const cargoRoutes = Router();
createSimpleCrudRoutes(cargoRoutes, cargoSchema, cargoSchema.partial(), {
  name: "Cargo item",
  list: async (skip, take) => {
    const [data, total] = await Promise.all([prisma.cargoItem.findMany({ skip, take, orderBy: { createdAt: "desc" } }), prisma.cargoItem.count()]);
    return { data, total };
  },
  create: (data) => prisma.cargoItem.create({ data }),
  get: (id) => prisma.cargoItem.findUnique({ where: { id } }),
  update: (id, data) => prisma.cargoItem.update({ where: { id }, data }),
  delete: async (id) => { await prisma.cargoItem.delete({ where: { id } }); },
  notifyUpdate: (before, after) => {
    const previous = before as { location: string | null; status: string };
    const current = after as { id: string; location: string | null; status: string; updatedAt: Date };
    if (previous.location !== current.location || previous.status !== current.status) {
      broadcastCargoUpdate({
        id: current.id,
        location: current.location,
        status: current.status,
        updatedAt: current.updatedAt,
      });
    }
  },
});

const cargoLocationSchema = z.object({
  location: z.string().trim().min(1).max(200),
});

cargoRoutes.post("/:id/location", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  const data = parseBody(cargoLocationSchema, req, res);
  if (!id || !data) return;
  const before = await prisma.cargoItem.findUnique({ where: { id } });
  if (!before) { res.status(404).json({ error: "Cargo item not found" }); return; }
  const updated = await prisma.cargoItem.update({ where: { id }, data });
  broadcastCargoUpdate({
    id: updated.id,
    location: updated.location,
    status: updated.status,
    updatedAt: updated.updatedAt,
  });
  res.json(updated);
}));

export const inventoryRoutes = Router();
createSimpleCrudRoutes(inventoryRoutes, inventorySchema, inventorySchema.partial(), {
  name: "Inventory item",
  list: async (skip, take) => {
    const [data, total] = await Promise.all([prisma.inventoryItem.findMany({ skip, take, orderBy: { createdAt: "desc" } }), prisma.inventoryItem.count()]);
    return { data, total };
  },
  create: (data) => prisma.inventoryItem.create({ data }),
  get: (id) => prisma.inventoryItem.findUnique({ where: { id } }),
  update: (id, data) => prisma.inventoryItem.update({ where: { id }, data }),
  delete: async (id) => { await prisma.inventoryItem.delete({ where: { id } }); },
});

export const alertRoutes = Router();
alertRoutes.get("/", asyncRoute(async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const [alerts, total] = await Promise.all([
    prisma.emergencyAlert.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.emergencyAlert.count(),
  ]);
  const data = sortAlertsBySeverity(alerts)
    .slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
  sendPage(res, data, total, pagination.page, pagination.pageSize);
}));
alertRoutes.post("/", asyncRoute(async (req, res) => {
  const data = parseBody(alertSchema, req, res);
  const user = (req as AuthenticatedRequest).user;
  if (!data) return;
  const alert = await prisma.emergencyAlert.create({ data: { ...data, createdById: user.id } });
  broadcastAlertNew(alert);
  res.status(201).json(alert);
}));
alertRoutes.patch("/:id/resolve", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  const existing = await prisma.emergencyAlert.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Emergency alert not found" }); return; }
  res.json(await prisma.emergencyAlert.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } }));
}));
alertRoutes.get("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  const data = await prisma.emergencyAlert.findUnique({ where: { id } });
  if (!data) { res.status(404).json({ error: "Emergency alert not found" }); return; }
  res.json(data);
}));
alertRoutes.patch("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  const data = parseBody(alertSchema.partial(), req, res);
  if (!id || !data) return;
  res.json(await prisma.emergencyAlert.update({ where: { id }, data }));
}));
alertRoutes.delete("/:id", asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  await prisma.emergencyAlert.delete({ where: { id } });
  res.status(204).send();
}));
