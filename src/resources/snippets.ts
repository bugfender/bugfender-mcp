import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sdkSnippet } from "../domain/snippets.js";
import type { ServerContext } from "../server-context.js";

export function registerSnippetResource(server: McpServer, context: ServerContext): void {
  server.resource(
    "sdk-snippet",
    new ResourceTemplate("bugfender://snippet/{app_id}/{platform}", { list: undefined }),
    async (uri, variables) => {
      const appId = String(variables.app_id);
      const platform = String(variables.platform);
      const app = await context.client.get<{ key: string }>(`/app/${appId}`);
      const text = sdkSnippet(platform, app.key);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Bugfender SDK Snippet\n\n\`\`\`\n${text}\n\`\`\``,
          },
        ],
      };
    },
  );
}
