import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";

export function registerIssueResource(server: McpServer, context: ServerContext): void {
  server.resource(
    "issue",
    new ResourceTemplate("bugfender://issue/{issue_id}?app_id={app_id}", { list: undefined }),
    async (uri, variables) => {
      const appId = String(variables.app_id);
      const issueId = String(variables.issue_id);
      const issue = await context.client.get(`/app/${appId}/issues-aggregation/${issueId}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Bugfender Issue Group\n\n${JSON.stringify(issue, null, 2)}`,
          },
        ],
      };
    },
  );
}
