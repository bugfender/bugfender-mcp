import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { DEFAULT_API_URL, MAX_RESPONSE_BYTES } from "./constants.js";
import { createBugfenderServer } from "./server.js";
import type { RuntimeConfig } from "./types.js";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3002;
const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_CONCURRENCY = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 35_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

export type HostedHttpOptions = {
  apiUrl: string;
  host: string;
  port: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxConcurrency: number;
  requestTimeoutMs: number;
  shutdownTimeoutMs: number;
};

type ActiveRequest = {
  close: () => Promise<void>;
};

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

class RequestTimeoutError extends Error {}
class ResponseTooLargeError extends Error {}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadHostedHttpOptions(env: NodeJS.ProcessEnv = process.env): HostedHttpOptions {
  return {
    apiUrl: env.BUGFENDER_API_URL || DEFAULT_API_URL,
    host: env.BUGFENDER_MCP_HOST || DEFAULT_HOST,
    port: positiveInteger(env.BUGFENDER_MCP_PORT, DEFAULT_PORT, "BUGFENDER_MCP_PORT"),
    maxRequestBytes: positiveInteger(
      env.BUGFENDER_MCP_MAX_REQUEST_BYTES,
      DEFAULT_MAX_REQUEST_BYTES,
      "BUGFENDER_MCP_MAX_REQUEST_BYTES",
    ),
    maxResponseBytes: positiveInteger(
      env.BUGFENDER_MCP_MAX_RESPONSE_BYTES,
      MAX_RESPONSE_BYTES,
      "BUGFENDER_MCP_MAX_RESPONSE_BYTES",
    ),
    maxConcurrency: positiveInteger(
      env.BUGFENDER_MCP_MAX_CONCURRENCY,
      DEFAULT_MAX_CONCURRENCY,
      "BUGFENDER_MCP_MAX_CONCURRENCY",
    ),
    requestTimeoutMs: positiveInteger(
      env.BUGFENDER_MCP_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      "BUGFENDER_MCP_REQUEST_TIMEOUT_MS",
    ),
    shutdownTimeoutMs: positiveInteger(
      env.BUGFENDER_MCP_SHUTDOWN_TIMEOUT_MS,
      DEFAULT_SHUTDOWN_TIMEOUT_MS,
      "BUGFENDER_MCP_SHUTDOWN_TIMEOUT_MS",
    ),
  };
}

function bearerToken(req: IncomingMessage): string {
  const authorization = req.headers.authorization;
  if (!authorization) {
    throw new HttpRequestError(401, "Missing bearer token");
  }
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
  if (!match) {
    throw new HttpRequestError(401, "Invalid bearer token");
  }
  return match[1];
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    req.resume();
    throw new HttpRequestError(413, "Request body too large");
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBytes) {
      req.resume();
      throw new HttpRequestError(413, "Request body too large");
    }
    chunks.push(buffer);
  }

  if (bytes === 0) {
    throw new HttpRequestError(400, "Request body is required");
  }

  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8")) as unknown;
  } catch {
    throw new HttpRequestError(400, "Request body must be valid JSON");
  }
}

async function limitedResponseBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new ResponseTooLargeError("Response body too large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
    }
  }
  return Buffer.concat(chunks, bytes);
}

async function sendWebResponse(res: ServerResponse, response: Response, maxBytes: number): Promise<void> {
  const body = await limitedResponseBody(response, maxBytes);
  if (res.writableEnded || res.destroyed) {
    return;
  }
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name !== "content-length" && name !== "transfer-encoding" && name !== "connection") {
      res.setHeader(name, value);
    }
  });
  res.setHeader("Content-Length", body.byteLength);
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>): void {
  if (res.headersSent || res.destroyed) {
    return;
  }
  const encoded = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": encoded.byteLength,
    "Content-Type": "application/json",
    ...headers,
  });
  res.end(encoded);
}

function sendMcpError(res: ServerResponse, status: number, message: string, headers?: Record<string, string>): void {
  sendJson(
    res,
    status,
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    headers,
  );
}

