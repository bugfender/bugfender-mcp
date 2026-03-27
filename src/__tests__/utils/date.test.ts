import { describe, expect, it } from "vitest";
import { normalizeStartDate, normalizeEndDate } from "../../utils/date.js";

describe("normalizeStartDate", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeStartDate(undefined)).toBeUndefined();
  });

  it("appends T00:00:00Z to YYYY-MM-DD", () => {
    expect(normalizeStartDate("2024-06-15")).toBe("2024-06-15T00:00:00Z");
  });

  it("passes through already-ISO strings", () => {
    expect(normalizeStartDate("2024-06-15T12:30:00Z")).toBe("2024-06-15T12:30:00Z");
  });
});

describe("normalizeEndDate", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeEndDate(undefined)).toBeUndefined();
  });

  it("appends T23:59:59Z to YYYY-MM-DD", () => {
    expect(normalizeEndDate("2024-06-15")).toBe("2024-06-15T23:59:59Z");
  });

  it("passes through already-ISO strings", () => {
    expect(normalizeEndDate("2024-06-15T12:30:00Z")).toBe("2024-06-15T12:30:00Z");
  });
});
