import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_PAGE_SIZE } from "../constants.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

export function registerCrashTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "get_crashes",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      limit: z.number().int().positive().optional(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
    },
    ({ app_id, limit, date_range_start, date_range_end }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{
          data?: unknown[];
        }>(`/app/${app_id}/issues-aggregation/summary`, {
          issue_type: "1",
          date_range_start: normalizeStartDate(date_range_start),
          date_range_end: normalizeEndDate(date_range_end),
          page_size: typeof limit === "number" ? Math.min(limit, MAX_PAGE_SIZE) : MAX_PAGE_SIZE,
        });
        const crashes = result.data ?? [];
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
