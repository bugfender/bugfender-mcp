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

  it("maps 409 status to conflict code", () => {
    const err = new BugfenderApiError("fail", 409, null);
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("conflict");
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

  it("does not expose API response details", () => {
    const err = new BugfenderApiError("internal route detail", 400, { message: "secret backend detail" });
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.message).toBe("Bugfender rejected the request. Check the tool arguments and try again.");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("internal route");
  });

  it("does not expose unexpected internal error details", () => {
    const err = new Error("something broke");
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.code).toBe("api_error");
    expect(result.error.message).toBe("Bugfender MCP could not complete the request.");
  });

  it("retains actionable input validation errors", () => {
    const err = new Error("Invalid issue status: unknown");
    const result = toolError(err, true) as ErrorEnvelope;
    expect(result.error.message).toBe("Invalid issue status: unknown");
  });

  it("handles non-Error values", () => {
    const result = toolError("string error", true) as ErrorEnvelope;
    expect(result.error.code).toBe("api_error");
    expect(result.error.message).toBe("Bugfender MCP could not complete the request.");
  });
});

describe("serializeEnvelope", () => {
  it("passes through small success envelopes", () => {
    const envelope: Envelope = { ok: true, data: { x: 1 } };
    expect(serializeEnvelope(envelope)).toEqual(envelope);
  });

  it("replaces oversized error envelopes with a safe bounded error", () => {
    const envelope: Envelope = {
      ok: false,
      error: { code: "api_error", message: "x".repeat(600_000) },
    };
    expect(serializeEnvelope(envelope)).toEqual({
      ok: false,
      error: {
        code: "response_too_large",
        message: "Bugfender returned an error that was too large to display safely.",
        hint: "Retry with narrower filters. If the problem persists, contact Bugfender support.",
      },
    });
  });

  it("truncates large success envelopes", () => {
    const envelope: Envelope = { ok: true, data: "x".repeat(600_000) };
    const result = serializeEnvelope(envelope) as SuccessEnvelope;
    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>).truncated).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "truncated" })]),
    );
    expect(result.warnings?.[0]?.message).toContain("smaller page or narrower filters");
  });

  it("removes credentials before serializing tool output", () => {
    const envelope: Envelope = {
      ok: true,
      data: {
        authorization: "Bearer secret",
        nested: { apiKey: "secret", value: "kept" },
        url: "https://example.com/callback?token=secret&item=kept",
      },
    };
    expect(serializeEnvelope(envelope)).toEqual({
      ok: true,
      data: {
        nested: { value: "kept" },
        url: "https://example.com/callback?token=%5BREDACTED%5D&item=kept",
      },
    });
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
    expect(result.isError).toBe(true);
  });

  it("returns OAuth linking metadata for hosted authentication errors", async () => {
    const context = {
      client: { hasToken: true },
      config: {
        hostedOAuth: {
          protectedResourceMetadataUrl: "https://mcp.test/.well-known/oauth-protected-resource",
        },
      },
    } as any;
    const result = await handleTool(context, async () => {
      throw new BugfenderApiError("secret internal detail", 403, { message: "secret body" });
    }, ["mcp:issues:write"]);

    expect(result.isError).toBe(true);
    expect(result._meta?.["mcp/www_authenticate"]).toBe(
      'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource", scope="mcp:issues:write", error="insufficient_scope"',
    );
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("BUGFENDER_API_TOKEN");
  });
});
