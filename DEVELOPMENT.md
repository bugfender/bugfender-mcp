# Development

## Local Setup

```bash
pnpm install
pnpm check
pnpm build
```

Build output is generated in `dist/`.

## Local MCP Testing

Build the server, then point your MCP client at the local `dist/index.js` entrypoint instead of the published npm package.

For direct local execution from this repository:

```bash
pnpm build
pnpm start
```

Do not use `npx @bugfender/mcp` or `npx -p @bugfender/mcp bugfender-mcp` from inside this checkout. npm can resolve the current package and fail to expose the published bin shim, which surfaces as `bugfender-mcp: not found`.

Set credentials in your shell or client config:

```bash
export BUGFENDER_API_TOKEN="YOUR_ACCESS_TOKEN"
export BUGFENDER_REFRESH_TOKEN="YOUR_REFRESH_TOKEN"
export BUGFENDER_API_URL="https://dashboard.bugfender.com/api"
```

Example local MCP config:

```json
{
  "mcpServers": {
    "bugfender": {
      "command": "node",
      "args": ["/absolute/path/to/bugfender-mcp/dist/index.js"],
      "env": {
        "BUGFENDER_API_TOKEN": "YOUR_ACCESS_TOKEN",
        "BUGFENDER_REFRESH_TOKEN": "YOUR_REFRESH_TOKEN",
        "BUGFENDER_API_URL": "https://dashboard.bugfender.com/api"
      }
    }
  }
}
```

After restarting the client, smoke test with simple tool calls such as `who_am_i`, `list_teams`, or `list_apps`.

Notes:

- rerun `pnpm build` after code changes
- restart the MCP client or reconnect after rebuilding
- `~/.bugfender/mcp.json` is also supported for local token storage and rotated credentials

## Hosted HTTP Testing

Build and run the request-scoped Streamable HTTP entry point:

```bash
pnpm build
BUGFENDER_API_URL="https://dashboard.bugfender.com/api" pnpm start:http
```

The endpoint is `POST http://localhost:3002/mcp`; liveness and readiness are
available at `/healthz` and `/readyz`. Unlike stdio mode, hosted mode requires a
bearer token on every MCP request and never loads or persists local credentials.

## Repository Layout

```text
src/                  MCP server source
dist/                 generated build output
README.md             public package docs
DEVELOPMENT.md        maintainer development notes
RELEASING.md          release and publish workflow
LICENSE               Apache-2.0 license
```

## Development Notes

- `src/` is the source of truth.
- companion skills are maintained in `bugfender/bugfender-skills`.
- `dist/` is generated and should not be committed.
- `node_modules/` should not be committed.
- `pnpm-lock.yaml` is the maintainer lockfile.
- the published npm tarball includes only `dist/**/*`, `README.md`, and `LICENSE`

## Public Repo Checklist

Keep:

- `src/`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `README.md`
- `DEVELOPMENT.md`
- `RELEASING.md`
- `LICENSE`
- `.gitignore`

Do not commit:

- `node_modules/`
- `dist/`
- `.DS_Store`

## Validation

Useful checks before opening a PR:

```bash
pnpm check
pnpm build
pnpm pack --pack-destination /tmp
```

For release verification, use:

```bash
pnpm release:check
```
