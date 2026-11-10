import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalizeApps, normalizeAppSummary } from "../domain/public-responses.js";
import { sdkSnippet } from "../domain/snippets.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import {
  omitCredentials,
  readOnlyOAuthMetadata,
  readOnlyToolAnnotations,
  toolEnvelopeSchema,
  toolEnvelopeWithDataSchema,
} from "../tool-metadata.js";

const appStatsSchema = z.object({
  total_devices: z.number().optional(),
  active_devices_yesterday: z.number().optional(),
  active_devices_today: z.number().optional(),
  logs_yesterday: z.number().optional(),
  logs_today: z.number().optional(),
  errors_yesterday: z.number().optional(),
  errors_today: z.number().optional(),
  open_crashes_yesterday: z.number().optional(),
  open_crashes_today: z.number().optional(),
  open_issues_yesterday: z.number().optional(),
  open_issues_today: z.number().optional(),
  open_feedback_yesterday: z.number().optional(),
  open_feedback_today: z.number().optional(),
});

const appSummarySchema = z.object({
  public_app_id: z.string().optional().describe("Public app ID used by other Bugfender tools."),
  name: z.string().optional().describe("Application name."),
  platform: z.enum(["ios", "android", "web", "flutter", "unknown"]).optional().describe("Human-readable app platform."),
  team_name: z.string().optional().describe("Name of the team that owns the app."),
  stats: appStatsSchema.optional().describe("Recent app activity and reliability counters."),
});

const dailySummaryItemSchema = z.object({
  Title: z.string().optional().describe("Sanitized diagnostic title, limited to 240 characters."),
  Count: z.number().optional(),
});

const dailyAppSummarySchema = z.object({
  App: z.string().optional(),
  ActiveDevices: z.number().optional(),
  Crashes: z.number().optional(),
  Feedback: z.number().optional(),
  Issues: z.number().optional(),
  Logs: z.number().optional(),
  Sessions: z.number().optional(),
  TopCrashes: z.array(dailySummaryItemSchema),
  TopFeedback: z.array(dailySummaryItemSchema),
  TopIssues: z.array(dailySummaryItemSchema),
});

export function registerAppTools(server: McpServer, context: ServerContext): void {
  server.registerTool("list_apps", {
    title: "List Bugfender Apps",
    description: "Lists accessible apps with public identifiers and investigation summary metrics.",
    inputSchema: {},
    outputSchema: toolEnvelopeWithDataSchema(z.array(appSummarySchema)),
    annotations: readOnlyToolAnnotations,
    _meta: readOnlyOAuthMetadata,
  }, () =>
    handleTool(context, async () => ok(normalizeApps(await context.client.get("/app/")))),
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
      description: "Generates a client-side Bugfender SDK setup snippet, including the selected app's SDK key, for a supported platform.",
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
      outputSchema: toolEnvelopeWithDataSchema(dailyAppSummarySchema),
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, date_range_start }) =>
      handleTool(context, async () => {
        const date = (date_range_start ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
        return ok(normalizeAppSummary(await context.client.get(`/app/${app_id}/daily-summary`, { date })));
      }),
  );
}
