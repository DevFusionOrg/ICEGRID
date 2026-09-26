import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./jwt.js";
import { hasPermission, type Permission, type UserRole } from "./roles.js";
import { recordAuthAudit } from "./audit.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: UserRole;
    tokenIssuedAt: number;
    tokenExpiresAt: number;
  };
};

function requestPath(request: Request) {
  return `${request.baseUrl ?? ""}${request.path}`;
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    recordAuthAudit({ action: "authorization.denied", method: request.method, path: requestPath(request) });
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = verifyAuthToken(token);
    (request as AuthenticatedRequest).user = {
      id: user.sub,
      role: user.role,
      tokenIssuedAt: user.iat,
      tokenExpiresAt: user.exp,
    };
    next();
  } catch {
    recordAuthAudit({ action: "authorization.denied", method: request.method, path: requestPath(request) });
    response.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const user = (request as Partial<AuthenticatedRequest>).user;
    if (!user) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(user.role)) {
      recordAuthAudit({ action: "authorization.denied", userId: user.id, role: user.role, method: request.method, path: requestPath(request) });
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const user = (request as Partial<AuthenticatedRequest>).user;
    if (!user) {
      recordAuthAudit({ action: "authorization.denied", permission: permissions.join("|"), method: request.method, path: requestPath(request) });
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!permissions.some((permission) => hasPermission(user.role, permission))) {
      recordAuthAudit({ action: "authorization.denied", userId: user.id, role: user.role, permission: permissions.join("|"), method: request.method, path: requestPath(request) });
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
