import type { z } from "zod";
import type {
  personnelCreateSchema,
  personnelUpdateSchema,
  personnelListSchema,
} from "./validation.js";

export type PersonnelCreate = z.infer<typeof personnelCreateSchema>;
export type PersonnelUpdate = z.infer<typeof personnelUpdateSchema>;
export type PersonnelListQuery = z.infer<typeof personnelListSchema>;

export class PersonnelError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
