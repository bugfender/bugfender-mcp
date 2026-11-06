# Claude Connector Release Checklist

Use this checklist against staging before every Claude connector release. Do not replace it with a scheduled browser OAuth workflow: protocol tests should remain deterministic, while real-client OAuth acceptance is an explicit release step.

## Automated checks

- [ ] Run `pnpm test:claude` and confirm the Claude conformance suite passes.
- [ ] Run the full `pnpm check && pnpm test && pnpm build` verification.
- [ ] Start the hosted server with staging configuration and keep authentication enabled.
- [ ] Validate tool discovery with MCP Inspector:

  ```bash
  pnpm dlx @modelcontextprotocol/inspector --cli \
    https://staging-mcp.example.com/mcp \
    --transport http \
    --method tools/list \
    --strict \
    --header "Authorization: Bearer $BUGFENDER_MCP_TEST_TOKEN"
  ```

- [ ] Confirm Inspector lists every read tool and `update_issue_status` with its write/destructive annotations.
- [ ] Confirm discovery, registration, authorization, token, and refresh responses complete in under 10 seconds.
- [ ] Confirm maximum expected tool results remain below the configured HTTP limit and normalized tool-result limit.

## OAuth conformance

- [ ] A request without credentials returns `401` with `WWW-Authenticate` linking protected-resource metadata.
- [ ] Protected-resource metadata identifies the exact staging MCP resource and lists the intended Bugfender issuer first.
- [ ] Authorization-server metadata advertises S256 PKCE, supported scopes, revocation, and only registration methods that work.
- [ ] CIMD registration works with a public client and `token_endpoint_auth_method=none`.
- [ ] DCR works when `registration_endpoint` is advertised; otherwise confirm it is not advertised.
- [ ] Authorization Code with S256 succeeds and rejects invalid codes, reused codes, invalid verifiers, and redirect mismatches.
- [ ] Hosted callbacks work for `https://claude.ai/api/mcp/auth_callback` and `https://claude.com/api/mcp/auth_callback`.
- [ ] Claude Code callbacks work for dynamic ports on both `localhost` and `127.0.0.1`; other loopback hosts and invalid redirects fail.
- [ ] Access and refresh tokens remain bound to user, client, scopes, and the exact MCP resource/audience.
- [ ] Missing, malformed, expired, revoked, wrong-audience, and insufficient-scope access tokens fail safely.
- [ ] Refresh preserves or narrows scopes, never expands them, and follows the documented rotation/concurrency policy.
- [ ] Disconnect revokes the grant; reconnect and reauthorization create a usable new grant.
- [ ] Two simultaneous users retain isolated credentials and results.

## Real Claude acceptance

- [ ] Add the staging URL as a custom connector in Claude under **Customize → Connectors**.
- [ ] Complete OAuth in Claude.ai and verify the connector shows **Connected**.
- [ ] Verify every advertised tool appears under Tool permissions with the expected title and description.
- [ ] Run `who_am_i`, `list_apps`, and representative log, crash, device, issue, network, and feedback reads.
- [ ] Run `update_issue_status` on a dedicated test issue, approve the write, and verify the resulting status.
- [ ] Disconnect, verify revocation, reconnect, and repeat one read.
- [ ] Connect from Claude Code and exercise both `localhost` and `127.0.0.1` loopback callbacks on dynamic ports.
- [ ] Review server logs for timeouts, credential leakage, raw authorization data, cross-user state, or unexpected client-name authorization logic.
- [ ] Record the staging URL, build SHA, tester, date, tested Claude surfaces, and any known limitations in the release record.

Reference: [Anthropic: Test your connector](https://claude.com/docs/connectors/building/testing).
