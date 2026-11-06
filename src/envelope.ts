import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MAX_TOOL_RESULT_BYTES } from "./constants.js";
import { BugfenderApiError } from "./errors.js";
import type { ServerContext } from "./server-context.js";
import type { Envelope, Warning } from "./types.js";
import { MCP_READ_SCOPE, oauthChallenge } from "./oauth.js";
import { omitCredentials } from "./tool-metadata.js";

type EnvelopeToolResult = CallToolResult & {
  structuredContent: Envelope;
};

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

function apiRecoveryHint(status: number, hasToken: boolean): string {
  if (status === 401 || status === 403) {
    return authHint(hasToken, status);
  }
  if (status === 400) {
    return "Review the documented tool inputs, especially identifiers, filters, and date formats.";
  }
  if (status === 404) {
    return "Verify the app and resource identifiers and confirm the connected account can access them.";
  }
  if (status === 409) {
    return "Read the current resource state, then retry only if the requested change is still applicable.";
  }
  if (status === 429) {
    return "Wait briefly before retrying, and reduce repeated or high-volume requests.";
  }
  return "Retry later. If the problem persists, contact Bugfender support with the operation and time of failure.";
}

export function toolError(error: unknown, hasToken: boolean): Envelope {
  if (error instanceof BugfenderApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : null;
    const errorCode = body && "code" in body ? String(body.code) : undefined;
    const message = errorCode === "refresh_expired"
      ? "Your Bugfender MCP session expired and must be reconnected."
      : error.status === 400
        ? "Bugfender rejected the request. Check the tool arguments and try again."
        : error.status === 401
          ? "Bugfender authentication is required."
          : error.status === 403
            ? "The connected Bugfender account does not have permission for this operation."
            : error.status === 404
              ? "The requested Bugfender resource was not found or is not accessible."
              : error.status === 409
                ? "The requested change conflicts with the current Bugfender state."
                : error.status === 429
                  ? "Bugfender rate limiting prevented the request. Retry after a short delay."
                  : "Bugfender could not complete the request. Try again later.";
    const hint =
      errorCode === "refresh_expired"
        ? "Your Bugfender MCP session can no longer refresh automatically. Open Bugfender MCP Setup, generate a fresh config, and replace both BUGFENDER_API_TOKEN and BUGFENDER_REFRESH_TOKEN in your IDE."
        : apiRecoveryHint(error.status, hasToken);

    return {
      ok: false,
      error: {
        code:
          errorCode === "refresh_expired"
            ? "token_expired"
            : error.status === 401 || error.status === 403
              ? "unauthorized"
              : error.status === 409
                ? "conflict"
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
      message: error instanceof Error && error.message.startsWith("Invalid ")
        ? error.message
        : "Bugfender MCP could not complete the request.",
      hint: "Check the tool inputs and retry. If the problem persists, contact Bugfender support with the operation and time of failure.",
    },
  };
}

export function serializeEnvelope(envelope: Envelope): Envelope {
  const sanitized = omitCredentials(envelope) as Envelope;
  const json = JSON.stringify(sanitized);
  if (Buffer.byteLength(json, "utf8") <= MAX_TOOL_RESULT_BYTES) {
    return sanitized;
  }

  if (!sanitized.ok) {
    return {
      ok: false,
      error: {
        code: "response_too_large",
        message: "Bugfender returned an error that was too large to display safely.",
        hint: "Retry with narrower filters. If the problem persists, contact Bugfender support.",
      },
    };
  }

  return {
    ok: true,
    data: { truncated: true },
    pagination: sanitized.pagination,
    warnings: [
      ...(sanitized.warnings ?? []),
      {
        code: "truncated",
        message: "Response exceeded 96 KB. Request a smaller page or narrower filters and try again.",
      },
    ],
  };
}

export async function handleTool(
  context: ServerContext,
  fn: () => Promise<Envelope>,
  requiredScopes: readonly string[] = [MCP_READ_SCOPE],
): Promise<EnvelopeToolResult> {
  try {
    return asToolResult(await fn());
  } catch (error) {
    if (
      context.config?.hostedOAuth
      && error instanceof BugfenderApiError
      && (error.status === 401 || error.status === 403)
    ) {
      const challenge = oauthChallenge(
        context.config.hostedOAuth.protectedResourceMetadataUrl,
        requiredScopes,
        error.status === 401 ? "invalid_token" : "insufficient_scope",
      );
      const envelope: Envelope = {
        ok: false,
        error: {
          code: error.status === 401 ? "unauthorized" : "insufficient_scope",
          message: error.status === 401 ? "Authentication required" : "Insufficient permission",
        },
      };
      return {
        ...asToolResult(envelope),
        isError: true,
        _meta: { "mcp/www_authenticate": challenge },
      };
    }
    return asToolResult(toolError(error, context.client.hasToken));
  }
}

export function asToolResult(envelope: Envelope): EnvelopeToolResult {
  const serialized = serializeEnvelope(envelope);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(serialized, null, 2) }],
    structuredContent: serialized,
    isError: !serialized.ok,
  };
}
