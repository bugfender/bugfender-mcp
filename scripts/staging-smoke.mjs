const endpoint = process.env.BUGFENDER_MCP_E2E_URL || "https://mcp-stg.bugfender.com/mcp";
const accessToken = process.env.BUGFENDER_MCP_E2E_ACCESS_TOKEN;
const appId = process.env.BUGFENDER_MCP_E2E_APP_ID;

if (!accessToken || !appId) {
  console.error("Set BUGFENDER_MCP_E2E_ACCESS_TOKEN and BUGFENDER_MCP_E2E_APP_ID before running this test.");
  process.exit(2);
}

const resource = new URL(endpoint);
resource.pathname = "";
resource.search = "";
resource.hash = "";
const resourceOrigin = resource.toString().replace(/\/$/, "");

async function expectJson(response, label) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function callMcp(id, method, params) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const body = await expectJson(response, method);
  if (body.error) {
    throw new Error(`${method} failed: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

function expectSuccessfulTool(result, name) {
  if (result?.isError || result?.structuredContent?.ok !== true) {
    throw new Error(`${name} failed: ${JSON.stringify(result?.structuredContent ?? result)}`);
  }
}

const protectedResource = await expectJson(
  await fetch(`${resourceOrigin}/.well-known/oauth-protected-resource`),
  "protected-resource discovery",
);
if (protectedResource.resource !== resourceOrigin || !protectedResource.authorization_servers?.[0]) {
  throw new Error("Protected-resource metadata does not match the staging MCP origin.");
}

const authorizationServer = await expectJson(
  await fetch(`${protectedResource.authorization_servers[0]}/.well-known/oauth-authorization-server`),
  "authorization-server discovery",
);
if (!authorizationServer.authorization_endpoint || !authorizationServer.token_endpoint) {
  throw new Error("Authorization-server metadata is incomplete.");
}

await callMcp(1, "initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "bugfender-staging-smoke", version: "1.0.0" },
});

const tools = await callMcp(2, "tools/list", {});
for (const requiredTool of ["who_am_i", "list_apps", "count_logs"]) {
  if (!tools.tools?.some((tool) => tool.name === requiredTool)) {
    throw new Error(`Staging MCP is missing ${requiredTool}.`);
  }
}

expectSuccessfulTool(await callMcp(3, "tools/call", {
  name: "who_am_i",
  arguments: {},
}), "who_am_i");
expectSuccessfulTool(await callMcp(4, "tools/call", {
  name: "list_apps",
  arguments: {},
}), "list_apps");
expectSuccessfulTool(await callMcp(5, "tools/call", {
  name: "count_logs",
  arguments: { app_id: appId },
}), "count_logs");

console.log("Staging OAuth discovery and authenticated MCP tool smoke test passed.");
