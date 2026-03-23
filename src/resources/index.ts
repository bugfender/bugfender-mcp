import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
import { registerIssueResource } from "./issues.js";
import { registerLogResource } from "./logs.js";
import { registerSnippetResource } from "./snippets.js";

export function registerResources(server: McpServer, context: ServerContext): void {
  registerSnippetResource(server, context);
  registerIssueResource(server, context);
  registerLogResource(server, context);
}
