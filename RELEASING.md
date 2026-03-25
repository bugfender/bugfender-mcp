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

After the npm package is published, publish the MCP metadata to the MCP registry.

1. Install the publisher tool:

```bash
pnpm add -g @modelcontextprotocol/publisher
```

2. Initialize the registry metadata in the repo root:

```bash
mcp-publisher init
```

3. Configure `server.json` with:

- package name: `@bugfender/mcp`
- server name: `bugfender`
- current version
- package source: npm

4. Publish the registry entry:

```bash
mcp-publisher publish
```

5. Verify discovery:

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=bugfender"
```
