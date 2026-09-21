export const USER_ROLES = [
  "ADMIN",
  "COORDINATOR",
  "FIELD_PERSONNEL",
  "LOGISTICS_OFFICER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
