import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../auth/middleware.js";
import { requirePermission } from "../../auth/middleware.js";
import { prisma } from "../../db/prisma.js";
import { broadcastAlertNew, broadcastLocationUpdated } from "../../realtime.js";
import { createLocationInTransaction, serializeLocation } from "../locations/service.js";
import { locationInputSchema } from "../locations/validation.js";
import {
  asyncRoute,
  filterStructuredLocation,
  parseBody,
  parseId,
  parsePagination,
  sendPage,
} from "../../api/crud.js";

const idSchema = z.string().min(1);
const dateSchema = z.coerce.date().nullable().optional();
const alertSchema = z.object({
  operationId: z.string().uuid().optional(),
  expeditionId: idSchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  locationCoordinates: locationInputSchema.omit({ expeditionId: true }).optional(),
  resolvedAt: dateSchema,
});

export const sortAlertsBySeverity = <T extends { severity: keyof typeof alertSeverityRank; createdAt: Date }>(alerts: T[]) =>
  [...alerts].sort((left, right) => alertSeverityRank[left.severity] - alertSeverityRank[right.severity] || right.createdAt.getTime() - left.createdAt.getTime());

const alertSeverityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

const alertRoutes = Router();
alertRoutes.get("/", requirePermission("emergency.read"), asyncRoute(async (req, res) => {
  const pagination = parsePagination(req, res);
  if (!pagination) return;
  const [alerts, total] = await Promise.all([
    prisma.emergencyAlert.findMany({ orderBy: { createdAt: "desc" }, include: { currentLocation: true } }),
    prisma.emergencyAlert.count(),
  ]);
  const data = sortAlertsBySeverity(alerts)
    .map((alert) => filterStructuredLocation(req, { ...alert, currentLocation: alert.currentLocation ? serializeLocation(alert.currentLocation) : null }))
    .slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
  sendPage(res, data, total, pagination.page, pagination.pageSize);
}));
alertRoutes.post("/", requirePermission("emergency.create"), asyncRoute(async (req, res) => {
  const data = parseBody(alertSchema, req, res);
  const user = (req as AuthenticatedRequest).user;
  if (!data) return;
  const { operationId, locationCoordinates, ...alertData } = data;
  const loadExistingOperation = async () => operationId
    ? prisma.emergencyAlert.findUnique({ where: { operationId }, include: { currentLocation: true } })
    : null;
  const returnExistingOperation = async () => {
    const existing = await loadExistingOperation();
    if (!existing) return false;
    if (existing.createdById !== user.id) {
      res.status(409).json({ error: "Operation ID has already been used" });
      return true;
    }
    res.status(200).json(filterStructuredLocation(req, { ...existing, currentLocation: existing.currentLocation ? serializeLocation(existing.currentLocation) : null }));
    return true;
  };
  if (await returnExistingOperation()) return;
  if (locationCoordinates?.eventId) {
    const existing = await prisma.location.findUnique({
      where: { eventId: locationCoordinates.eventId },
      include: { emergencyHistory: { include: { emergencyAlert: { include: { currentLocation: true } } } } },
    });
    if (existing) {
      const priorAlert = existing.emergencyHistory[0]?.emergencyAlert;
      if (!priorAlert) { res.status(409).json({ error: "Event ID has already been used for another entity" }); return; }
      res.status(200).json(filterStructuredLocation(req, { ...priorAlert, currentLocation: priorAlert.currentLocation ? serializeLocation(priorAlert.currentLocation) : null }));
      return;
    }
  }
  let created: { alert: Awaited<ReturnType<typeof prisma.emergencyAlert.create>>; location?: import("../locations/service.js").LocationPoint };
  try {
    created = await prisma.$transaction(async (tx) => {
      const alert = await tx.emergencyAlert.create({ data: { ...alertData, operationId, createdById: user.id } });
      let location: import("../locations/service.js").LocationPoint | undefined;
      if (locationCoordinates) {
        const result = await createLocationInTransaction(tx, "emergency", alert.id, { ...locationCoordinates, expeditionId: alert.expeditionId });
        location = result.location;
      }
      return { alert, location };
    });
  } catch (error) {
    if (operationId && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      if (await returnExistingOperation()) return;
    }
    throw error;
  }
  const alert = await prisma.emergencyAlert.findUnique({ where: { id: created.alert.id }, include: { currentLocation: true } });
  if (!alert) { res.status(500).json({ error: "Unable to load created alert" }); return; }
  if (created.location) {
    broadcastLocationUpdated({ entityType: "emergency", entityId: alert.id, expeditionId: alert.expeditionId, location: created.location });
  }
  broadcastAlertNew(alert);
  res.status(201).json(filterStructuredLocation(req, { ...alert, currentLocation: alert.currentLocation ? serializeLocation(alert.currentLocation) : null }));
}));
alertRoutes.patch("/:id/resolve", requirePermission("emergency.resolve"), asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  const existing = await prisma.emergencyAlert.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Emergency alert not found" }); return; }
  const updated = await prisma.emergencyAlert.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  res.json(filterStructuredLocation(req, updated));
}));
alertRoutes.get("/:id", requirePermission("emergency.read"), asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  const row = await prisma.emergencyAlert.findUnique({ where: { id }, include: { currentLocation: true } });
  const data = row ? filterStructuredLocation(req, { ...row, currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null }) : null;
  if (!data) { res.status(404).json({ error: "Emergency alert not found" }); return; }
  res.json(data);
}));
alertRoutes.patch("/:id", requirePermission("emergency.manage"), asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  const data = parseBody(alertSchema.omit({ operationId: true }).partial(), req, res);
  if (!id || !data) return;
  const updated = await prisma.emergencyAlert.update({ where: { id }, data });
  res.json(filterStructuredLocation(req, updated));
}));
alertRoutes.delete("/:id", requirePermission("emergency.manage"), asyncRoute(async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  await prisma.emergencyAlert.delete({ where: { id } });
  res.status(204).send();
}));

export default alertRoutes;