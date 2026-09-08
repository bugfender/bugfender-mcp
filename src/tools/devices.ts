import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { readOnlyOAuthMetadata, readOnlyToolAnnotations, toolEnvelopeSchema } from "../tool-metadata.js";
import { clampPageSize } from "../utils/pagination.js";

export function registerDeviceTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "search_devices",
    {
      title: "Search App Devices",
      description: "Searches devices observed by a Bugfender app using activity, platform, version, and log filters.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        date_range_start: z.string().optional().describe("ISO 8601 datetime. Filter devices active from this date."),
        date_range_end: z.string().optional().describe("ISO 8601 datetime. Filter devices active up to this date."),
        name: z.string().optional().describe("Filter by device name. Use * as suffix wildcard (e.g. iPhone*)"),
        model: z.string().optional().describe("Filter by device model."),
        os_name: z.string().optional().describe("Filter by operating system name (e.g. iOS, Android)."),
        os_version: z.string().optional().describe("Filter by OS version string."),
        current_app_version: z.string().optional().describe("Filter devices currently running this app version."),
        log_text: z.string().optional().describe("Filter devices that have logs matching this text."),
        log_level: z.number().int().optional().describe("Filter devices that have logs at this level. 0=Debug, 1=Warning, 2=Error, 3=Trace, 4=Info, 5=Fatal"),
        enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
        order: z.enum(["last_active", "name_asc", "name_desc"]).optional().default("last_active").describe("Sort order. Defaults to last_active."),
        page_size: z.number().int().positive().optional().describe("Number of devices to return, capped by the server maximum."),
        next_cursor: z.string().optional().describe("Cursor for next page, from pagination.next_cursor in previous response."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, page_size, ...filters }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{ devices?: unknown[]; next_cursor?: string }>(`/app/${app_id}/devices`, {
          ...filters,
          format: "json",
          page_size: clampPageSize(page_size),
        });
        return ok(result.devices ?? result, { next_cursor: result.next_cursor });
      }),
  );

  server.registerTool(
    "count_devices",
    {
      title: "Count App Devices",
      description: "Counts devices observed by a Bugfender app that match the supplied filters.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        date_range_start: z.string().optional().describe("ISO 8601 datetime. Count devices active from this date."),
        date_range_end: z.string().optional().describe("ISO 8601 datetime. Count devices active up to this date."),
        name: z.string().optional().describe("Filter by device name."),
        model: z.string().optional().describe("Filter by device model."),
        os_name: z.string().optional().describe("Filter by operating system name."),
        os_version: z.string().optional().describe("Filter by OS version string."),
        enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, ...filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/devices/count`, {
            ...filters,
          }),
        ),
      ),
  );
}
