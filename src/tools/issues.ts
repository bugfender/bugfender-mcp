import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleTool, ok } from "../envelope.js";
import { MCP_ISSUES_WRITE_SCOPE } from "../oauth.js";
import type { ServerContext } from "../server-context.js";
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
  server.tool(
    "list_issues",
    "Lists issue groups for an app. Supports filtering by type (issue, crash, feedback) and status (open, resolved, closed). Use this instead of get_crashes or get_feedback when you need status filtering or combined results.",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      type: z.string().optional().describe("Filter by type: issue, crash, feedback"),
      issue_status: z.string().optional().describe("Filter by status: new, open, in_progress, resolved, closed, muted"),
      date_range_start: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T00:00:00Z)"),
      date_range_end: z.string().optional().describe("ISO 8601 datetime string (e.g. 2026-04-28T23:59:59Z)"),
      query: z.string().optional().describe("Filter by issue title text."),
      content: z.string().optional().describe("Filter by issue body/content text."),
      version: z.number().int().optional().describe("Filter by app version ID."),
      page_size: z.number().int().positive().optional(),
      page: z.number().int().positive().optional(),
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

  server.tool(
    "get_issue",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      issue_id: z.string(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
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

  server.tool(
    "update_issue_status",
    "Updates the status of an issue group (issues aggregation). Use this to mark issues as resolved, closed, in progress, etc.",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      issue_id: z.string().describe("The issue group hash from list_issues or get_issue"),
      status: z
        .string()
        .describe("New status: new, open, in_progress, resolved, closed, muted, or invalid"),
    },
    ({ app_id, issue_id, status }) =>
      handleTool(context, async () => {
        await context.client.put(`/app/${app_id}/issues-aggregation/${issue_id}`, {
          status: normalizeIssueStatus(status),
        });
        return ok({ app_id, issue_id, status: status.trim().toLowerCase() });
      }, [MCP_ISSUES_WRITE_SCOPE]),
  );

  server.tool(
    "get_feedback",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
      page_size: z.number().int().positive().optional(),
      page: z.number().int().positive().optional(),
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

  server.tool(
    "get_issue_stats",
    {
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

  server.tool(
    "get_issue_device_stats",
    {
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

  server.tool(
    "get_issue_devices",
    {
      app_id: z.string().describe("The public app ID (e.g. 5X3c4veRGV) from list_apps"),
      hash: z.string(),
      date_range_start: z.string().optional(),
      date_range_end: z.string().optional(),
      device_model: z.string().optional(),
      device_udid: z.string().optional(),
      os_version: z.string().optional(),
      device_name: z.string().optional(),
      app_version: z.string().optional(),
      order: z.string().optional(),
      page_size: z.number().int().positive().optional(),
      page: z.number().int().positive().optional(),
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
