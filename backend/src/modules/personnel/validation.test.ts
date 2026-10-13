import { describe, expect, it } from "vitest";
import { personnelCreateSchema, personnelUpdateSchema, personnelListSchema } from "./validation.js";

describe("personnelCreateSchema", () => {
  const valid = {
    expeditionId: "exp-1",
    firstName: "Anna",
    lastName: "Kowalski",
  };

  it("accepts a minimal valid create payload", () => {
    expect(personnelCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = personnelCreateSchema.safeParse({
      ...valid,
      email: "anna@polar.org",
      phone: "+1-555-0100",
      organization: "NCPORS",
      role: "SCIENTIST",
      status: "ON_SITE",
      lastKnownLocation: "Maitri Station",
      emergencyContact: "Dr. Singh",
    });
    expect(result.success).toBe(true);
  });

  it("trims leading/trailing whitespace from firstName and lastName", () => {
    const result = personnelCreateSchema.safeParse({
      ...valid,
      firstName: "  Anna  ",
      lastName: "  Kowalski  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Anna");
      expect(result.data.lastName).toBe("Kowalski");
    }
  });

  it("rejects unknown properties", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, unknownField: "x" }).success).toBe(false);
  });

  it("rejects missing expeditionId", () => {
    const { expeditionId: _, ...rest } = valid;
    expect(personnelCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects firstName longer than 100 characters", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, firstName: "A".repeat(101) }).success).toBe(false);
  });

  it("rejects lastName longer than 100 characters", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, lastName: "B".repeat(101) }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects phone longer than 50 characters", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, phone: "1".repeat(51) }).success).toBe(false);
  });

  it("rejects an invalid role value", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, role: "INVALID" }).success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    expect(personnelCreateSchema.safeParse({ ...valid, status: "DEPLOYED" }).success).toBe(false);
  });
});

describe("personnelUpdateSchema", () => {
  it("accepts a partial valid update", () => {
    expect(personnelUpdateSchema.safeParse({ firstName: "Bob" }).success).toBe(true);
  });

  it("rejects an empty update body", () => {
    expect(personnelUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(personnelUpdateSchema.safeParse({ firstName: "Bob", extra: true }).success).toBe(false);
  });
});

describe("personnelListSchema", () => {
  it("applies defaults when no query params are supplied", () => {
    const result = personnelListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts valid filter combinations", () => {
    const result = personnelListSchema.safeParse({
      expeditionId: "exp-1",
      status: "ON_SITE",
      role: "LEAD",
      q: "anna",
      page: "2",
      pageSize: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("rejects pageSize greater than 100", () => {
    expect(personnelListSchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("rejects an invalid status filter", () => {
    expect(personnelListSchema.safeParse({ status: "GONE" }).success).toBe(false);
  });

  it("rejects an invalid role filter", () => {
    expect(personnelListSchema.safeParse({ role: "JANITOR" }).success).toBe(false);
  });
});
