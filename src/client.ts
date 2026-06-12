import { saveConfig } from "./config.js";
import { BugfenderApiError } from "./errors.js";
import type { RuntimeConfig } from "./types.js";
import { REQUEST_TIMEOUT_MS } from "./constants.js";
import { paramsToSearch, parseRetryAfter, withJitter } from "./utils/http.js";
import { tryParseJson } from "./utils/json.js";

export class BugfenderClient {
  private readonly apiUrl: string;
  private readonly configPath: string;
  private readonly persistRuntimeTokens: boolean;
  private apiToken?: string;
  private refreshToken?: string;
  private seedRefreshToken?: string;

  constructor(config: RuntimeConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, "");
    this.configPath = config.configPath;
    this.persistRuntimeTokens = config.persistRuntimeTokens;
    this.apiToken = config.apiToken;
    this.refreshToken = config.refreshToken;
    this.seedRefreshToken = config.seedRefreshToken;
  }

  get hasToken(): boolean {
    return Boolean(this.apiToken || this.refreshToken);
  }

  async get<T>(path: string, query?: Record<string, unknown>, requireAuth = true): Promise<T> {
    const search = query ? paramsToSearch(query).toString() : "";
    return this.request<T>(search ? `${path}?${search}` : path, { method: "GET" }, requireAuth);
  }

  async post<T>(path: string, body?: unknown, requireAuth = true): Promise<T> {
    return this.request<T>(
      path,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      },
      requireAuth,
    );
  }

  async put<T>(path: string, body?: unknown, requireAuth = true): Promise<T> {
    return this.request<T>(
      path,
      {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      },
      requireAuth,
    );
  }

  private async request<T>(path: string, init: RequestInit, requireAuth: boolean): Promise<T> {
    if (requireAuth && !this.apiToken && !this.refreshToken) {
      throw new BugfenderApiError("Missing Bugfender token", 401, null);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.apiUrl}${path}`, { ...init, headers: this.buildHeaders(init), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const text = await response.text();
      const body = text ? tryParseJson(text) : null;

      if (response.ok) {
        return body as T;
      }

      if (response.status === 401 && requireAuth && this.refreshToken) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          continue;
        }
        throw new BugfenderApiError("Bugfender MCP token expired", 401, {
          code: "refresh_expired",
          message: "Your Bugfender MCP token expired and could not be refreshed automatically.",
        });
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < 2) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = parseRetryAfter(retryAfter) ?? withJitter(attempt === 0 ? 500 : 1500);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new BugfenderApiError(`Bugfender API request failed for ${path}`, response.status, body);
    }

    throw new BugfenderApiError(`Bugfender API request failed for ${path}`, 500, null);
  }

  private buildHeaders(init: RequestInit): Headers {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) {
      headers.set("Content-Type", "application/json");
    }
    if (this.apiToken) {
      headers.set("Authorization", `Bearer ${this.apiToken}`);
    }
    return headers;
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/mcp/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const text = await response.text();
      const body = text ? tryParseJson(text) : null;
      if (!response.ok || !body || typeof body !== "object") {
        return false;
      }

      const nextApiToken = "api_token" in body && typeof body.api_token === "string" ? body.api_token : null;
      const nextRefreshToken = "refresh_token" in body && typeof body.refresh_token === "string" ? body.refresh_token : null;
      if (!nextApiToken) {
        return false;
      }

      this.apiToken = nextApiToken;
      if (nextRefreshToken) {
        this.refreshToken = nextRefreshToken;
      }
      this.persistTokens();
      return true;
    } catch (error) {
      console.error("Bugfender token refresh failed:", error);
      return false;
    }
  }

  private persistTokens(): void {
    if (!this.persistRuntimeTokens) {
      return;
    }

    saveConfig({
      apiToken: this.apiToken,
      refreshToken: this.refreshToken,
      apiUrl: this.apiUrl,
      configPath: this.configPath,
      seedRefreshToken: this.seedRefreshToken,
      persistRuntimeTokens: true,
    });
  }
}
