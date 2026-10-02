# Releasing

## Hosted MCP release

The hosted service is the primary public distribution. Before publishing its
registry metadata:

1. Deploy the release to production.
2. Verify `/healthz`, `/readyz`, protected-resource discovery, authorization-
   server discovery, OAuth linking, `who_am_i`, `list_apps`, and one scoped read
   tool against `https://mcp.bugfender.com/mcp`.
3. Run `mcp-publisher validate` to validate `server.json`.
4. Run `mcp-publisher publish` and verify that the registry entry exposes the
   `streamable-http` remote URL.

Do not publish remote metadata before the production endpoint and OAuth issuer are ready.

## Legacy npm release

The npm package is retained only for existing local stdio and self-hosted
installations. Do not present it as the default installation path.

1. Install dependencies:

```bash
pnpm install
```

2. Run the release flow:

```bash
pnpm release
```

`release-it` will:

- prompt for the new version
- update `package.json`
- create the release commit and git tag
- publish to npm

Before the release starts, the `before:init` hook runs:

```bash
pnpm release:check
```

`release:check` runs `pnpm check`, `pnpm build`, and `pnpm pack --pack-destination /tmp`.

`prepublishOnly` still enforces `pnpm check && pnpm build` as a final guard during npm publish.

## MCP Registry Release

The [MCP Registry](https://modelcontextprotocol.io/registry/quickstart) stores
metadata for both the hosted remote and the retained npm package. The server id
must be a **semantic name** such as `io.github.bugfender/mcp` (it must match
**`mcpName` in `package.json`** and **`name` in `server.json`**).

**Before publishing to npm:** `package.json` must include `mcpName`. The registry verifies the published tarball on npm.

`release-it` runs `node scripts/sync-server-json-version.mjs` on `after:bump`, which aligns `server.json` versions with `package.json`. If you change the npm package name or registry id, update `server.json` and `mcpName` manually.

After the hosted production flow is verified and `@bugfender/mcp` is on npm:

1. Install the official CLI ([Homebrew](https://brew.sh/) or [binary releases](https://github.com/modelcontextprotocol/registry/releases)):

```bash
brew install mcp-publisher
```

2. Optionally validate metadata:

```bash
mcp-publisher validate
```

3. If you need a fresh template, run `mcp-publisher init`, then restore Bugfender-specific fields from the committed `server.json` in git.

4. Authenticate (GitHub device flow is typical):

```bash
mcp-publisher login github
```

5. Publish:

```bash
mcp-publisher publish
```

6. Verify (registry API uses `v0.1`; search by full server id):

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.bugfender/mcp"
```

The committed `server.json` advertises the hosted remote first and retains the
npm package for legacy stdio discovery.

To mark a released stdio version as deprecated in npm after the hosted service
is publicly available, use a bounded version range rather than deprecating
future releases accidentally:

```bash
npm deprecate '@bugfender/mcp@<=0.6.0' \
  'Local stdio is deprecated for new installations. Use https://mcp.bugfender.com/mcp with OAuth.'
```

Verify the range and production hosted flow before running this external, user-visible command.
