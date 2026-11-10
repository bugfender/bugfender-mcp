import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalizeCurrentUser } from "../domain/public-responses.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import {
  omitCredentials,
  readOnlyOAuthMetadata,
  readOnlyToolAnnotations,
  toolEnvelopeSchema,
  toolEnvelopeWithDataSchema,
} from "../tool-metadata.js";

const currentUserSchema = z.object({
  public_id: z.string().optional().describe("Public identifier for the connected Bugfender user."),
  name: z.string().optional().describe("Display name of the connected user."),
  email: z.string().optional().describe("Email address of the connected user."),
  teams: z.array(z.object({
    name: z.string().optional().describe("Bugfender team name."),
    role: z.string().optional().describe("Connected user's role in this team."),
  })).describe("Teams available to the connected user."),
});

export function registerAuthTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "who_am_i",
    {
      title: "Get Current Bugfender User",
      description: "Returns the connected user's public identity and team memberships.",
      inputSchema: {},
      outputSchema: toolEnvelopeWithDataSchema(currentUserSchema),
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    () => handleTool(context, async () => ok(normalizeCurrentUser(await context.client.get("/me")))),
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
