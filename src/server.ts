import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BugfenderClient } from "./client.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { addOAuthSecurityToToolRegistrations } from "./oauth.js";
import { registerResources } from "./resources/index.js";
import type { ServerContext } from "./server-context.js";
import { registerTools } from "./tools/index.js";
import type { RuntimeConfig } from "./types.js";

export type BugfenderServer = {
  context: ServerContext;
  server: McpServer;
};

export function createBugfenderServer(config: RuntimeConfig): BugfenderServer {
  const context: ServerContext = {
    client: new BugfenderClient(config),
    config,
  };
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  addOAuthSecurityToToolRegistrations(server);
  registerTools(server, context);
  registerResources(server, context);

  return { context, server };
}
