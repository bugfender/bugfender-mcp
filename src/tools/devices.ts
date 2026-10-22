import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { readOnlyOAuthMetadata, readOnlyToolAnnotations, toolEnvelopeSchema } from "../tool-metadata.js";
import { clampPageSize } from "../utils/pagination.js";

const DEVICE_ORDER = {
  last_active: "seen",
  name_asc: "nameaz",
  name_desc: "nameza",
} as const;

type DeviceFilters = {
  name?: string;
  model?: string;
  os_name?: string;
  os_version?: string;
  current_app_version?: string | number;
  device_key_values?: string;
  enabled?: boolean;
};

export function deviceQuery(
  filters: DeviceFilters & {
    order?: keyof typeof DEVICE_ORDER;
    page_size?: number;
    next_cursor?: string;
  },
): Record<string, unknown> {
  return {
    device_name: filters.name,
    device_model: filters.model,
    os_name: filters.os_name,
    os_version: filters.os_version,
    version: filters.current_app_version,
    device_key_values: filters.device_key_values,
    device_status: filters.enabled === undefined ? undefined : Number(filters.enabled),
    order: DEVICE_ORDER[filters.order ?? "last_active"],
    format: "json",
    page_size: clampPageSize(filters.page_size),
    next_cursor: filters.next_cursor,
  };
}

export function registerDeviceTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "search_devices",
    {
      title: "Search App Devices",
      description: "Searches devices observed by a Bugfender app using device, platform, version, and custom-data filters.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        name: z.string().optional().describe("Filter by device name. Use * as suffix wildcard (e.g. iPhone*)"),
        model: z.string().optional().describe("Filter by device model."),
        os_name: z.string().optional().describe("Filter by operating system name (e.g. iOS, Android)."),
        os_version: z.string().optional().describe("Filter by OS version string."),
        current_app_version: z.union([z.string(), z.number().int()]).optional().describe("Filter by app version ID returned by list_app_versions."),
        device_key_values: z.string().optional().describe("Filter by custom device data (for example, tier=pro)."),
        enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
        order: z.enum(["last_active", "name_asc", "name_desc"]).optional().default("last_active").describe("Sort order. Defaults to last_active."),
        page_size: z.number().int().positive().optional().describe("Number of devices to return, capped by the server maximum."),
        next_cursor: z.string().optional().describe("Cursor for next page, from pagination.next_cursor in previous response."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, ...filters }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{ devices?: unknown[]; next_cursor?: string }>(
          `/app/${app_id}/devices`,
          deviceQuery(filters),
        );
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
        name: z.string().optional().describe("Filter by device name."),
        model: z.string().optional().describe("Filter by device model."),
        os_name: z.string().optional().describe("Filter by operating system name."),
        os_version: z.string().optional().describe("Filter by OS version string."),
        current_app_version: z.union([z.string(), z.number().int()]).optional().describe("Filter by app version ID returned by list_app_versions."),
        device_key_values: z.string().optional().describe("Filter by custom device data (for example, tier=pro)."),
        enabled: z.boolean().optional().describe("Filter by enabled (true) or disabled (false) devices."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, ...filters }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{ total_count?: number }>(
          `/app/${app_id}/devices`,
          deviceQuery({ ...filters, page_size: 1 }),
        );
        if (typeof result.total_count !== "number") {
          throw new Error("Bugfender API device response did not include total_count");
        }
        return ok(result.total_count);
      }),
  );
}
