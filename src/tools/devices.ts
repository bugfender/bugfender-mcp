import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { toDeviceCountQuery, toDeviceSearchQuery } from "../utils/devices-query.js";

export function registerDeviceTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "search_devices",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      device_id: z.string().optional().describe("Filter by device UID/UDID. Use * as a suffix wildcard for a prefix match."),
      name: z.string().optional().describe("Prefix match on device name. Use * as a suffix wildcard (e.g. iPhone*). Not a substring match."),
      model: z.string().optional().describe("Filter by device model."),
      os_name: z.string().optional().describe("Filter by operating system name (e.g. iOS, Android)."),
      os_version: z.string().optional().describe("Filter by OS version string."),
      current_app_version: z.number().int().positive().optional().describe("Filter by integer app-version ID from list_app_versions."),
      enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
      order: z
        .enum(["last_active", "name_asc", "name_desc"])
        .optional()
        .default("last_active")
        .describe("Sort order. last_active is most recently seen; name_asc/name_desc sort by device name. Defaults to last_active."),
      page_size: z.number().int().positive().optional().describe("Results per page. Max 100 (Bugfender devices API limit). Default 100."),
      next_cursor: z.string().optional().describe("Cursor for next page, from pagination.next_cursor in previous response."),
    },
    ({ app_id, page_size, ...filters }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{ devices?: unknown[]; next_cursor?: string }>(
          `/app/${app_id}/devices`,
          toDeviceSearchQuery(filters, page_size),
        );
        return ok(result.devices ?? result, { next_cursor: result.next_cursor });
      }),
  );

  server.tool(
    "count_devices",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string().optional().describe("ISO 8601 datetime. Count devices active from this date."),
      date_range_end: z.string().optional().describe("ISO 8601 datetime. Count devices active up to this date."),
      name: z.string().optional().describe("Filter by device name."),
      model: z.string().optional().describe("Filter by device model."),
      os_name: z.string().optional().describe("Filter by operating system name."),
      os_version: z.string().optional().describe("Filter by OS version string."),
      enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
    },
    ({ app_id, ...filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/devices/count`, toDeviceCountQuery(filters)),
        ),
      ),
  );
}
