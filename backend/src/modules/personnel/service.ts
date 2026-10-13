import type { Location, Personnel } from "@prisma/client";
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
  const expedition = await prisma.expedition.findUnique({
    where: { id: data.expeditionId },
    select: { id: true },
  });
  if (!expedition) {
    throw new PersonnelError("Expedition not found", 400);
  }

  const row = await prisma.personnel.create({
    data,
    include: { currentLocation: true },
  });
  return serializePersonnel(row);
}

export async function updatePersonnel(id: string, data: PersonnelUpdate) {
  let leadCleared = false;

  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.personnel.findUnique({ where: { id } });
    if (!existing) {
      throw new PersonnelError("Personnel not found", 404);
    }

    if (data.expeditionId && data.expeditionId !== existing.expeditionId) {
      const newExpedition = await tx.expedition.findUnique({
        where: { id: data.expeditionId },
        select: { id: true },
      });
      if (!newExpedition) {
        throw new PersonnelError("Expedition not found", 400);
      }

      // Clear leadScientistId on the previous expedition if it points to this person
      const { count } = await tx.expedition.updateMany({
        where: {
          id: existing.expeditionId,
          leadScientistId: id,
        },
        data: { leadScientistId: null },
      });
      leadCleared = count > 0;
    }

    return tx.personnel.update({
      where: { id },
      data,
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
