import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { sortAlertsBySeverity } from "./crud.js";

describe("core API protection and validation", () => {
  for (const path of ["/api/expeditions", "/api/personnel", "/api/cargo-items", "/api/inventory-items", "/api/emergency-alerts", "/api/alerts"]) {
    it(`requires authentication for ${path}`, async () => {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
    });
  }

  it("rejects malformed tokens before reaching persistence", async () => {
    const response = await request(app)
      .post("/api/expeditions")
      .set("Authorization", "Bearer invalid")
      .send({});
    expect(response.status).toBe(401);
  });

  it("requires authentication for alert creation and resolution", async () => {
    expect((await request(app).post("/api/alerts").send({})).status).toBe(401);
    expect((await request(app).patch("/api/alerts/a1/resolve")).status).toBe(401);
  });

  it("sorts alerts by severity before recency", () => {
    const sorted = sortAlertsBySeverity([
      { severity: "LOW", createdAt: new Date("2026-01-03") },
      { severity: "CRITICAL", createdAt: new Date("2026-01-01") },
      { severity: "HIGH", createdAt: new Date("2026-01-02") },
    ]);
    expect(sorted.map((alert) => alert.severity)).toEqual(["CRITICAL", "HIGH", "LOW"]);
  });
});
