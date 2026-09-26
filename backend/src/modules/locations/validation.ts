import { z } from "zod";

export const locationEntityTypes = ["personnel", "cargo", "emergency"] as const;

export const locationInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  observedAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  accuracyMeters: z.number().finite().min(0).max(99_999_999).optional(),
  altitudeMeters: z.number().finite().min(-99_999_999).max(99_999_999).optional(),
  source: z.enum(["MANUAL", "GPS", "SYSTEM", "IMPORT", "SIMULATION"]).default("MANUAL"),
  eventId: z.string().uuid(),
  expeditionId: z.string().min(1).optional(),
}).strict();

export const locationEntityTypeSchema = z.enum(locationEntityTypes);

export function parseLegacyCoordinates(value: string | null | undefined) {
  const match = value?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}