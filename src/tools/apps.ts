import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sdkSnippet } from "../domain/snippets.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";

export function registerAppTools(server: McpServer, context: ServerContext): void {
  server.tool("list_apps", {}, () =>
    handleTool(context, async () => ok(await context.client.get("/app/"))),
  );

  server.tool("get_app", { app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps") }, ({ app_id }) =>
    handleTool(context, async () => ok(await context.client.get(`/app/${app_id}`))),
  );

  server.tool("list_app_versions", { app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps") }, ({ app_id }) =>
    handleTool(context, async () => ok(await context.client.get(`/app/${app_id}/versions`))),
  );

  server.tool(
    "get_sdk_snippet",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      platform: z.enum(["ios", "android", "web", "flutter"]),
    },
    ({ app_id, platform }) =>
      handleTool(context, async () => {
        const app = await context.client.get<{ key: string }>(`/app/${app_id}`);
        return ok({ platform, snippet: sdkSnippet(platform, app.key) });
      }),
  );

  server.tool(
    "get_app_summary",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string().optional().describe("The date to summarize, as YYYY-MM-DD or ISO 8601. Returns stats for that single day only — not a range. Defaults to yesterday."),
    },
    ({ app_id, date_range_start }) =>
      handleTool(context, async () => {
        const date = (date_range_start ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
        return ok(await context.client.get(`/app/${app_id}/daily-summary`, { date }));
      }),
  );
}
