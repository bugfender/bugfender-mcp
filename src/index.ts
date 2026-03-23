#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BugfenderClient } from "./client.js";
import { loadConfig } from "./config.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerResources } from "./resources/index.js";
import type { ServerContext } from "./server-context.js";
import { registerTools } from "./tools/index.js";

const config = loadConfig();
const context: ServerContext = {
  client: new BugfenderClient(config),
  config,
};

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

registerTools(server, context);
registerResources(server, context);

const transport = new StdioServerTransport();
await server.connect(transport);
