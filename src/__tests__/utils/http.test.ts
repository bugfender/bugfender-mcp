import { describe, expect, it, vi } from "vitest";
import { parseRetryAfter, paramsToSearch, withJitter } from "../../utils/http.js";

describe("parseRetryAfter", () => {
  it("returns null for null input", () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRetryAfter("")).toBeNull();
  });

  it("parses numeric seconds and converts to ms", () => {
    expect(parseRetryAfter("5")).toBe(5000);
  });

  it("returns 0 for zero seconds", () => {
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("returns 0 for negative number (parsed as date, clamped to 0)", () => {
    // "-3" fails the >= 0 check for seconds, but Date.parse("-3") is valid (year -3),
    // producing a delta < 0, which is clamped to 0
    expect(parseRetryAfter("-3")).toBe(0);
  });

  it("returns null for garbage string", () => {
    expect(parseRetryAfter("not-a-date")).toBeNull();
  });

  it("parses HTTP-Date string", () => {
    const futureDate = new Date(Date.now() + 10_000).toUTCString();
    const result = parseRetryAfter(futureDate);
    expect(result).toBeTypeOf("number");
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThanOrEqual(11_000);
  });

  it("returns 0 for past HTTP-Date", () => {
    const pastDate = new Date(Date.now() - 10_000).toUTCString();
    expect(parseRetryAfter(pastDate)).toBe(0);
  });
});

describe("paramsToSearch", () => {
  it("returns empty URLSearchParams for empty object", () => {
    const result = paramsToSearch({});
    expect(result.toString()).toBe("");
  });

  it("skips null, undefined, and empty string values", () => {
    const result = paramsToSearch({ a: null, b: undefined, c: "" });
    expect(result.toString()).toBe("");
  });

  it("stringifies numbers", () => {
    const result = paramsToSearch({ page: 2 });
    expect(result.get("page")).toBe("2");
  });

  it("handles arrays by appending multiple values", () => {
    const result = paramsToSearch({ tags: ["a", "b"] });
    expect(result.getAll("tags")).toEqual(["a", "b"]);
  });

  it("skips null/undefined items within arrays", () => {
    const result = paramsToSearch({ tags: ["a", null, undefined, "b"] });
    expect(result.getAll("tags")).toEqual(["a", "b"]);
  });
});

describe("withJitter", () => {
  it("returns a number", () => {
    expect(withJitter(1000)).toBeTypeOf("number");
  });

  it("returns value within ±20% of base", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(withJitter(1000)).toBe(800);

    (Math.random as ReturnType<typeof vi.fn>).mockReturnValue(1);
    expect(withJitter(1000)).toBe(1200);

    vi.restoreAllMocks();
  });
});
