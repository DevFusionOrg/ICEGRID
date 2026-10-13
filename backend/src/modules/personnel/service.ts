import type { Location, Personnel, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { serializeLocation } from "../locations/service.js";
import type { PersonnelCreate, PersonnelUpdate, PersonnelListQuery } from "./types.js";
import { PersonnelError } from "./types.js";

type PersonnelWithLocation = Personnel & {
  currentLocation: Location | null;
};

function serializePersonnel(row: PersonnelWithLocation) {
  return {
    ...row,
    currentLocation: row.currentLocation ? serializeLocation(row.currentLocation) : null,
  };
}

export function mapPersonnelRoleToUserRole(role?: string): UserRole {
  switch (role) {
    case "LOGISTICS":
      return "LOGISTICS_OFFICER";
    case "LEAD":
      return "COORDINATOR";
    default:
      return "FIELD_PERSONNEL";
  }
}

export async function listPersonnel(query: PersonnelListQuery) {
  const { page, pageSize, expeditionId, status, role, q } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (expeditionId) where.expeditionId = expeditionId;
  if (status) where.status = status;
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.personnel.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { currentLocation: true },
    }),
    prisma.personnel.count({ where }),
  ]);

  const data = rows.map(serializePersonnel);
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getPersonnel(id: string) {
  const row = await prisma.personnel.findUnique({
    where: { id },
    include: { currentLocation: true },
  });
  if (!row) return null;
  return serializePersonnel(row);
}

export async function createPersonnel(data: PersonnelCreate) {
  if (data.expeditionId) {
    const expedition = await prisma.expedition.findUnique({
      where: { id: data.expeditionId },
      select: { id: true },
    });
    if (!expedition) {
      throw new PersonnelError("Expedition not found", 400);
    }
  }

  if (data.email && prisma.user?.findUnique && prisma.user?.create) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!existingUser) {
      const defaultPassword = process.env.SEED_PASSWORD || "ChangeMe123!";
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: `${data.firstName} ${data.lastName}`.trim(),
          passwordHash,
          role: mapPersonnelRoleToUserRole(data.role),
          isActive: true,
        },
      });
    }
  }

  const { expeditionId, ...rest } = data;
  const createData: Record<string, unknown> = {
    ...rest,
    ...(expeditionId ? { expeditionId } : {}),
  };
  const row = await prisma.personnel.create({
    data: createData as any,
    include: { currentLocation: true },
  });
  return serializePersonnel(row as PersonnelWithLocation);
}

export async function updatePersonnel(id: string, data: PersonnelUpdate) {
  let leadCleared = false;

  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.personnel.findUnique({ where: { id } });
    if (!existing) {
      throw new PersonnelError("Personnel not found", 404);
    }

    const updateData: Record<string, unknown> = { ...data };

    if (data.status === "RETURNED") {
      updateData.expeditionId = null;
    }

    const targetExpeditionId = updateData.expeditionId !== undefined
      ? (updateData.expeditionId as string | null)
      : existing.expeditionId;

    if (targetExpeditionId && targetExpeditionId !== existing.expeditionId) {
      const newExpedition = await tx.expedition.findUnique({
        where: { id: targetExpeditionId },
        select: { id: true },
      });
      if (!newExpedition) {
        throw new PersonnelError("Expedition not found", 400);
      }
    }

    if (existing.expeditionId && (targetExpeditionId !== existing.expeditionId || updateData.expeditionId === null)) {
      const { count } = await tx.expedition.updateMany({
        where: {
          id: existing.expeditionId,
          leadScientistId: id,
        },
        data: { leadScientistId: null },
      });
      if (count > 0) leadCleared = true;
    }

    if (data.email && tx.user?.findUnique && tx.user?.create) {
      const normalizedEmail = data.email.trim().toLowerCase();
      const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (!existingUser) {
        const defaultPassword = process.env.SEED_PASSWORD || "ChangeMe123!";
        const passwordHash = await bcrypt.hash(defaultPassword, 12);
        await tx.user.create({
          data: {
            email: normalizedEmail,
            name: `${data.firstName || existing.firstName} ${data.lastName || existing.lastName}`.trim(),
            passwordHash,
            role: mapPersonnelRoleToUserRole(data.role || existing.role),
            isActive: true,
          },
        });
      }
    }

    return tx.personnel.update({
      where: { id },
      data: updateData,
      include: { currentLocation: true },
    });
  });

  return { record: serializePersonnel(record), leadCleared };
}

export async function deletePersonnel(id: string) {
  const existing = await prisma.personnel.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new PersonnelError("Personnel not found", 404);
  }

  await prisma.personnel.delete({ where: { id } });
}
