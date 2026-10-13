import { Router, type Request, type Response } from "express";
import { requirePermission } from "../../auth/middleware.js";
import { filterStructuredLocation } from "../../api/crud.js";
import { personnelCreateSchema, personnelListSchema, personnelUpdateSchema } from "./validation.js";
import { PersonnelError } from "./types.js";
import {
  listPersonnel,
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
} from "./service.js";

export const personnelRoutes = Router();

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof PersonnelError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("Personnel route error:", error);
      res.status(500).json({ error: "Internal server error" });
    });
  };

// GET /api/personnel – list with filters
personnelRoutes.get(
  "/",
  requirePermission("personnel.read"),
  asyncRoute(async (req, res) => {
    const parsed = personnelListSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const result = await listPersonnel(parsed.data);
    res.json({
      data: result.data.map((item) => filterStructuredLocation(req, item)),
      pagination: result.pagination,
    });
  }),
);

// GET /api/personnel/:id – single record
personnelRoutes.get(
  "/:id",
  requirePermission("personnel.read"),
  asyncRoute(async (req, res) => {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const record = await getPersonnel(id);
    if (!record) {
      res.status(404).json({ error: "Personnel not found" });
      return;
    }
    res.json(filterStructuredLocation(req, record));
  }),
);

// POST /api/personnel – create
personnelRoutes.post(
  "/",
  requirePermission("personnel.manage"),
  asyncRoute(async (req, res) => {
    const parsed = personnelCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const record = await createPersonnel(parsed.data);
    res.status(201).json(filterStructuredLocation(req, record));
  }),
);

// PATCH /api/personnel/:id – update
personnelRoutes.patch(
  "/:id",
  requirePermission("personnel.manage"),
  asyncRoute(async (req, res) => {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = personnelUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const { record, leadCleared } = await updatePersonnel(id, parsed.data);
    res.json({ ...filterStructuredLocation(req, record), leadCleared });
  }),
);

// DELETE /api/personnel/:id – delete
personnelRoutes.delete(
  "/:id",
  requirePermission("personnel.manage"),
  asyncRoute(async (req, res) => {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await deletePersonnel(id);
    res.status(204).send();
  }),
);
