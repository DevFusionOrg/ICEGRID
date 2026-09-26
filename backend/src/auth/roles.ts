export const USER_ROLES = [
  "ADMIN",
  "COORDINATOR",
  "FIELD_PERSONNEL",
  "LOGISTICS_OFFICER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  "users.read",
  "users.manage",
  "expeditions.read",
  "expeditions.create",
  "expeditions.update",
  "expeditions.delete",
  "personnel.read",
  "personnel.manage",
  "cargo.read",
  "cargo.manage",
  "inventory.read",
  "inventory.manage",
  "assets.read",
  "assets.manage",
  "locations.read",
  "emergency.read",
  "emergency.create",
  "emergency.acknowledge",
  "emergency.resolve",
  "emergency.manage",
  "dashboard.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const allPermissions = PERMISSIONS;

const rolePermissions = {
  ADMIN: allPermissions,
  COORDINATOR: [
    "users.read",
    "expeditions.read", "expeditions.create", "expeditions.update", "expeditions.delete",
    "personnel.read", "personnel.manage",
    "cargo.read", "cargo.manage",
    "inventory.read", "inventory.manage",
    "assets.read", "assets.manage",
    "locations.read",
    "emergency.read", "emergency.create", "emergency.acknowledge", "emergency.resolve", "emergency.manage",
    "dashboard.read",
  ],
  FIELD_PERSONNEL: [
    "expeditions.read", "personnel.read", "cargo.read", "inventory.read", "assets.read",
    "emergency.read", "emergency.create", "dashboard.read",
  ],
  LOGISTICS_OFFICER: [
    "expeditions.read", "personnel.read", "cargo.read", "cargo.manage",
    "inventory.read", "inventory.manage", "assets.read", "assets.manage",
    "locations.read",
    "emergency.read", "emergency.create", "dashboard.read",
  ],
} as const satisfies Record<UserRole, readonly Permission[]>;

export function hasPermission(role: UserRole, permission: Permission) {
  return (rolePermissions[role] as readonly Permission[]).includes(permission);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
