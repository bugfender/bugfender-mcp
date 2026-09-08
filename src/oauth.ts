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
