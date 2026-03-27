import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { clampPageSize } from "../utils/pagination.js";

export function registerDeviceTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "search_devices",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      page_size: z.number().int().positive().optional(),
      next_cursor: z.string().optional(),
    },
    ({ app_id, filters, page_size, next_cursor }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{ devices?: unknown[]; next_cursor?: string }>(`/app/${app_id}/devices`, {
          ...filters,
          format: "json",
          page_size: clampPageSize(page_size),
          next_cursor,
        });
        return ok(result.devices ?? result, { next_cursor: result.next_cursor });
      }),
  );

  server.tool(
    "count_devices",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    },
    ({ app_id, filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/devices/count`, {
            ...filters,
          }),
        ),
      ),
  );
}
