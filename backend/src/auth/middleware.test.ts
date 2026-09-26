import { describe, expect, it, vi } from "vitest";
import { signAuthToken } from "./jwt.js";
import { requireAuth, requirePermission, requireRole } from "./middleware.js";

const response = () => {
  const value = { status: vi.fn(), json: vi.fn() };
  value.status.mockReturnValue(value);
  return value;
};

describe("auth middleware", () => {
  it("rejects requests without a bearer token", () => {
    const res = response();
    requireAuth({ header: () => undefined, method: "GET", path: "/private" } as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("attaches a valid token user", () => {
    process.env.JWT_SECRET = "test-secret";
    const req = { header: () => `Bearer ${signAuthToken({ sub: "u1", role: "ADMIN" })}` } as { header: () => string; user?: { role: string } };
    const next = vi.fn();
    requireAuth(req as never, response() as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.role).toBe("ADMIN");
  });

  it("enforces role membership", () => {
    const res = response();
    const next = vi.fn();
    requireRole("ADMIN")({ user: { role: "FIELD_PERSONNEL" }, method: "POST", baseUrl: "/api/cargo-items", path: "/" } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an authenticated role with the requested permission", () => {
    const next = vi.fn();
    requirePermission("cargo.manage")({ user: { id: "u1", role: "LOGISTICS_OFFICER" }, method: "POST", baseUrl: "/api/cargo-items", path: "/" } as never, response() as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("denies an authenticated role without the requested permission", () => {
    const res = response();
    const next = vi.fn();
    requirePermission("cargo.manage")({ user: { id: "u2", role: "FIELD_PERSONNEL" }, method: "POST", baseUrl: "/api/cargo-items", path: "/" } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects expired tokens", () => {
    process.env.JWT_SECRET = "test-secret";
    const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");
    const token = jwt.sign({ sub: "u1", email: "a@b.test", role: "ADMIN" }, process.env.JWT_SECRET, { expiresIn: -1 });
    const res = response();
    const next = vi.fn();
    requireAuth({ header: () => `Bearer ${token}`, method: "GET", path: "/protected" } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
