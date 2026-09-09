# Staging OAuth end-to-end test

Use this test after deploying both the dashboard authorization-server changes
and the hosted MCP changes to staging. It intentionally exercises the native
client connection UI; do not replace it with a manually copied MCP token.

## Native connection

1. Add `https://mcp-stg.bugfender.com/mcp` as a custom MCP connection in
   ChatGPT or Codex.
2. Confirm the client discovers the Bugfender authorization server and opens
   the staging Bugfender consent page.
3. Sign in with a staging test account and approve `mcp:read`. Approve
   `mcp:issues:write` only when the write-tool scenario is being tested.
4. Confirm the client returns to a connected state without manually entering
   an access token.
5. Ask the client to identify the connected Bugfender account, list its apps,
   and count recent logs for a known staging app.
6. Confirm the returned account and app belong to the staging test account and
   no access token, refresh token, app key, or internal authentication error is
   displayed.
7. Disconnect Bugfender in the client. Confirm a subsequent protected tool
   call requires a new connection instead of continuing to use the revoked
   grant.

## Direct staging smoke check

Immediately after step 3, the same short-lived access token can be used to run
the protocol-level smoke test:

```bash
BUGFENDER_MCP_E2E_ACCESS_TOKEN='...' \
BUGFENDER_MCP_E2E_APP_ID='...' \
pnpm test:staging
```

The script validates both discovery documents, MCP initialization, tool
listing, `who_am_i`, `list_apps`, and the read-only `count_logs` investigation
tool. Never commit the token or store it as a long-lived CI secret.
