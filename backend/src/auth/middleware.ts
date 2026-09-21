import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./jwt.js";
import type { UserRole } from "./roles.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = verifyAuthToken(token);
    (request as AuthenticatedRequest).user = {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
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
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
