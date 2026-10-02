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
  "access_token",
  "api_token",
  "key",
  "password",
  "refresh_token",
  "secret",
  "token",
]);

/** Removes credentials from broad account/application responses before they reach an MCP client. */
export function omitCredentials(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(omitCredentials);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      sensitiveResponseFields.has(key.toLowerCase()) ? [] : [[key, omitCredentials(child)]],
    ),
  );
}
