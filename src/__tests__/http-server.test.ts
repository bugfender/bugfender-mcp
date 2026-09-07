import type { AddressInfo } from "node:net";
import { request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHostedHttpServer,
  createHostedRuntimeConfig,
  loadHostedHttpOptions,
  type HostedHttpOptions,
  type HostedHttpServer,
} from "../http-server.js";

const servers: HostedHttpServer[] = [];

function options(overrides: Partial<HostedHttpOptions> = {}): HostedHttpOptions {
  return {
    apiUrl: "https://api.test",
    host: "127.0.0.1",
    port: 0,
    maxRequestBytes: 1024 * 1024,
    maxResponseBytes: 512 * 1024,
    maxConcurrency: 10,
    requestTimeoutMs: 2_000,
    shutdownTimeoutMs: 500,
    resourceUrl: "https://mcp.test",
    authorizationServerUrl: "https://dashboard.test",
    resourceDocumentationUrl: "https://docs.test/mcp",
    resourcePolicyUrl: "https://www.test/privacy",
    resourceTermsUrl: "https://www.test/terms",
    ...overrides,
  };
}

async function start(overrides: Partial<HostedHttpOptions> = {}): Promise<string> {
  const hosted = createHostedHttpServer(options(overrides));
  servers.push(hosted);
  await new Promise<void>((resolve, reject) => {
    hosted.server.once("error", reject);
    hosted.server.listen(0, "127.0.0.1", resolve);
  });
  const address = hosted.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.allSettled(servers.splice(0).map((hosted) => hosted.shutdown()));
});

describe("hosted HTTP server", () => {
  it("serves liveness and readiness checks without authentication", async () => {
    const baseUrl = await start();

    const health = await fetch(`${baseUrl}/healthz`);
    const readiness = await fetch(`${baseUrl}/readyz`);

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toEqual({ status: "ready" });

    const metrics = await fetch(`${baseUrl}/metrics`);
    expect(metrics.status).toBe(200);
    expect(await metrics.text()).toContain("bugfender_mcp_http_requests_total");
  });

  it("requires a bearer token on the MCP endpoint", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1, params: {} }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource", scope="mcp:read"',
    );
    const body = await response.json() as { error?: { data?: { _meta?: Record<string, string> } } };
    expect(body.error?.data?._meta?.["mcp/www_authenticate"]).toBe(
      response.headers.get("www-authenticate"),
    );
  });

  it("publishes OAuth protected-resource metadata", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      resource: "https://mcp.test",
      resource_name: "Bugfender MCP",
      authorization_servers: ["https://dashboard.test"],
      scopes_supported: ["mcp:read", "mcp:issues:write"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://docs.test/mcp",
      resource_policy_uri: "https://www.test/privacy",
      resource_tos_uri: "https://www.test/terms",
    });
  });

  it("rejects malformed authorization with an invalid-token challenge", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Basic invalid",
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource", scope="mcp:read", error="invalid_token"',
    );
  });

  it("handles MCP initialize over stateless Streamable HTTP", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer request-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
          protocolVersion: "2025-06-18",
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const body = await response.json() as { result?: { serverInfo?: { name?: string } } };
    expect(body.result?.serverInfo?.name).toBe("bugfender");
  });

  it("declares exact OAuth scopes for protected tools", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer request-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      result?: { tools?: Array<{ name: string; _meta?: Record<string, unknown> }> };
    };
    const tools = body.result?.tools ?? [];
    const readTool = tools.find((tool) => tool.name === "list_apps");
    const writeTool = tools.find((tool) => tool.name === "update_issue_status");
    expect(readTool?._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["mcp:read"] }]);
    expect(writeTool?._meta?.securitySchemes).toEqual([{ type: "oauth2", scopes: ["mcp:issues:write"] }]);
  });

  it("returns an MCP OAuth challenge when the API rejects a hosted token", async () => {
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      if (url.startsWith("https://api.test")) {
        return Promise.resolve(new Response(
          JSON.stringify({ message: "internal authentication detail" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ));
      }
      return realFetch(input, init);
    });
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer expired-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "who_am_i", arguments: {} },
      }),
    });

    const body = await response.json() as {
      result?: { isError?: boolean; content?: Array<{ text?: string }>; _meta?: Record<string, string> };
    };
    expect(body.result?.isError).toBe(true);
    expect(body.result?._meta?.["mcp/www_authenticate"]).toBe(
      'Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource", scope="mcp:read", error="invalid_token"',
    );
    expect(JSON.stringify(body)).not.toContain("internal authentication detail");
    expect(JSON.stringify(body)).not.toContain("expired-token");
  });

  it("rejects oversized requests before MCP handling", async () => {
    const baseUrl = await start({ maxRequestBytes: 32 });
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer request-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: "x".repeat(64) }),
    });

    expect(response.status).toBe(413);
  });

  it("rejects MCP responses larger than the configured limit", async () => {
    const baseUrl = await start({ maxResponseBytes: 16 });
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer request-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
          protocolVersion: "2025-06-18",
        },
      }),
    });

    expect(response.status).toBe(502);
  });

  it("enforces the concurrency limit", async () => {
    const baseUrl = await start({ maxConcurrency: 1 });
    const pending = request(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer first-token",
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    });
    pending.on("error", () => undefined);
    pending.write("{");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer second-token",
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("1");
    pending.destroy();
  });

  it("times out the complete request, including body receipt", async () => {
    const baseUrl = await start({ requestTimeoutMs: 50 });
    const status = await new Promise<number>((resolve, reject) => {
      const pending = request(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer request-token",
          "Content-Type": "application/json",
          "Transfer-Encoding": "chunked",
        },
      });
      pending.once("error", reject);
      pending.once("response", (response) => {
        response.resume();
        response.once("end", () => {
          pending.destroy();
          resolve(response.statusCode || 0);
        });
      });
      pending.write("{");
    });

    expect(status).toBe(504);
  });
});

