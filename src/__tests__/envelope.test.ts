import { describe, expect, it, vi } from "vitest";
import { ok, toolError, serializeEnvelope, handleTool, asToolResult } from "../envelope.js";
import { BugfenderApiError } from "../errors.js";
import type { Envelope, ErrorEnvelope, SuccessEnvelope } from "../types.js";

describe("ok", () => {
  it("wraps data in a success envelope", () => {
    const result = ok({ id: 1 });
    expect(result).toEqual({ ok: true, data: { id: 1 }, pagination: undefined, warnings: undefined });
  });

  it("includes pagination when provided", () => {
    const result = ok([], { page: 1, total: 5 });
    expect(result.ok).toBe(true);
    expect((result as SuccessEnvelope).pagination).toEqual({ page: 1, total: 5 });
  });

  it("includes warnings when provided", () => {
    const result = ok([], undefined, [{ code: "w1", message: "warn" }]);
    expect((result as SuccessEnvelope).warnings).toEqual([{ code: "w1", message: "warn" }]);
  });
});

describe("toolError", () => {
  it("maps 401 status to unauthorized code", () => {
    const err = new BugfenderApiError("fail", 401, null);
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("unauthorized");
  });

  it("maps 403 status to unauthorized code", () => {
    const err = new BugfenderApiError("fail", 403, null);
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("unauthorized");
  });

  it("maps 409 status to email_taken code", () => {
    const err = new BugfenderApiError("fail", 409, null);
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("email_taken");
  });

  it("maps refresh_expired body code to token_expired", () => {
    const err = new BugfenderApiError("fail", 401, { code: "refresh_expired", message: "expired" });
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("token_expired");
  });

  it("defaults to api_error for other statuses", () => {
    const err = new BugfenderApiError("fail", 500, null);
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("api_error");
  });

  it("uses body message when present", () => {
    const err = new BugfenderApiError("fail", 400, { message: "Bad input" });
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.message).toBe("Bad input");
  });

  it("handles non-BugfenderApiError Error instances", () => {
    const err = new Error("something broke");
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("api_error");
    expect(result.error.message).toBe("something broke");
  });

  it("handles non-Error values", () => {
    const result = toolError("string error", true) as ErrorEnvelope;
    expect(result.error.code).toBe("api_error");
    expect(result.error.message).toBe("Unknown Bugfender error");
  });
});

describe("serializeEnvelope", () => {
  it("passes through small success envelopes", () => {
    const envelope: Envelope = { ok: true, data: { x: 1 } };
    expect(serializeEnvelope(envelope)).toBe(envelope);
  });

  it("passes through error envelopes regardless of size", () => {
    const envelope: Envelope = {
      ok: false,
      error: { code: "api_error", message: "x".repeat(600_000) },
    };
    expect(serializeEnvelope(envelope)).toBe(envelope);
  });

  it("truncates large success envelopes", () => {
    const envelope: Envelope = { ok: true, data: "x".repeat(600_000) };
    const result = serializeEnvelope(envelope) as SuccessEnvelope;
    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>).truncated).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "truncated" })]),
    );
  });
});

describe("handleTool", () => {
  it("returns asToolResult on success", async () => {
    const envelope: Envelope = { ok: true, data: { id: 1 } };
    const context = { client: { hasToken: true } } as any;
    const result = await handleTool(context, async () => envelope);
    expect(result.structuredContent).toEqual(envelope);
    expect(result.content[0].type).toBe("text");
  });

  it("catches errors and wraps them", async () => {
    const context = { client: { hasToken: true } } as any;
    const result = await handleTool(context, async () => {
      throw new Error("boom");
    });
    expect(result.structuredContent.ok).toBe(false);
  });
});
