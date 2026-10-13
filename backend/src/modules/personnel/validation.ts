import { z } from "zod";

export const personnelCreateSchema = z
  .object({
    expeditionId: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().email().nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    organization: z.string().trim().max(200).nullable().optional(),
    role: z.enum(["LEAD", "SCIENTIST", "LOGISTICS", "MEDICAL", "ENGINEER", "MEMBER"]).optional(),
    status: z.enum(["ASSIGNED", "ON_SITE", "RETURNED", "INACTIVE"]).optional(),
    lastKnownLocation: z.string().trim().max(200).nullable().optional(),
    emergencyContact: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const personnelUpdateSchema = personnelCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const personnelListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  expeditionId: z.string().min(1).optional(),
  status: z.enum(["ASSIGNED", "ON_SITE", "RETURNED", "INACTIVE"]).optional(),
  role: z.enum(["LEAD", "SCIENTIST", "LOGISTICS", "MEDICAL", "ENGINEER", "MEMBER"]).optional(),
  q: z.string().trim().optional(),
});
