import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server-context.js";
import { registerAppTools } from "./apps.js";
import { registerAuthTools } from "./auth.js";
import { registerCrashTools } from "./crashes.js";
import { registerDeviceTools } from "./devices.js";
import { registerIssueTools } from "./issues.js";
import { registerLogTools } from "./logs.js";

export function registerTools(server: McpServer, context: ServerContext): void {
  registerAuthTools(server, context);
  registerAppTools(server, context);
  registerCrashTools(server, context);
  registerLogTools(server, context);
  registerDeviceTools(server, context);
  registerIssueTools(server, context);
}
