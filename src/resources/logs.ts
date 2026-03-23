import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_PAGE_SIZE } from "../constants.js";
import type { ServerContext } from "../server-context.js";
import { normalizeEndDate, normalizeStartDate } from "../utils/date.js";

export function registerLogResource(server: McpServer, context: ServerContext): void {
  server.resource(
    "app-logs",
    new ResourceTemplate("bugfender://app/{app_id}/logs?date_range_start={date_range_start}&date_range_end={date_range_end}", { list: undefined }),
    async (uri, variables) => {
      const logs = await context.client.get(`/app/${String(variables.app_id)}/logs/paginated`, {
        date_range_start: normalizeStartDate(String(variables.date_range_start)),
        date_range_end: normalizeEndDate(String(variables.date_range_end)),
        page_size: DEFAULT_PAGE_SIZE,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Current App Logs\n\n${JSON.stringify(logs, null, 2)}`,
          },
        ],
      };
    },
  );
}
