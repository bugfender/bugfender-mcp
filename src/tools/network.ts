import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

function clampSamplePageSize(value?: number): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  if (value <= 0) {
    return undefined;
  }
  return Math.min(value, 100);
}

export function registerNetworkTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "get_network_aggregates",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z)."),
      date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)."),
      device_udid: z.string().optional().describe("Filter network requests to a specific device UDID."),
      app_version: z.string().optional().describe("Filter by app version string."),
      os: z.string().optional().describe("Filter by operating system name (e.g. iOS, Android)."),
      os_version: z.string().optional().describe("Filter by operating system version."),
      domain_search: z.string().optional().describe("Filter by domain text. Partial matches are supported."),
    },
    ({ app_id, date_range_start, date_range_end, ...filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/network/aggregates`, {
            ...filters,
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
          }),
        ),
      ),
  );

  server.tool(
    "get_network_details",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      domain: z.string().describe("Domain to inspect (e.g. api.example.com)."),
      endpoint: z.string().optional().describe("Endpoint path to inspect. Defaults to '/' when omitted."),
      date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z)."),
      date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)."),
      device_udid: z.string().optional().describe("Filter network requests to a specific device UDID."),
      app_version: z.string().optional().describe("Filter by app version string."),
      os: z.string().optional().describe("Filter by operating system name (e.g. iOS, Android)."),
      os_version: z.string().optional().describe("Filter by operating system version."),
      sample_page: z.number().int().positive().optional().describe("1-based page number for sample requests."),
      sample_page_size: z.number().int().positive().optional().describe("Page size for sample requests. Max 100."),
    },
    ({ app_id, date_range_start, date_range_end, sample_page_size, ...filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/network/details`, {
            ...filters,
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
            sample_page_size: clampSamplePageSize(sample_page_size),
          }),
        ),
      ),
  );
}
