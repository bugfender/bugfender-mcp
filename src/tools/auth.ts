import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asToolResult, ok, toolError } from "../envelope.js";
import type { ServerContext } from "../server-context.js";

export function registerAuthTools(server: McpServer, context: ServerContext): void {
  server.tool("who_am_i", {}, async () => {
    try {
      return asToolResult(ok(await context.client.get("/me")));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });

  server.tool("list_teams", {}, async () => {
    try {
      const me = await context.client.get<{ teams?: unknown[] }>("/me");
      return asToolResult(ok(me.teams ?? []));
    } catch (error) {
      return asToolResult(toolError(error, context.client.hasToken));
    }
  });
}
