import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asToolResult, ok, toolError } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

export function registerCrashTools(server: McpServer, context: ServerContext): void {
  server.tool(
    "get_crashes",
    {
      app_id: z.string(),
      limit: z.number().int().positive().optional(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
    },
    async ({ app_id, limit, date_range_start, date_range_end }) => {
      try {
        const crashes = await context.client.get<unknown[]>(`/app/${app_id}/crash-aggregation`, {
          date_range_start: normalizeStartDate(date_range_start),
          date_range_end: normalizeEndDate(date_range_end),
        });

        return asToolResult(
          ok(typeof limit === "number" ? crashes.slice(0, limit) : crashes),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "get_crash_stats",
    {
      app_id: z.string(),
      date_range_start: z.string(),
      date_range_end: z.string().optional(),
      title: z.string().optional(),
      hash: z.string().optional(),
    },
    async ({ app_id, date_range_start, date_range_end, title, hash }) => {
      try {
        return asToolResult(
          ok(
            await context.client.get(`/app/${app_id}/crash-aggregation/crash-stats`, {
              date_range_start: normalizeStartDate(date_range_start),
              date_range_end: normalizeEndDate(date_range_end),
              title,
              hash,
            }),
          ),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "get_crash_device_stats",
    {
      app_id: z.string(),
      date_range_start: z.string(),
      date_range_end: z.string().optional(),
      title: z.string().optional(),
      hash: z.string().optional(),
    },
    async ({ app_id, date_range_start, date_range_end, title, hash }) => {
      try {
        return asToolResult(
          ok(
            await context.client.get(`/app/${app_id}/crash-aggregation/affected-devices-stats`, {
              date_range_start: normalizeStartDate(date_range_start),
              date_range_end: normalizeEndDate(date_range_end),
              title,
              hash,
            }),
          ),
        );
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool("get_crash_details", { app_id: z.string(), hash: z.string() }, async ({ app_id, hash }) => {
    try {
      const [details, devices] = await Promise.all([
        context.client.get(`/app/${app_id}/crash-aggregation/${hash}/details`),
        context.client.get(`/app/${app_id}/crash-aggregation/${hash}/devices`),
      ]);
      return asToolResult(ok({ details, devices }));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });
}
