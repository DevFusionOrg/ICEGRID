import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { signAuthToken } from "./jwt.js";
import { requirePermission, type AuthenticatedRequest } from "./middleware.js";
import { isUserRole } from "./roles.js";
import { recordAuthAudit } from "./audit.js";

const router = Router();

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.post("/register", async (request, response) => {
  const { email, name, password, role } = request.body as Record<string, unknown>;
  if (
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    response.status(400).json({ error: "email, name, and a password of at least 8 characters are required" });
    return;
  }
  if (role !== undefined && role !== "FIELD_PERSONNEL") {
    recordAuthAudit({ action: "authorization.denied", method: request.method, path: request.path });
    response.status(400).json({ error: "Public registration cannot assign privileged roles" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      response.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash: await bcrypt.hash(password, 12),
        role: "FIELD_PERSONNEL",
      },
    });
    recordAuthAudit({ action: "registration.succeeded", userId: user.id, role: user.role });
    response.status(201).json({
      user: publicUser(user),
      token: signAuthToken({ sub: user.id, role: user.role }),
    });
  } catch {
    response.status(500).json({ error: "Unable to register user" });
  }
});

router.post("/login", async (request, response) => {
  const { email, password } = request.body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    response.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      recordAuthAudit({ action: "login.failed" });
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }
    recordAuthAudit({ action: "login.succeeded", userId: user.id, role: user.role });
    response.json({
      user: publicUser(user),
      token: signAuthToken({ sub: user.id, role: user.role }),
    });
  } catch {
    response.status(500).json({ error: "Unable to log in" });
  }
});

const provisionUserSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8),
  role: z.string().refine(isUserRole, "Invalid role"),
});

export const userRoutes = Router();
userRoutes.post("/", requirePermission("users.manage"), async (request, response) => {
  const result = provisionUserSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    return;
  }

  const actor = (request as AuthenticatedRequest).user;
  try {
    const user = await prisma.user.create({
      data: {
        email: result.data.email.toLowerCase(),
        name: result.data.name,
        passwordHash: await bcrypt.hash(result.data.password, 12),
        role: result.data.role,
      },
    });
    recordAuthAudit({ action: "user.provisioned", userId: actor.id, role: user.role });
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      response.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    response.status(500).json({ error: "Unable to create user" });
  }
});

export default router;
