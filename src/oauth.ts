import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";

export const MCP_READ_SCOPE = "mcp:read";
export const MCP_ISSUES_WRITE_SCOPE = "mcp:issues:write";

export function oauthSecurityMetadata(scopes: readonly string[]): Record<string, unknown> {
  return {
    securitySchemes: [{ type: "oauth2", scopes: [...scopes] }],
  };
}

export function oauthChallenge(
  protectedResourceMetadataUrl: string,
  scopes: readonly string[],
  error?: "invalid_token" | "insufficient_scope",
): string {
  const parameters = [
    `resource_metadata="${protectedResourceMetadataUrl}"`,
    `scope="${scopes.join(" ")}"`,
  ];
  if (error) {
    parameters.push(`error="${error}"`);
  }
  return `Bearer ${parameters.join(", ")}`;
}

export function addOAuthSecurityToToolRegistrations(server: McpServer): void {
  const registerTool = server.tool.bind(server);
  server.tool = ((...args: unknown[]): RegisteredTool => {
    const registered = Reflect.apply(registerTool, server, args) as RegisteredTool;
    const toolName = args[0];
    const scopes = toolName === "update_issue_status"
      ? [MCP_ISSUES_WRITE_SCOPE]
      : [MCP_READ_SCOPE];
    registered.update({ _meta: oauthSecurityMetadata(scopes) });
    return registered;
  }) as typeof server.tool;
}
