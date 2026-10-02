import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import { MCP_ISSUES_WRITE_SCOPE, oauthSecurityMetadata } from "../oauth.js";
import type { ServerContext } from "../server-context.js";
import { readOnlyOAuthMetadata, readOnlyToolAnnotations, toolEnvelopeSchema } from "../tool-metadata.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";
import { clampPageSize } from "../utils/pagination.js";

const issueTypeByName: Record<string, string> = {
  issue: "0",
  crash: "1",
  feedback: "2",
  "user feedback": "2",
};

const issueStatusByName: Record<string, number> = {
  new: 0,
  open: 1,
  in_progress: 2,
  resolved: 3,
  closed: 4,
  muted: 5,
  invalid: 6,
};

function normalizeIssueStatus(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const status = issueStatusByName[trimmed];
  if (status === undefined) {
    throw new Error(`Invalid issue status: ${value}. Use one of: ${Object.keys(issueStatusByName).join(", ")}`);
  }

  return status;
}

function normalizeIssueType(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  return issueTypeByName[trimmed];
}

function buildIssuesAggregationQuery(args: {
  type?: string;
  issue_status?: string;
  date_range_start?: string;
  date_range_end?: string;
  query?: string;
  content?: string;
  version?: number;
  page_size?: number;
  page?: number;
}) {
  return {
    issue_type: normalizeIssueType(args.type),
    status: args.issue_status,
    date_range_start: normalizeStartDate(args.date_range_start),
    date_range_end: normalizeEndDate(args.date_range_end),
    title: args.query,
    body: args.content,
    app_version: args.version,
    page_size: clampPageSize(args.page_size),
    page: args.page,
  };
}

