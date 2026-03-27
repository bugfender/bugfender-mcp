import { describe, expect, it } from "vitest";
import { clampPageSize } from "../../utils/pagination.js";

describe("clampPageSize", () => {
  it("returns default (100) for undefined", () => {
    expect(clampPageSize(undefined)).toBe(100);
  });

  it("returns default (100) for 0", () => {
    expect(clampPageSize(0)).toBe(100);
  });

  it("returns the value when within range", () => {
    expect(clampPageSize(50)).toBe(50);
  });

  it("clamps to max (200) when exceeded", () => {
    expect(clampPageSize(300)).toBe(200);
  });
});
