import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: {
    ...process.env,
    BUGFENDER_API_TOKEN: "stdio-regression-token",
    BUGFENDER_API_URL: "https://api.invalid",
  },
  stderr: "pipe",
});
const client = new Client({ name: "bugfender-stdio-regression", version: "1.0.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  for (const requiredTool of ["who_am_i", "list_apps", "update_issue_status"]) {
    if (!tools.tools.some((tool) => tool.name === requiredTool)) {
      throw new Error(`Stdio MCP is missing ${requiredTool}`);
    }
  }
  console.log("Stdio initialization and tool discovery passed.");
} finally {
  await client.close();
}
