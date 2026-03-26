import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asToolResult, ok, toolError } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { clampPageSize } from "../utils/pagination.js";

export function registerDeviceTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "search_devices",
    {
      app_id: z.string(),
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      page_size: z.number().int().positive().optional(),
      next_cursor: z.string().optional(),
    },
    async ({ app_id, filters, page_size, next_cursor }) => {
      try {
        const result = await context.client.get<{ devices?: unknown[]; next_cursor?: string }>(`/app/${app_id}/devices`, {
          ...filters,
          format: "json",
          page_size: clampPageSize(page_size),
          next_cursor,
        });
        return asToolResult(ok(result.devices ?? result, { next_cursor: result.next_cursor }));
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "count_devices",
    {
      app_id: z.string(),
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    },
    async ({ app_id, filters }) => {
      try {
        return asToolResult(
          ok(
            await context.client.get(`/app/${app_id}/devices/count`, {
              ...filters,
            }),
          ),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );
}
