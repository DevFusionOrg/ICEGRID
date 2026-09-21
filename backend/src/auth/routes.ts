import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "./jwt.js";

const router = Router();
const prisma = new PrismaClient();

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.post("/register", async (request, response) => {
  const { email, name, password } = request.body as Record<string, unknown>;
  if (
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    response.status(400).json({ error: "email, name, and a password of at least 8 characters are required" });
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
    response.status(201).json({
      user: publicUser(user),
      token: signAuthToken({ sub: user.id, email: user.email, role: user.role }),
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
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }
    response.json({
      user: publicUser(user),
      token: signAuthToken({ sub: user.id, email: user.email, role: user.role }),
    });
  } catch {
    response.status(500).json({ error: "Unable to log in" });
  }
});

export default router;
