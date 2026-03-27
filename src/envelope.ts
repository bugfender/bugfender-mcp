import { MAX_RESPONSE_BYTES } from "./constants.js";
import { BugfenderApiError } from "./errors.js";
import type { ServerContext } from "./server-context.js";
import type { Envelope, Warning } from "./types.js";

export function ok(data: unknown, pagination?: Record<string, unknown>, warnings?: Warning[]): Envelope {
  return { ok: true, data, pagination, warnings };
}

export function authHint(hasToken: boolean, status?: number): string {
  if (!hasToken) {
    return "Open Bugfender MCP Setup and copy a new config with BUGFENDER_API_TOKEN and BUGFENDER_REFRESH_TOKEN.";
  }
  if (status === 401 || status === 403) {
    return "Open Bugfender MCP Setup, copy a new config, and update BUGFENDER_API_TOKEN and BUGFENDER_REFRESH_TOKEN.";
  }
  return "Check your Bugfender token and app/team permissions.";
}

export function toolError(error: unknown, hasToken: boolean): Envelope {
  if (error instanceof BugfenderApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : null;
    const errorCode = body && "code" in body ? String(body.code) : undefined;
    const message =
      body && "message" in body
        ? String(body.message)
        : error.message;
    const hint =
      errorCode === "refresh_expired"
        ? "Your Bugfender MCP session can no longer refresh automatically. Open Bugfender MCP Setup, generate a fresh config, and replace both BUGFENDER_API_TOKEN and BUGFENDER_REFRESH_TOKEN in your IDE."
        : authHint(hasToken, error.status);

    return {
      ok: false,
      error: {
        code:
          errorCode === "refresh_expired"
            ? "token_expired"
            : error.status === 401 || error.status === 403
              ? "unauthorized"
              : error.status === 409
                ? "email_taken"
                : "api_error",
        message,
        hint,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "api_error",
      message: error instanceof Error ? error.message : "Unknown Bugfender error",
      hint: authHint(hasToken),
    },
  };
}

export function serializeEnvelope(envelope: Envelope): Envelope {
  const json = JSON.stringify(envelope);
  if (Buffer.byteLength(json, "utf8") <= MAX_RESPONSE_BYTES || !envelope.ok) {
    return envelope;
  }

  return {
    ok: true,
    data: { truncated: true },
    pagination: envelope.pagination,
    warnings: [...(envelope.warnings ?? []), { code: "truncated", message: "Response exceeded 512 KB and was truncated." }],
  };
}

export async function handleTool(context: ServerContext, fn: () => Promise<Envelope>) {
  try {
    return asToolResult(await fn());
  } catch (error) {
    return asToolResult(toolError(error, context.client.hasToken));
  }
}

export function asToolResult(envelope: Envelope) {
  const serialized = serializeEnvelope(envelope);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(serialized, null, 2) }],
    structuredContent: serialized,
  };
}
