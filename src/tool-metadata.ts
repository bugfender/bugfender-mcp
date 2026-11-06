import { z } from "zod";
import { MCP_READ_SCOPE, oauthSecurityMetadata } from "./oauth.js";

const warningSchema = z.object({
  code: z.string().describe("Stable machine-readable warning code."),
  message: z.string().describe("Human-readable warning message."),
});

export const toolEnvelopeSchema = z.object({
  ok: z.boolean().describe("True on success and false on failure."),
  data: z.unknown().optional().describe("Tool-specific result data, present when ok is true."),
  pagination: z.record(z.string(), z.unknown()).optional().describe("Pagination state for retrieving more results."),
  warnings: z.array(warningSchema).optional().describe("Non-fatal warnings about the result."),
  error: z.object({
    code: z.string().describe("Stable machine-readable error code."),
    message: z.string().describe("Safe human-readable error message."),
    hint: z.string().optional().describe("Optional recovery guidance that does not expose credentials."),
  }).optional().describe("Error details, present when ok is false."),
});

export const readOnlyToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
  destructiveHint: false,
} as const;

export const readOnlyOAuthMetadata = oauthSecurityMetadata([MCP_READ_SCOPE]);

const sensitiveResponseFields = new Set([
  "accesstoken",
  "access_token",
  "apikey",
  "api_token",
  "appkey",
  "auth_token",
  "authorization",
  "bearer_token",
  "clientsecret",
  "client_secret",
  "cookie",
  "key",
  "password",
  "private_key",
  "refreshtoken",
  "refresh_token",
  "set-cookie",
  "secret",
  "session_token",
  "token",
  "x-api-key",
]);

function isSensitiveField(key: string): boolean {
  return sensitiveResponseFields.has(key.toLowerCase());
}

function redactSensitiveUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }
  let changed = false;
  for (const key of [...parsed.searchParams.keys()]) {
    if (isSensitiveField(key)) {
      parsed.searchParams.set(key, "[REDACTED]");
      changed = true;
    }
  }
  return changed ? parsed.toString() : value;
}

/** Removes credentials from broad account/application responses before they reach an MCP client. */
export function omitCredentials(value: unknown, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((child) => omitCredentials(child, parentKey));
  }
  if (typeof value !== "object" || value === null) {
    if (typeof value === "string" && ["url", "uri"].some((suffix) => parentKey.toLowerCase().endsWith(suffix))) {
      return redactSensitiveUrl(value);
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      isSensitiveField(key) ? [] : [[key, omitCredentials(child, key)]],
    ),
  );
}
