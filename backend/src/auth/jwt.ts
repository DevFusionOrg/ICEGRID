import jwt from "jsonwebtoken";
import type { UserRole } from "./roles.js";

export type AuthTokenPayload = {
  sub: string;
  email: string;
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
  return jwt.verify(token, getSecret()) as AuthTokenPayload;
}
