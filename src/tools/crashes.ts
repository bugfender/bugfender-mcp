import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_PAGE_SIZE } from "../constants.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

export function registerCrashTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "get_crashes",
    "Returns a list of crash groups for an app, optionally filtered by date range. Does not support filtering by status — use list_issues with type=crash and issue_status if you need open/resolved/closed crashes only.",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      limit: z.number().int().positive().optional().default(20).describe("Max number of crashes to return. Defaults to 20."),
      date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-21T00:00:00Z)."),
      date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)."),
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

  server.tool(
    "get_crash_stats",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string(),
      date_range_end: z.string().optional(),
      title: z.string().optional(),
      hash: z.string().optional(),
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

  server.tool(
    "get_crash_device_stats",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string(),
      date_range_end: z.string().optional(),
      title: z.string().optional(),
      hash: z.string().optional(),
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

  server.tool("get_crash_details", { app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"), hash: z.string() }, ({ app_id, hash }) =>
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
