import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requirePermission } from "../../auth/middleware.js";
import { prisma } from "../../db/prisma.js";
import {
  calculateExpeditionReadiness,
  generateExpeditionCode,
  validateExpeditionCode,
} from "./service.js";

const idSchema = z.string().min(1);
const dateSchema = z.coerce.date().nullable().optional();

const expeditionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(2).max(50),
  destination: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).default("PLANNED"),
  startDate: dateSchema,
  endDate: dateSchema,
  leadScientistId: idSchema.nullable().optional(),
  coordinatorId: idSchema.nullable().optional(),
  coordinatorName: z.string().trim().max(200).nullable().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const expeditionRoutes = Router();

const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response) => {
    void handler(request, response).catch((err) => {
      console.error("Expedition Route Error:", err);
      response.status(500).json({ error: "Internal server error" });
    });
  };

/**
 * GET /api/expeditions/generate-code
 * Auto-generates the next sequential expedition code.
 */
expeditionRoutes.get("/generate-code", requirePermission("expeditions.read"), asyncRoute(async (req, res) => {
  const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "IEA";
  const records = await prisma.expedition.findMany({ select: { code: true } });
  const codes = records.map((r) => r.code);
  const nextCode = generateExpeditionCode(codes, prefix);
  res.json({ code: nextCode });
}));

/**
 * GET /api/expeditions/validate-code
 * Validates expedition code format and uniqueness.
 */
expeditionRoutes.get("/validate-code", requirePermission("expeditions.read"), asyncRoute(async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const currentId = typeof req.query.id === "string" ? req.query.id : undefined;

  const records = await prisma.expedition.findMany({ select: { id: true, code: true } });
  const validation = validateExpeditionCode(code, records, currentId);

  if (!validation.valid) {
    res.status(400).json({ valid: false, error: validation.error });
    return;
  }
  res.json({ valid: true, message: "Expedition code is valid and available." });
}));

/**
 * GET /api/expeditions
 * Lists expeditions with optional search, status filtering, pagination, and readiness.
 */
expeditionRoutes.get("/", requirePermission("expeditions.read"), asyncRoute(async (req, res) => {
  const queryResult = paginationSchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ error: "Validation failed", details: queryResult.error.flatten() });
    return;
  }
  const { page, pageSize, q, status } = queryResult.data;

  const whereClause: Record<string, unknown> = {};
  if (status) {
    whereClause.status = status;
  }
  if (q) {
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { destination: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.expedition.findMany({
      where: whereClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        leadScientist: {
          select: { id: true, firstName: true, lastName: true, role: true, organization: true },
        },
        coordinator: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: {
            personnel: true,
            cargoItems: true,
            inventoryItems: true,
            emergencyAlerts: true,
          },
        },
        emergencyAlerts: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          select: { severity: true, status: true },
        },
      },
    }),
    prisma.expedition.count({ where: whereClause }),
  ]);

  const data = rows.map((item) => {
    const readiness = calculateExpeditionReadiness(item);
    return {
      ...item,
      coordinatorName: item.coordinatorName || item.coordinator?.name || null,
      readiness: {
        score: readiness.score,
        status: readiness.status,
        summary: readiness.summary,
      },
    };
  });

  res.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}));

/**
 * POST /api/expeditions
 * Creates a new expedition with code validation and coordinator assignment.
 */
expeditionRoutes.post("/", requirePermission("expeditions.create"), asyncRoute(async (req, res) => {
  const result = expeditionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    return;
  }
  const data = result.data;

  // Validate code uniqueness
  const existingRecords = await prisma.expedition.findMany({ select: { id: true, code: true } });
  const validation = validateExpeditionCode(data.code, existingRecords);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // If coordinatorId is provided without coordinatorName, resolve user name
  let coordinatorName = data.coordinatorName;
  if (data.coordinatorId && !coordinatorName) {
    const user = await prisma.user.findUnique({ where: { id: data.coordinatorId }, select: { name: true } });
    if (user) {
      coordinatorName = user.name;
    }
  }

  const created = await prisma.expedition.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      destination: data.destination || null,
      description: data.description || null,
      status: data.status,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      coordinatorId: data.coordinatorId || null,
      coordinatorName: coordinatorName || null,
      leadScientistId: data.leadScientistId || null,
    },
    include: {
      leadScientist: {
        select: { id: true, firstName: true, lastName: true, role: true, organization: true },
      },
      coordinator: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: {
        select: { personnel: true, cargoItems: true, inventoryItems: true, emergencyAlerts: true },
      },
    },
  });

  const readiness = calculateExpeditionReadiness(created);
  res.status(201).json({
    ...created,
    readiness: {
      score: readiness.score,
      status: readiness.status,
      summary: readiness.summary,
    },
  });
}));

/**
 * GET /api/expeditions/:id/readiness
 * Retrieves detailed readiness checklist and metrics for an expedition.
 */
