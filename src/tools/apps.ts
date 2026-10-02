import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sdkSnippet } from "../domain/snippets.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import {
  omitCredentials,
  readOnlyOAuthMetadata,
  readOnlyToolAnnotations,
  toolEnvelopeSchema,
} from "../tool-metadata.js";

export function registerAppTools(server: McpServer, context: ServerContext): void {
  server.registerTool("list_apps", {
    title: "List Bugfender Apps",
    description: "Lists apps accessible to the connected Bugfender account without returning app credentials.",
    inputSchema: {},
    outputSchema: toolEnvelopeSchema,
    annotations: readOnlyToolAnnotations,
    _meta: readOnlyOAuthMetadata,
  }, () =>
    handleTool(context, async () => ok(omitCredentials(await context.client.get("/app/")))),
  );

  server.registerTool("get_app", {
    title: "Get Bugfender App",
    description: "Returns configuration and summary details for one Bugfender app without returning its app key.",
    inputSchema: { app_id: z.string().describe("Public app ID returned by list_apps (for example, 5X3c4veRGV).") },
    outputSchema: toolEnvelopeSchema,
    annotations: readOnlyToolAnnotations,
    _meta: readOnlyOAuthMetadata,
  }, ({ app_id }) =>
    handleTool(context, async () => ok(omitCredentials(await context.client.get(`/app/${app_id}`)))),
  );

  server.registerTool("list_app_versions", {
    title: "List App Versions",
    description: "Lists recorded versions for a Bugfender app for use in version-based investigation filters.",
    inputSchema: { app_id: z.string().describe("Public app ID returned by list_apps (for example, 5X3c4veRGV).") },
    outputSchema: toolEnvelopeSchema,
    annotations: readOnlyToolAnnotations,
    _meta: readOnlyOAuthMetadata,
  }, ({ app_id }) =>
    handleTool(context, async () => ok(await context.client.get(`/app/${app_id}/versions`))),
  );

  server.registerTool(
    "get_sdk_snippet",
    {
      title: "Get Bugfender SDK Snippet",
      description: "Generates the Bugfender SDK setup snippet for an app and supported platform.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps (for example, 5X3c4veRGV)."),
        platform: z.enum(["ios", "android", "web", "flutter"]).describe("Target SDK platform."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, platform }) =>
      handleTool(context, async () => {
        const app = await context.client.get<{ key: string }>(`/app/${app_id}`);
        return ok({ platform, snippet: sdkSnippet(platform, app.key) });
      }),
  );

  server.registerTool(
    "get_app_summary",
    {
      title: "Get Daily App Summary",
      description: "Returns daily activity and reliability summary metrics for one Bugfender app.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps (for example, 5X3c4veRGV)."),
        date_range_start: z.string().optional().describe("Day to summarize as YYYY-MM-DD or ISO 8601; defaults to yesterday."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, date_range_start }) =>
      handleTool(context, async () => {
        const date = (date_range_start ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
        return ok(await context.client.get(`/app/${app_id}/daily-summary`, { date }));
      }),
  );
}
