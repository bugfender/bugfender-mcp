import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  createHostedHttpServer,
  type HostedHttpOptions,
  type HostedHttpServer,
} from "../http-server.js";

const servers: HostedHttpServer[] = [];

const expectedReadTools = [
  "count_devices",
  "count_devices_with_logs",
  "count_logs",
  "get_app",
  "get_app_summary",
  "get_crash_details",
  "get_crash_device_stats",
  "get_crash_stats",
  "get_crashes",
  "get_feedback",
  "get_issue",
  "get_issue_device_stats",
  "get_issue_devices",
  "get_issue_stats",
  "get_network_aggregates",
  "get_network_details",
  "get_sdk_snippet",
  "list_app_versions",
  "list_apps",
  "list_issues",
  "list_teams",
  "search_devices",
  "search_logs",
  "who_am_i",
] as const;

const expectedWriteTools = ["update_issue_status"] as const;

function options(): HostedHttpOptions {
  return {
    apiUrl: "https://api.test",
    host: "127.0.0.1",
    port: 0,
    maxRequestBytes: 1024 * 1024,
    maxResponseBytes: 512 * 1024,
    maxConcurrency: 10,
    requestTimeoutMs: 2_000,
    shutdownTimeoutMs: 500,
    resourceUrl: "https://mcp.test/mcp",
    authorizationServerUrl: "https://issuer.test",
    resourceDocumentationUrl: "https://docs.test/mcp",
    resourcePolicyUrl: "https://www.test/privacy",
    resourceTermsUrl: "https://www.test/terms",
  };
}

async function start(): Promise<string> {
  const hosted = createHostedHttpServer(options());
  servers.push(hosted);
  await new Promise<void>((resolve, reject) => {
    hosted.server.once("error", reject);
    hosted.server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${(hosted.server.address() as AddressInfo).port}`;
}

async function mcp(baseUrl: string, body: unknown, authorization = "Bearer claude-test-token") {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.allSettled(servers.splice(0).map((server) => server.shutdown()));
});

describe("Claude remote connector conformance", () => {
  it.each(["claude-ai", "Anthropic", "claude-code", "future-claude-surface"])(
    "initializes without authorizing by exact clientInfo.name: %s",
    async (name) => {
      const baseUrl = await start();
      const response = await mcp(baseUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name, version: "1.0.0" },
          protocolVersion: "2025-06-18",
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json() as { result?: { serverInfo?: { name?: string } } };
      expect(body.result?.serverInfo?.name).toBe("bugfender");
    },
  );

  it("discovers the complete read and write tool catalog", async () => {
    const baseUrl = await start();
    const response = await mcp(baseUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const body = await response.json() as {
      result?: { tools?: Array<{ name: string; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }> };
    };
    const tools = body.result?.tools ?? [];
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect([...byName.keys()].sort()).toEqual([...expectedReadTools, ...expectedWriteTools].sort());
    for (const name of expectedReadTools) {
      expect(byName.get(name)?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
    for (const name of expectedWriteTools) {
      expect(byName.get(name)?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
  });

  it("starts OAuth discovery with a 401 and the canonical resource metadata URL", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource", scope="mcp:read"',
    );
  });

  it("rejects malformed bearer credentials with invalid_token", async () => {
    const baseUrl = await start();
    const response = await mcp(baseUrl, {}, "Bearer invalid token with spaces");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("advertises the intended issuer first and binds discovery to the exact MCP resource", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(await response.json()).toMatchObject({
      resource: "https://mcp.test/mcp",
      authorization_servers: ["https://issuer.test"],
      scopes_supported: ["mcp:read", "mcp:issues:write"],
    });
  });

  it("keeps discovery and tool-list responses within the hosted response budget", async () => {
    const baseUrl = await start();
    const discovery = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    const tools = await mcp(baseUrl, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(Buffer.byteLength(await discovery.text())).toBeLessThan(512 * 1024);
    expect(Buffer.byteLength(await tools.text())).toBeLessThan(512 * 1024);
  });
});
