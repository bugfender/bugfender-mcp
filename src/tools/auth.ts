import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalizeCurrentUser, normalizeTeams } from "../domain/public-responses.js";
import { handleTool, ok } from "../envelope.js";
import type { ServerContext } from "../server-context.js";
import {
  readOnlyOAuthMetadata,
  readOnlyToolAnnotations,
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

const teamSchema = z.object({
  name: z.string().optional().describe("Bugfender team name."),
  role: z.string().optional().describe("Connected user's team-level role; omitted for app-specific access."),
  active: z.boolean().optional().describe("Whether the team is active."),
  app_count: z.number().int().nonnegative().describe("Number of apps visible in this team."),
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
      description: "Lists accessible teams with the connected user's role and visible app count.",
      inputSchema: {},
      outputSchema: toolEnvelopeWithDataSchema(z.array(teamSchema)),
      annotations: readOnlyToolAnnotations,
      _meta: readOnlyOAuthMetadata,
    },
    () =>
      handleTool(context, async () => {
        const me = await context.client.get<{ id?: unknown; teams?: unknown[] }>("/me");
        return ok(normalizeTeams(me.teams ?? [], me.id));
      }),
  );
}
