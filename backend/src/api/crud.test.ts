import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("core API protection and validation", () => {
  for (const path of ["/api/expeditions", "/api/personnel", "/api/cargo-items", "/api/inventory-items", "/api/emergency-alerts"]) {
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
});
