import jwt from "jsonwebtoken";
import { isUserRole, type UserRole } from "./roles.js";

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured");
  }
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "1d") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string) {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded === "string" || !decoded.exp || !decoded.iat || typeof decoded.sub !== "string" || !isUserRole(decoded.role)) {
    throw new Error("Invalid authentication token payload");
  }
  return { sub: decoded.sub, role: decoded.role, iat: decoded.iat, exp: decoded.exp } as AuthTokenPayload & { iat: number; exp: number };
}
