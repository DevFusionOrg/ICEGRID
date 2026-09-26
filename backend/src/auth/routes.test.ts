import request from "supertest";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/prisma.js", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

import { app } from "../app.js";
import { prisma } from "../db/prisma.js";
import { signAuthToken } from "./jwt.js";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "person@example.test",
  name: "Expedition User",
  passwordHash: "hashed-password",
  role: "FIELD_PERSONNEL",
  isActive: true,
  ...overrides,
});

const bearer = (role: "ADMIN" | "FIELD_PERSONNEL") => `Bearer ${signAuthToken({ sub: "actor-1", role })}`;

describe("authentication routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "auth-route-test-secret";
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it("logs in an active user and returns the existing user/token response", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as never);
    const response = await request(app).post("/api/auth/login").send({ email: "PERSON@example.test", password: "correct-password" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: "user-1", role: "FIELD_PERSONNEL" });
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("registers ordinary users as FIELD_PERSONNEL", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(makeUser() as never);
    const response = await request(app).post("/api/auth/register").send({ email: "person@example.test", name: "Expedition User", password: "password123" });

    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.user.create).mock.calls[0][0].data.role).toBe("FIELD_PERSONNEL");
  });

  it("rejects public attempts to self-assign a privileged role", async () => {
    const response = await request(app).post("/api/auth/register").send({ email: "admin@example.test", name: "Admin", password: "password123", role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("allows only an admin to provision a role-bearing account", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue(makeUser({ role: "COORDINATOR" }) as never);
    const response = await request(app).post("/api/users").set("Authorization", bearer("ADMIN")).send({
      email: "new-coordinator@example.test", name: "New Coordinator", password: "password123", role: "COORDINATOR",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("COORDINATOR");
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("denies account provisioning to non-admin users", async () => {
    const response = await request(app).post("/api/users").set("Authorization", bearer("FIELD_PERSONNEL")).send({
      email: "new-admin@example.test", name: "New Admin", password: "password123", role: "ADMIN",
    });

    expect(response.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});