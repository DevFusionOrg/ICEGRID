import { describe, expect, it, vi } from "vitest";
import { signAuthToken } from "./jwt.js";
import { requireAuth, requireRole } from "./middleware.js";

const response = () => {
  const value = { status: vi.fn(), json: vi.fn() };
  value.status.mockReturnValue(value);
  return value;
};

describe("auth middleware", () => {
  it("rejects requests without a bearer token", () => {
    const res = response();
    requireAuth({ header: () => undefined } as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("attaches a valid token user", () => {
    process.env.JWT_SECRET = "test-secret";
    const req = { header: () => `Bearer ${signAuthToken({ sub: "u1", email: "a@b.test", role: "ADMIN" })}` } as { header: () => string; user?: { role: string } };
    const next = vi.fn();
    requireAuth(req as never, response() as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.role).toBe("ADMIN");
  });

  it("enforces role membership", () => {
    const res = response();
    const next = vi.fn();
    requireRole("ADMIN")({ user: { role: "FIELD_PERSONNEL" } } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
