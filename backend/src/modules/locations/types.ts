import type { z } from "zod";
import type { locationEntityTypeSchema, locationInputSchema } from "./validation.js";

export type LocationEntityType = z.infer<typeof locationEntityTypeSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;