import { describe, expect, it } from "vitest";
import { locationInputSchema, parseLegacyCoordinates } from "./validation.js";

describe("location validation", () => {
  it("accepts geographic boundary coordinates and transforms observedAt", () => {
    const result = locationInputSchema.safeParse({ latitude: 90, longitude: -180, eventId: "3d0e2547-62ca-4339-b6b2-6c0df52a2260", observedAt: "2026-09-26T12:00:00.000Z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.observedAt).toBeInstanceOf(Date);
      expect(result.data.source).toBe("MANUAL");
    }
  });

  it.each([
    { latitude: 90.0001, longitude: 0 },
    { latitude: -90.0001, longitude: 0 },
    { latitude: 0, longitude: 180.0001 },
    { latitude: 0, longitude: -180.0001 },
    { latitude: "NaN", longitude: 0 },
    { longitude: 0 },
    { latitude: 0, longitude: 0, observedAt: "not-a-timestamp" },
  ])("rejects invalid location input %j", (input) => {
    expect(locationInputSchema.safeParse(input).success).toBe(false);
  });

  it("parses only valid legacy coordinate strings", () => {
    expect(parseLegacyCoordinates(" -77.85, 166.67 ")).toEqual({ latitude: -77.85, longitude: 166.67 });
    expect(parseLegacyCoordinates("South Pole")).toBeNull();
    expect(parseLegacyCoordinates("91,0")).toBeNull();
  });
});