expeditionRoutes.get("/:id/readiness", requirePermission("expeditions.read"), asyncRoute(async (req, res) => {
  const idResult = idSchema.safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid expedition ID" });
    return;
  }
  const id = idResult.data;

  const expedition = await prisma.expedition.findUnique({
    where: { id },
    include: {
      leadScientist: true,
      coordinator: true,
      personnel: true,
      cargoItems: true,
      inventoryItems: true,
      emergencyAlerts: true,
      _count: {
        select: { personnel: true, cargoItems: true, inventoryItems: true, emergencyAlerts: true },
      },
    },
  });

  if (!expedition) {
    res.status(404).json({ error: "Expedition not found" });
    return;
  }

  const readiness = calculateExpeditionReadiness(expedition);
  res.json({
    expeditionId: expedition.id,
    expeditionName: expedition.name,
    expeditionCode: expedition.code,
    ...readiness,
  });
}));

/**
 * GET /api/expeditions/:id
 * Retrieves complete expedition details including full relations and readiness.
 */
expeditionRoutes.get("/:id", requirePermission("expeditions.read"), asyncRoute(async (req, res) => {
  const idResult = idSchema.safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid expedition ID" });
    return;
  }
  const id = idResult.data;

  const data = await prisma.expedition.findUnique({
    where: { id },
    include: {
      leadScientist: {
        select: { id: true, firstName: true, lastName: true, role: true, email: true, phone: true, organization: true },
      },
      coordinator: {
        select: { id: true, name: true, email: true, role: true },
      },
      personnel: {
        select: { id: true, firstName: true, lastName: true, role: true, status: true, organization: true, email: true },
        orderBy: { createdAt: "asc" },
      },
      cargoItems: {
        select: { id: true, trackingCode: true, name: true, status: true, priority: true, quantity: true, weightKg: true },
        orderBy: { createdAt: "asc" },
      },
      inventoryItems: {
        select: { id: true, sku: true, name: true, quantity: true, condition: true },
        orderBy: { createdAt: "asc" },
      },
      emergencyAlerts: {
        select: { id: true, title: true, severity: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { personnel: true, cargoItems: true, inventoryItems: true, emergencyAlerts: true },
      },
    },
  });

  if (!data) {
    res.status(404).json({ error: "Expedition not found" });
    return;
  }

  const readiness = calculateExpeditionReadiness(data);
  res.json({
    ...data,
    coordinatorName: data.coordinatorName || data.coordinator?.name || null,
    readiness,
  });
}));

/**
 * PATCH /api/expeditions/:id
 * Updates expedition fields (dates, status, coordinator, lead scientist, etc.).
 */
expeditionRoutes.patch("/:id", requirePermission("expeditions.update"), asyncRoute(async (req, res) => {
  const idResult = idSchema.safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid expedition ID" });
    return;
  }
  const id = idResult.data;

  const result = expeditionSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    return;
  }
  const updateData = result.data;

  // If code is being changed, validate it
  if (updateData.code) {
    const existing = await prisma.expedition.findMany({ select: { id: true, code: true } });
    const validation = validateExpeditionCode(updateData.code, existing, id);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    updateData.code = updateData.code.toUpperCase();
  }

  // If coordinatorId is updated without coordinatorName, resolve user name
  if (updateData.coordinatorId !== undefined && !updateData.coordinatorName) {
    if (updateData.coordinatorId) {
      const user = await prisma.user.findUnique({ where: { id: updateData.coordinatorId }, select: { name: true } });
      if (user) {
        updateData.coordinatorName = user.name;
      }
    } else {
      updateData.coordinatorName = null;
    }
  }

  const updated = await prisma.expedition.update({
    where: { id },
    data: updateData,
    include: {
      leadScientist: {
        select: { id: true, firstName: true, lastName: true, role: true, organization: true },
      },
      coordinator: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: {
        select: { personnel: true, cargoItems: true, inventoryItems: true, emergencyAlerts: true },
      },
      emergencyAlerts: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        select: { severity: true, status: true },
      },
    },
  });

  const readiness = calculateExpeditionReadiness(updated);
  res.json({
    ...updated,
    coordinatorName: updated.coordinatorName || updated.coordinator?.name || null,
    readiness: {
      score: readiness.score,
      status: readiness.status,
      summary: readiness.summary,
    },
  });
}));

/**
 * DELETE /api/expeditions/:id
 * Deletes or cancels an expedition.
 */
expeditionRoutes.delete("/:id", requirePermission("expeditions.delete"), asyncRoute(async (req, res) => {
  const idResult = idSchema.safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid expedition ID" });
    return;
  }
  const id = idResult.data;

  const existing = await prisma.expedition.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Expedition not found" });
    return;
  }

  await prisma.expedition.delete({ where: { id } });
  res.status(204).send();
}));

