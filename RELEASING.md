# Releasing

## npm Release

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

The [MCP Registry](https://modelcontextprotocol.io/registry/quickstart) only stores metadata; npm still hosts the package. The server id must be a **semantic name** such as `io.github.bugfender/mcp` (it must match **`mcpName` in `package.json`** and **`name` in `server.json`**).

**Before publishing to npm:** `package.json` must include `mcpName`. The registry verifies the published tarball on npm.

`release-it` runs `node scripts/sync-server-json-version.mjs` on `after:bump`, which aligns `server.json` versions with `package.json`. If you change the npm package name or registry id, update `server.json` and `mcpName` manually.

After `@bugfender/mcp` is on npm:

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