export function createHostedRuntimeConfig(token: string, apiUrl: string): RuntimeConfig {
  return {
    apiToken: token,
    apiUrl,
    configPath: "",
    persistRuntimeTokens: false,
  };
}

function webRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request(`http://localhost${req.url || "/mcp"}`, {
    method: req.method,
    headers,
  });
}

export type HostedHttpServer = {
  server: Server;
  shutdown: () => Promise<void>;
};

export function createHostedHttpServer(options: HostedHttpOptions): HostedHttpServer {
  let ready = true;
  let activeCount = 0;
  let shutdownPromise: Promise<void> | undefined;
  const activeRequests = new Set<ActiveRequest>();

  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.url === "/healthz") {
      sendJson(res, 200, { status: "ok" });
      return;
    }
    if (req.url === "/readyz") {
      sendJson(res, ready ? 200 : 503, { status: ready ? "ready" : "shutting_down" });
      return;
    }
    if (req.url !== "/mcp") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    if (req.method !== "POST") {
      sendMcpError(res, 405, "Method not allowed", { Allow: "POST" });
      return;
    }
    if (!ready) {
      sendMcpError(res, 503, "Server is shutting down", { "Retry-After": "1" });
      return;
    }
    if (activeCount >= options.maxConcurrency) {
      req.resume();
      sendMcpError(res, 503, "Server is busy", { "Retry-After": "1" });
      return;
    }

    activeCount += 1;
    let activeRequest: ActiveRequest | undefined;
    let timedOut = false;
    let timeout: NodeJS.Timeout;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        reject(new RequestTimeoutError());
      }, options.requestTimeoutMs);
      timeout.unref();
    });
    try {
      const operation = (async () => {
        const token = bearerToken(req);
        const parsedBody = await readJsonBody(req, options.maxRequestBytes);
        if (timedOut) {
          throw new RequestTimeoutError();
        }

        const { server: mcpServer } = createBugfenderServer(
          createHostedRuntimeConfig(token, options.apiUrl),
        );
        const transport = new WebStandardStreamableHTTPServerTransport({
          enableJsonResponse: true,
          sessionIdGenerator: undefined,
        });
        let closed = false;
        activeRequest = {
          close: async () => {
            if (closed) {
              return;
            }
            closed = true;
            await Promise.allSettled([transport.close(), mcpServer.close()]);
          },
        };
        activeRequests.add(activeRequest);
        await mcpServer.connect(transport);
        const response = await transport.handleRequest(webRequest(req), { parsedBody });
        await sendWebResponse(res, response, options.maxResponseBytes);
      })();
      await Promise.race([operation, deadline]);
    } catch (error) {
      if (error instanceof HttpRequestError) {
        if (!req.complete) {
          req.resume();
        }
        const headers = error.status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined;
        sendMcpError(res, error.status, error.message, headers);
      } else if (error instanceof RequestTimeoutError) {
        if (!req.complete) {
          req.resume();
        }
        sendMcpError(res, 504, "Request timed out");
      } else if (error instanceof ResponseTooLargeError) {
        sendMcpError(res, 502, "Response body too large");
      } else {
        console.error("Hosted MCP request failed", error);
        sendMcpError(res, 500, "Internal server error");
      }
    } finally {
      clearTimeout(timeout!);
      if (activeRequest) {
        activeRequests.delete(activeRequest);
        await activeRequest.close();
      }
      activeCount -= 1;
    }
  });

  server.requestTimeout = options.requestTimeoutMs + 5_000;
  server.headersTimeout = Math.min(server.requestTimeout, 60_000);
  server.keepAliveTimeout = 5_000;

  const shutdown = async (): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    ready = false;
    shutdownPromise = new Promise<void>((resolve) => {
      const forceClose = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, options.shutdownTimeoutMs);
      forceClose.unref();

      server.close(() => {
        clearTimeout(forceClose);
        resolve();
      });
      server.closeIdleConnections();
      void Promise.allSettled([...activeRequests].map((request) => request.close()));
    });
    return shutdownPromise;
  };

  return { server, shutdown };
}
