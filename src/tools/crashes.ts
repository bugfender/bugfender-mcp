import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_PAGE_SIZE } from "../constants.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { readOnlyOAuthMetadata, readOnlyToolAnnotations, toolEnvelopeSchema } from "../tool-metadata.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

export function registerCrashTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "get_crashes",
    {
      title: "List Crash Groups",
      description: "Lists crash groups for an app and date range. Use list_issues when status filtering is required.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        limit: z.number().int().positive().optional().default(20).describe("Maximum crash groups to return; defaults to 20."),
        date_range_start: z.string().optional().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, limit = 20, date_range_start, date_range_end }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{
          data?: unknown[];
        }>(`/app/${app_id}/issues-aggregation/summary`, {
          issue_type: "1",
          date_range_start: normalizeStartDate(date_range_start),
          date_range_end: normalizeEndDate(date_range_end),
          page_size: typeof limit === "number" ? Math.min(limit, MAX_PAGE_SIZE) : MAX_PAGE_SIZE,
        });
        const crashes = (result.data ?? []).map((crash) => {
          if (typeof crash !== "object" || crash === null) return crash;
          const c = crash as Record<string, unknown>;
          if (typeof c.body === "string" && c.body.length > 300) {
            return { ...c, body: c.body.slice(0, 300) + "… (truncated, use get_crash_details for full stack trace)" };
          }
          return c;
        });
        return ok(typeof limit === "number" ? crashes.slice(0, limit) : crashes);
      }),
  );

  server.registerTool(
    "get_crash_stats",
    {
      title: "Get Crash Statistics",
      description: "Returns aggregate crash statistics for an app, date range, and optional crash filters.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        date_range_start: z.string().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
        title: z.string().optional().describe("Filter by crash title text."),
        hash: z.string().optional().describe("Filter by crash group hash."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, date_range_start, date_range_end, title, hash }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/stats`, {
            issue_type: "1",
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
            title,
            hash,
          }),
        ),
      ),
  );

  server.registerTool(
    "get_crash_device_stats",
    {
      title: "Get Crash Device Statistics",
      description: "Returns device-model and operating-system statistics for matching crash groups.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        date_range_start: z.string().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
        title: z.string().optional().describe("Filter by crash title text."),
        hash: z.string().optional().describe("Filter by crash group hash."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, date_range_start, date_range_end, title, hash }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/device-stats`, {
            issue_type: "1",
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
            title,
            hash,
          }),
        ),
      ),
  );

  server.registerTool("get_crash_details", {
    title: "Get Crash Details",
    description: "Returns full details and affected-device samples for a specific crash group.",
    inputSchema: {
      app_id: z.string().describe("Public app ID returned by list_apps."),
      hash: z.string().describe("Crash group hash returned by get_crashes or list_issues."),
    },
    outputSchema: toolEnvelopeSchema,
    annotations: readOnlyToolAnnotations,
    _meta: readOnlyOAuthMetadata,
  }, ({ app_id, hash }) =>
    handleTool(context, async () => {
      const [details, devices] = await Promise.all([
        context.client.get(`/app/${app_id}/issues-aggregation/${hash}`),
        context.client.get(`/app/${app_id}/issues-aggregation/${hash}/devices`, {
          page_size: MAX_PAGE_SIZE,
        }),
      ]);
      return ok({ details, devices });
    }),
  );
}
