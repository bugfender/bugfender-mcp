# Releasing

## npm Release

1. Update the version in `package.json`.
2. Verify the package locally:

```bash
pnpm install
pnpm check
pnpm build
pnpm pack --pack-destination /tmp
```

3. Publish to npm:

```bash
pnpm publish
```

`prepublishOnly` already enforces `pnpm check && pnpm build`.

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
