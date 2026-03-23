import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asToolResult, ok, toolError } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";
import { clampPageSize } from "../utils/pagination.js";

export function registerLogTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "search_logs",
    {
      app_id: z.string(),
      text: z.string().optional(),
      device_udid: z.string().optional(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
      page_size: z.number().int().positive().optional(),
      cursor: z.string().optional(),
      level: z.number().int().optional(),
      tags: z.array(z.string()).optional(),
      app_version: z.number().int().optional(),
    },
    async (args) => {
      try {
        const { app_id, date_range_start, date_range_end, page_size, ...filters } = args;
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

        return asToolResult(
          ok(result.data ?? result, {
            previous: result.previous,
            next: result.next,
            last: result.last,
            query_id: result.query_id,
          }),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "count_logs",
    {
      app_id: z.string(),
      text: z.string().optional(),
      device_udid: z.string().optional(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
      level: z.number().int().optional(),
      tags: z.array(z.string()).optional(),
      app_version: z.number().int().optional(),
    },
    async (args) => {
      try {
        const { app_id, date_range_start, date_range_end, ...filters } = args;
        return asToolResult(
          ok(
            await context.client.get(`/app/${app_id}/logs/count`, {
              ...filters,
              date_range_start: normalizeStartDate(date_range_start),
              date_range_end: normalizeEndDate(date_range_end),
            }),
          ),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "count_devices_with_logs",
    {
      app_id: z.string(),
      text: z.string(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
    },
    async (args) => {
      try {
        const { app_id, date_range_start, date_range_end, ...filters } = args;
        return asToolResult(
          ok(
            await context.client.get(`/app/${app_id}/logs/count-devices`, {
              ...filters,
              date_range_start: normalizeStartDate(date_range_start),
              date_range_end: normalizeEndDate(date_range_end),
            }),
          ),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );
}
