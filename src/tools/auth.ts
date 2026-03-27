import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";

export function registerAuthTools(server: McpServer, context: ServerContext): void {
  server.tool("who_am_i", {}, () =>
    handleTool(context, async () => ok(await context.client.get("/me"))),
  );

  server.tool("list_teams", {}, () =>
    handleTool(context, async () => {
      const me = await context.client.get<{ teams?: unknown[] }>("/me");
      return ok(me.teams ?? []);
    }),
  );
}
