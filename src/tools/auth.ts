import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import {
  omitCredentials,
  readOnlyOAuthMetadata,
  readOnlyToolAnnotations,
  toolEnvelopeSchema,
} from "../tool-metadata.js";

export function registerAuthTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "who_am_i",
    {
      title: "Get Current Bugfender User",
      description: "Returns the connected Bugfender account profile and memberships, with credentials removed.",
      inputSchema: {},
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    () => handleTool(context, async () => ok(omitCredentials(await context.client.get("/me")))),
  );

  server.registerTool(
    "list_teams",
    {
      title: "List Bugfender Teams",
      description: "Lists the Bugfender teams available to the connected account, with credentials removed.",
      inputSchema: {},
      outputSchema: toolEnvelopeSchema,
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    () =>
      handleTool(context, async () => {
        const me = await context.client.get<{ teams?: unknown[] }>("/me");
        return ok(omitCredentials(me.teams ?? []));
      }),
  );
}