describe("hosted configuration", () => {
  it("creates isolated non-persisting runtime configuration", () => {
    const first = createHostedRuntimeConfig("first-token", "https://api.test/", "https://mcp.test");
    const second = createHostedRuntimeConfig("second-token", "https://api.test/", "https://mcp.test");

    expect(first).not.toBe(second);
    expect(first.apiToken).toBe("first-token");
    expect(second.apiToken).toBe("second-token");
    expect(first.refreshToken).toBeUndefined();
    expect(first.persistRuntimeTokens).toBe(false);
    expect(first.configPath).toBe("");
    expect(first.hostedOAuth?.protectedResourceMetadataUrl)
      .toBe("https://mcp.test/.well-known/oauth-protected-resource");
  });

  it("loads limits from environment and rejects invalid values", () => {
    expect(loadHostedHttpOptions({}).port).toBe(3002);
    expect(loadHostedHttpOptions({}).resourceUrl).toBe("https://mcp.bugfender.com");
    const loaded = loadHostedHttpOptions({
      BUGFENDER_MCP_PORT: "4000",
      BUGFENDER_MCP_MAX_CONCURRENCY: "7",
    });
    expect(loaded.port).toBe(4000);
    expect(loaded.maxConcurrency).toBe(7);
    expect(() => loadHostedHttpOptions({ BUGFENDER_MCP_PORT: "nope" })).toThrow(
      "BUGFENDER_MCP_PORT must be a positive integer",
    );
    expect(loadHostedHttpOptions({ BUGFENDER_MCP_RESOURCE_URL: "https://mcp.test/" }).resourceUrl)
      .toBe("https://mcp.test");
    expect(() => loadHostedHttpOptions({ BUGFENDER_OAUTH_ISSUER: "http://dashboard.test" }))
      .toThrow("BUGFENDER_OAUTH_ISSUER must be an HTTPS origin");
  });
});
