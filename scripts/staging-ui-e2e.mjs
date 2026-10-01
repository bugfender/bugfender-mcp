import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { chromium } from "playwright";

const endpoint = process.env.BUGFENDER_MCP_E2E_URL || "https://mcp-stg.bugfender.com/mcp";
const email = process.env.BUGFENDER_MCP_E2E_EMAIL;
const password = process.env.BUGFENDER_MCP_E2E_PASSWORD;
const clientId = process.env.BUGFENDER_MCP_E2E_CLIENT_ID;
const appId = process.env.BUGFENDER_MCP_E2E_APP_ID;

if (!email || !password || !clientId || !appId) {
  console.error(
    "Set BUGFENDER_MCP_E2E_EMAIL, BUGFENDER_MCP_E2E_PASSWORD, "
      + "BUGFENDER_MCP_E2E_CLIENT_ID, and BUGFENDER_MCP_E2E_APP_ID.",
  );
  process.exit(2);
}

async function expectJson(response, label) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
  return body;
}

function base64Url(value) {
  return value.toString("base64url");
}

function startCallbackServer(redirectUri) {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(redirect.hostname)) {
    throw new Error("The staging E2E client redirect URI must use HTTP localhost or 127.0.0.1.");
  }
  let resolveCallback;
  let rejectCallback;
  const callback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const server = createServer((request, response) => {
    const received = new URL(request.url || "/", redirect.origin);
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bugfender OAuth staging test received the callback. This window can be closed.");
    if (received.pathname !== redirect.pathname) {
      rejectCallback(new Error("OAuth callback used an unexpected path."));
      return;
    }
    resolveCallback(received);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(redirect.port || 80), redirect.hostname, () => {
      resolve({ server, callback });
    });
  });
}

async function callMcp(accessToken, id, method, params) {
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
    throw new Error(`${method} returned an MCP error.`);
  }
  return body.result;
}

function expectSuccessfulTool(result, name) {
  if (result?.isError || result?.structuredContent?.ok !== true) {
    throw new Error(`${name} did not return a successful normalized envelope.`);
  }
}

const resourceOrigin = new URL(endpoint).origin;
const protectedResource = await expectJson(
  await fetch(`${resourceOrigin}/.well-known/oauth-protected-resource`),
  "protected-resource discovery",
);
const issuer = protectedResource.authorization_servers?.[0];
if (protectedResource.resource !== resourceOrigin || !issuer) {
  throw new Error("Protected-resource metadata does not match the staging MCP origin.");
}
const authorizationServer = await expectJson(
  await fetch(`${issuer}/.well-known/oauth-authorization-server`),
  "authorization-server discovery",
);
const clientMetadata = await expectJson(await fetch(clientId), "client metadata");
if (clientMetadata.client_id !== clientId || clientMetadata.token_endpoint_auth_method !== "none") {
  throw new Error("The staging E2E client metadata is not a matching public client.");
}
const redirectUri = clientMetadata.redirect_uris?.[0];
if (!redirectUri) {
  throw new Error("The staging E2E client metadata has no redirect URI.");
}

const verifier = base64Url(randomBytes(48));
const challenge = base64Url(createHash("sha256").update(verifier).digest());
const state = base64Url(randomBytes(24));
const authorizationUrl = new URL(authorizationServer.authorization_endpoint);
authorizationUrl.search = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  redirect_uri: redirectUri,
  resource: resourceOrigin,
  scope: "mcp:read mcp:issues:write",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
}).toString();

const { server: callbackServer, callback } = await startCallbackServer(redirectUri);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(authorizationUrl.toString(), { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
  }
  const allow = page.getByRole("button", { name: "Allow", exact: true });
  await allow.waitFor({ state: "visible", timeout: 30_000 });
  await allow.click();

  const callbackUrl = await Promise.race([
    callback,
    new Promise((_, reject) => setTimeout(() => reject(new Error("OAuth callback timed out.")), 30_000)),
  ]);
  if (callbackUrl.searchParams.get("state") !== state) {
    throw new Error("OAuth callback state did not match.");
  }
  const code = callbackUrl.searchParams.get("code");
  if (!code) {
    throw new Error("OAuth callback did not contain an authorization code.");
  }

  const tokenResponse = await expectJson(await fetch(authorizationServer.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      resource: resourceOrigin,
      code,
      code_verifier: verifier,
    }),
  }), "token exchange");
  if (!tokenResponse.access_token) {
    throw new Error("Token exchange returned no access token.");
  }

  await callMcp(tokenResponse.access_token, 1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "bugfender-staging-ui-e2e", version: "1.0.0" },
  });
  expectSuccessfulTool(await callMcp(tokenResponse.access_token, 2, "tools/call", {
    name: "who_am_i",
    arguments: {},
  }), "who_am_i");
  expectSuccessfulTool(await callMcp(tokenResponse.access_token, 3, "tools/call", {
    name: "list_apps",
    arguments: {},
  }), "list_apps");
  expectSuccessfulTool(await callMcp(tokenResponse.access_token, 4, "tools/call", {
    name: "count_logs",
    arguments: { app_id: appId },
  }), "count_logs");
  console.log("Real staging authorization UI and MCP tool flow passed.");
} finally {
  await new Promise((resolve, reject) => {
    callbackServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await browser.close();
}
