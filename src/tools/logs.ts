import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";
import { clampPageSize } from "../utils/pagination.js";

export const searchLogsSchema = {
  app_id: z
    .string()
    .describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
  text: z.string().optional().describe("Full-text search across log messages."),
  device_udid: z.string().optional().describe("Filter to a specific device by its UDID from search_devices."),
  date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z). Date-only strings like 2026-04-28 are also accepted."),
  date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z). Date-only strings like 2026-04-28 are also accepted."),
  page_size: z.number().int().positive().optional().describe("Number of results per page. Defaults to 100, max 200. Use smaller values (e.g. 25) to avoid truncation."),
  cursor: z.string().optional().describe("Pagination cursor from pagination.next in a previous response."),
  level: z
    .number()
    .int()
    .optional()
    .describe("Filter by log level. 0=Debug, 1=Warning, 2=Error, 3=Trace, 4=Info, 5=Fatal"),
  tags: z.array(z.string()).optional().describe("Filter by log tags (e.g. [\"ERROR\", \"NETWORK\"]). Tags are user-defined string labels."),
  app_version: z.number().int().optional().describe("Filter by app version ID (integer). Get version IDs from list_app_versions."),
};

export function registerLogTools(
  server: McpServer,
  context: ServerContext,
): void {
  server.tool("search_logs", searchLogsSchema, (args) =>
    handleTool(context, async () => {
      const {
        app_id,
        date_range_start,
        date_range_end,
        page_size,
        ...filters
      } = args;
      const result = await context.client.get<{
        data?: unknown[];
        previous?: string;
        next?: string;
        last?: string;
        query_id?: string;
      }>(`/app/${app_id}/logs/paginated`, {
        ...filters,
        page_size: clampPageSize(page_size),
        date_range_start: normalizeStartDate(date_range_start),
        date_range_end: normalizeEndDate(date_range_end),
      });

      return ok(result.data ?? result, {
        previous: result.previous,
        next: result.next,
        last: result.last,
        query_id: result.query_id,
      });
    }),
  );

  server.tool(
    "count_logs",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      text: z.string().optional().describe("Full-text search across log messages."),
      device_udid: z.string().optional().describe("Filter to a specific device by its UDID."),
      date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z)."),
      date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)."),
      level: z.number().int().optional().describe("Filter by log level. 0=Debug, 1=Warning, 2=Error, 3=Trace, 4=Info, 5=Fatal"),
      tags: z.array(z.string()).optional().describe("Filter by log tags (e.g. [\"ERROR\", \"NETWORK\"])."),
      app_version: z.number().int().optional().describe("Filter by app version ID from list_app_versions."),
    },
    (args) =>
      handleTool(context, async () => {
        const { app_id, date_range_start, date_range_end, ...filters } = args;
        return ok(
          await context.client.get(`/app/${app_id}/logs/count`, {
            ...filters,
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
          }),
        );
      }),
  );

  server.tool(
    "count_devices_with_logs",
    {
      app_id: z
        .string()
        .describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      text: z.string(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
    },
    (args) =>
      handleTool(context, async () => {
        const { app_id, date_range_start, date_range_end, ...filters } = args;
        return ok(
          await context.client.get(`/app/${app_id}/logs/count-devices`, {
            ...filters,
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
          }),
        );
      }),
  );
}
