import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BugfenderClient } from "../client.js";
import { BugfenderApiError } from "../errors.js";

vi.mock("../config.js", () => ({
  saveConfig: vi.fn(),
}));

function makeClient(overrides?: Partial<ConstructorParameters<typeof BugfenderClient>[0]>) {
  return new BugfenderClient({
    apiUrl: "https://api.test",
    configPath: "/tmp/test.json",
    persistRuntimeTokens: true,
    apiToken: "tok_api",
    refreshToken: "tok_refresh",
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("BugfenderClient", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful requests", () => {
    it("makes GET requests and returns parsed JSON", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));
      const client = makeClient();
      const result = await client.get("/mcp/apps");
      expect(result).toEqual({ items: [1, 2] });
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.test/mcp/apps");
    });

    it("makes POST requests with JSON body", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient();
      await client.post("/mcp/action", { key: "value" });
      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ key: "value" }));
    });

    it("makes PUT requests with JSON body", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient();
      await client.put("/app/app-1/issues-aggregation/hash-1", { status: 3 });
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.test/app/app-1/issues-aggregation/hash-1");
      expect(init.method).toBe("PUT");
      expect(init.body).toBe(JSON.stringify({ status: 3 }));
    });
  });

  describe("buildHeaders", () => {
    it("sets Authorization when token is present", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}));
      const client = makeClient({ apiToken: "my-token" });
      await client.get("/test");
      const [, init] = fetchSpy.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("sets Content-Type for POST requests", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}));
      const client = makeClient();
      await client.post("/test", { x: 1 });
      const [, init] = fetchSpy.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("does not set Content-Type for GET requests", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}));
      const client = makeClient();
      await client.get("/test");
      const [, init] = fetchSpy.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("Content-Type")).toBeNull();
    });
  });

  describe("retry logic", () => {
    it("retries on 429 up to 3 attempts", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient();
      const result = await client.get("/test");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("retries on 500", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient();
      const result = await client.get("/test");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 400", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: "bad" }, 400));
      const client = makeClient();
      await expect(client.get("/test")).rejects.toThrow(BugfenderApiError);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("does not retry on 404", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}, 404));
      const client = makeClient();
      await expect(client.get("/test")).rejects.toThrow(BugfenderApiError);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it("throws after exhausting retries on 429", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 429));
      const client = makeClient();
      await expect(client.get("/test")).rejects.toThrow(BugfenderApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("token refresh", () => {
    it("refreshes token on 401 and retries original request", async () => {
      fetchSpy
        // First request: 401
        .mockResolvedValueOnce(jsonResponse({}, 401))
        // Refresh call
        .mockResolvedValueOnce(jsonResponse({ api_token: "new_api", refresh_token: "new_refresh" }))
        // Retried original request
        .mockResolvedValueOnce(jsonResponse({ data: "ok" }));
      const client = makeClient();
      const result = await client.get("/test");
      expect(result).toEqual({ data: "ok" });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      // Verify the refresh call went to /mcp/refresh
      const [refreshUrl] = fetchSpy.mock.calls[1];
      expect(refreshUrl).toBe("https://api.test/mcp/refresh");
    });

    it("calls persistTokens (saveConfig) after successful refresh", async () => {
      const { saveConfig } = await import("../config.js");
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse({ api_token: "new_api", refresh_token: "new_refresh" }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));
      const client = makeClient();
      await client.get("/test");
      expect(saveConfig).toHaveBeenCalled();
    });

    it("throws token_expired error when refresh fails", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse({}, 401));
      const client = makeClient();
      await expect(client.get("/test")).rejects.toThrow("token expired");
    });

    it("logs to console.error when refresh throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 401))
        // Refresh call throws a network error
        .mockRejectedValueOnce(new Error("network error"));
      const client = makeClient();
      await expect(client.get("/test")).rejects.toThrow("token expired");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Bugfender token refresh failed:",
        expect.any(Error),
      );
    });
  });

  describe("timeout", () => {
    it("passes AbortSignal.timeout to fetch", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}));
      const client = makeClient();
      await client.get("/test");
      const [, init] = fetchSpy.mock.calls[0];
      expect(init.signal).toBeDefined();
    });
  });

  describe("auth requirement", () => {
    it("throws 401 BugfenderApiError when no tokens and requireAuth is true", async () => {
      const client = makeClient({ apiToken: undefined, refreshToken: undefined });
      await expect(client.get("/test")).rejects.toThrow(BugfenderApiError);
    });

    it("allows requests without tokens when requireAuth is false", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ public: true }));
      const client = makeClient({ apiToken: undefined, refreshToken: undefined });
      const result = await client.get("/test", undefined, false);
      expect(result).toEqual({ public: true });
    });
  });
});