export function registerIssueTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "list_issues",
    {
      title: "List Issue Groups",
      description: "Lists issue, crash, or feedback groups for an app with status, date, content, and version filters.",
      inputSchema: {
        app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
        type: z.string().optional().describe("Filter by type: issue, crash, feedback"),
        issue_status: z.string().optional().describe("Filter by status: new, open, in_progress, resolved, closed, muted"),
        date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z)"),
        date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)"),
        query: z.string().optional().describe("Filter by issue title text."),
        content: z.string().optional().describe("Filter by issue body/content text."),
        version: z.number().int().optional().describe("Filter by app version ID."),
        page_size: z.number().int().positive().optional().describe("Number of issue groups per page, capped by the server maximum."),
        page: z.number().int().positive().optional().describe("One-based result page to return."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    (args) =>
      handleTool(context, async () => {
        const result = await context.client.get<{
          data?: unknown[];
          out_of_retention_period?: boolean;
          pagination?: {
            current_page?: number;
            page_size?: number;
            total_items?: number;
            total_pages?: number;
            has_next_page?: boolean;
            has_prev_page?: boolean;
          };
        }>(`/app/${args.app_id}/issues-aggregation/summary`, buildIssuesAggregationQuery(args));

        return ok(result.data ?? [], {
          out_of_retention_period: result.out_of_retention_period,
          current_page: result.pagination?.current_page,
          page_size: result.pagination?.page_size,
          total_pages: result.pagination?.total_pages,
          total_items: result.pagination?.total_items,
          has_next_page: result.pagination?.has_next_page,
          has_prev_page: result.pagination?.has_prev_page,
        });
      }),
  );

  server.registerTool(
    "get_issue",
    {
      title: "Get Issue Details",
      description: "Returns full details for one issue group within an optional date range.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        issue_id: z.string().describe("Issue group hash returned by list_issues."),
        date_range_start: z.string().optional().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, issue_id, date_range_start, date_range_end }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/${issue_id}`, {
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
          }),
        ),
      ),
  );

  server.registerTool(
    "update_issue_status",
    {
      title: "Update Issue Status",
      description: "Changes an issue group's status to new, open, in progress, resolved, closed, muted, or invalid.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        issue_id: z.string().describe("Issue group hash returned by list_issues or get_issue."),
        status: z.string().describe("New status: new, open, in_progress, resolved, closed, muted, or invalid."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: true,
        destructiveHint: true,
        idempotentHint: true,
      },
      _meta: oauthSecurityMetadata([MCP_ISSUES_WRITE_SCOPE]),
    },
    ({ app_id, issue_id, status }) =>
      handleTool(context, async () => {
        await context.client.put(`/app/${app_id}/issues-aggregation/${issue_id}`, {
          status: normalizeIssueStatus(status),
        });
        return ok({ app_id, issue_id, status: status.trim().toLowerCase() });
      }, [MCP_ISSUES_WRITE_SCOPE]),
  );

  server.registerTool(
    "get_feedback",
    {
      title: "List User Feedback",
      description: "Lists user-feedback issue groups for an app and optional date range.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        date_range_start: z.string().optional().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
        page_size: z.number().int().positive().optional().describe("Number of feedback groups per page, capped by the server maximum."),
        page: z.number().int().positive().optional().describe("One-based result page to return."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, date_range_start, date_range_end, page_size, page }) =>
      handleTool(context, async () => {
        const result = await context.client.get<{
          data?: unknown[];
          out_of_retention_period?: boolean;
          pagination?: {
            current_page?: number;
            page_size?: number;
            total_items?: number;
            total_pages?: number;
            has_next_page?: boolean;
            has_prev_page?: boolean;
          };
        }>(`/app/${app_id}/issues-aggregation/summary`, {
          issue_type: "2",
          date_range_start: normalizeStartDate(date_range_start),
          date_range_end: normalizeEndDate(date_range_end),
          page_size: clampPageSize(page_size),
          page,
        });

        return ok(result.data ?? [], {
          out_of_retention_period: result.out_of_retention_period,
          current_page: result.pagination?.current_page,
          page_size: result.pagination?.page_size,
          total_pages: result.pagination?.total_pages,
          total_items: result.pagination?.total_items,
          has_next_page: result.pagination?.has_next_page,
          has_prev_page: result.pagination?.has_prev_page,
        });
      }),
  );

  server.registerTool(
    "get_issue_stats",
    {
      title: "Get Issue Statistics",
      description: "Returns aggregate statistics for issue groups matching the supplied filters.",
      inputSchema: {
        app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
        date_range_start: z.string().describe("ISO 8601 datetime string (e.g. 2026-04-21T00:00:00Z)"),
        date_range_end: z.string().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)"),
        type: z.string().optional().describe("Filter by type: issue, crash, feedback"),
        issue_status: z.string().optional().describe("Filter by status: new, open, in_progress, resolved, closed, muted"),
        query: z.string().optional().describe("Filter by issue title text."),
        content: z.string().optional().describe("Filter by issue body/content text."),
        version: z.number().int().optional().describe("Filter by app version ID."),
        hash: z.string().optional().describe("Filter to a specific issue hash."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    (args) =>
      handleTool(context, async () => {
        const { app_id, hash, ...filters } = args;
        return ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/stats`, {
            ...buildIssuesAggregationQuery(filters),
            hash,
          }),
        );
      }),
  );

  server.registerTool(
    "get_issue_device_stats",
    {
      title: "Get Issue Device Statistics",
      description: "Returns device-model and operating-system statistics for matching issue groups.",
      inputSchema: {
        app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
        date_range_start: z.string().describe("ISO 8601 datetime string (e.g. 2026-04-21T00:00:00Z)"),
        date_range_end: z.string().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)"),
        type: z.string().optional().describe("Filter by type: issue, crash, feedback"),
        issue_status: z.string().optional().describe("Filter by status: new, open, in_progress, resolved, closed, muted"),
        query: z.string().optional().describe("Filter by issue title text."),
        content: z.string().optional().describe("Filter by issue body/content text."),
        version: z.number().int().optional().describe("Filter by app version ID."),
        hash: z.string().optional().describe("Filter to a specific issue hash."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    (args) =>
      handleTool(context, async () => {
        const { app_id, hash, ...filters } = args;
        return ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/device-stats`, {
            ...buildIssuesAggregationQuery(filters),
            hash,
          }),
        );
      }),
  );

  server.registerTool(
    "get_issue_devices",
    {
      title: "List Devices Affected by an Issue",
      description: "Lists devices affected by one issue group with date, device, OS, version, sorting, and pagination filters.",
      inputSchema: {
        app_id: z.string().describe("Public app ID returned by list_apps."),
        hash: z.string().describe("Issue group hash returned by list_issues or get_issue."),
        date_range_start: z.string().optional().describe("Inclusive start as an ISO 8601 datetime."),
        date_range_end: z.string().optional().describe("Inclusive end as an ISO 8601 datetime."),
        device_model: z.string().optional().describe("Filter by device model."),
        device_udid: z.string().optional().describe("Filter by device UDID returned by search_devices."),
        os_version: z.string().optional().describe("Filter by operating-system version."),
        device_name: z.string().optional().describe("Filter by device name."),
        app_version: z.string().optional().describe("Filter by app version."),
        order: z.string().optional().describe("Sort expression supported by the Bugfender API."),
        page_size: z.number().int().positive().optional().describe("Number of devices per page, capped by the server maximum."),
        page: z.number().int().positive().optional().describe("One-based result page to return."),
      },
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    ({ app_id, hash, date_range_start, date_range_end, page_size, ...filters }) =>
      handleTool(context, async () =>
        ok(
          await context.client.get(`/app/${app_id}/issues-aggregation/${hash}/devices`, {
            ...filters,
            date_range_start: normalizeStartDate(date_range_start),
            date_range_end: normalizeEndDate(date_range_end),
            page_size: clampPageSize(page_size),
          }),
        ),
      ),
  );
}
