import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sdkSnippet } from "../domain/snippets.js";
import { asToolResult, ok, toolError } from "../envelope.js";
import type { ServerContext } from "../server-context.js";

export function registerAppTools(server: McpServer, context: ServerContext): void {
  server.tool("list_apps", {}, async () => {
    try {
      return asToolResult(ok(await context.client.get("/app/")));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });

  server.tool("get_app", { app_id: z.string() }, async ({ app_id }) => {
    try {
      return asToolResult(ok(await context.client.get(`/app/${app_id}`)));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });

  server.tool("list_app_versions", { app_id: z.string() }, async ({ app_id }) => {
    try {
      return asToolResult(ok(await context.client.get(`/app/${app_id}/versions`)));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });

  server.tool(
    "get_sdk_snippet",
    {
      app_id: z.string(),
      platform: z.enum(["ios", "android", "web", "flutter"]),
    },
    async ({ app_id, platform }) => {
      try {
        const app = await context.client.get<{ key: string }>(`/app/${app_id}`);
        return asToolResult(ok({ platform, snippet: sdkSnippet(platform, app.key) }));
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );

  server.tool(
    "get_app_summary",
    {
      app_id: z.string(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
    },
    async ({ app_id, date_range_start }) => {
      try {
        const date = (date_range_start ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
        return asToolResult(ok(await context.client.get(`/app/${app_id}/daily-summary`, { date })));
      } catch (error) {
        return asToolResult(toolError(error, context.client.hasToken));
      }
    },
  );
}
