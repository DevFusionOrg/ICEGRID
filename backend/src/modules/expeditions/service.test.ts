import { describe, expect, it } from "vitest";
import {
  calculateExpeditionReadiness,
  generateExpeditionCode,
  validateExpeditionCode,
} from "./service.js";

describe("expedition service", () => {
  describe("calculateExpeditionReadiness", () => {
    it("matches the exact example scenario: 82% readiness", () => {
      // Example from prompt:
      // IEA-46 — Indian Antarctic Expedition
      // Destination: Maitri Station
      // Status: ACTIVE
      // Start: 10 Dec 2026
      // End: 25 Mar 2027
      // Coordinator: Dr. ABC
      // Personnel: 42
      // Cargo: 187 items
      // Readiness: 82%
      const result = calculateExpeditionReadiness({
        name: "Indian Antarctic Expedition",
        code: "IEA-46",
        destination: "Maitri Station",
        description: "46th Indian Scientific Expedition to Antarctica",
        startDate: new Date("2026-12-10"),
        endDate: new Date("2027-03-25"),
        status: "ACTIVE",
        coordinatorName: "Dr. ABC",
        leadScientistId: null,
        _count: {
          personnel: 42,
          cargoItems: 187,
          inventoryItems: 0,
          emergencyAlerts: 0,
        },
      });

      expect(result.score).toBe(82);
      expect(result.status).toBe("READY");
      expect(result.metrics.personnelCount).toBe(42);
      expect(result.metrics.cargoCount).toBe(187);
    });

    it("evaluates a fully configured expedition at 100% readiness", () => {
      const result = calculateExpeditionReadiness({
        name: "Bharati Wintering Mission",
        code: "IEA-47",
        destination: "Bharati Station",
        description: "Winter-over atmospheric observation and geological surveys",
        startDate: new Date("2026-11-01"),
        endDate: new Date("2027-11-01"),
        status: "ACTIVE",
        coordinatorName: "Dr. XYZ",
        leadScientistId: "scientist-1",
        _count: {
          personnel: 15,
          cargoItems: 50,
          inventoryItems: 30,
          emergencyAlerts: 0,
        },
      });

      expect(result.score).toBe(100);
      expect(result.status).toBe("READY");
    });

    it("deducts readiness score when critical alerts are unresolved", () => {
      const base = calculateExpeditionReadiness({
        destination: "Maitri Station",
        description: "Standard mission",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2027-03-01"),
        coordinatorName: "Coordinator 1",
        leadScientistId: "lead-1",
        _count: { personnel: 10, cargoItems: 10 },
      });

      const withAlert = calculateExpeditionReadiness({
        destination: "Maitri Station",
        description: "Standard mission",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2027-03-01"),
        coordinatorName: "Coordinator 1",
        leadScientistId: "lead-1",
        emergencyAlerts: [{ severity: "CRITICAL", status: "OPEN" }],
        _count: { personnel: 10, cargoItems: 10, emergencyAlerts: 1 },
      });

      expect(withAlert.score).toBeLessThan(base.score);
      expect(withAlert.status).toBe("ATTENTION_REQUIRED");
    });
  });

  describe("generateExpeditionCode", () => {
    it("generates IEA-46 when no existing codes exist for IEA prefix", () => {
      expect(generateExpeditionCode([])).toBe("IEA-46");
    });

    it("increments to the next sequential code", () => {
      expect(generateExpeditionCode(["IEA-46", "IEA-47"])).toBe("IEA-48");
      expect(generateExpeditionCode(["ARC-01", "ARC-02"], "ARC")).toBe("ARC-03");
    });
  });

  describe("validateExpeditionCode", () => {
    it("validates valid expedition codes", () => {
      expect(validateExpeditionCode("IEA-46", []).valid).toBe(true);
      expect(validateExpeditionCode("EXP-2026-01", []).valid).toBe(true);
    });

    it("rejects duplicate codes", () => {
      const existing = [{ id: "exp-1", code: "IEA-46" }];
      const res = validateExpeditionCode("IEA-46", existing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("already in use");
    });

    it("allows the same code for the current expedition during edits", () => {
      const existing = [{ id: "exp-1", code: "IEA-46" }];
      expect(validateExpeditionCode("IEA-46", existing, "exp-1").valid).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(validateExpeditionCode("INVALID CODE", []).valid).toBe(false);
      expect(validateExpeditionCode("", []).valid).toBe(false);
      expect(validateExpeditionCode("A", []).valid).toBe(false);
    });
  });
});

