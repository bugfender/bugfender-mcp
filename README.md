# `@bugfender/mcp`

Bugfender MCP server for local stdio clients such as Cursor, Claude Code, Codex,
and Gemini CLI, plus a stateless Streamable HTTP entry point for Bugfender's hosted service.

## What It Provides

- user-scoped Bugfender read access through MCP
- automatic access-token refresh when a refresh token is configured
- logs, devices, app metadata, crash aggregation, and issue aggregation tools
- SDK snippet retrieval for app onboarding
- resource templates for snippets, logs, and issue groups
- companion Bugfender skills distributed from `bugfender/bugfender-skills`

## Maintainers

- development workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)
- release and publish flow: [RELEASING.md](./RELEASING.md)

## Install

```bash
npx -y @bugfender/mcp
```

After adding or updating the MCP server in your IDE or agent, restart that client so it reloads the new MCP configuration cleanly.

If you are running from inside this repository checkout, do not use `npx @bugfender/mcp` or `npx -p @bugfender/mcp bugfender-mcp`. npm can resolve the current package instead of the published tarball and fail with `bugfender-mcp: not found`.

For local development, build and run the generated entrypoint directly:

```bash
pnpm build
pnpm start
```

## Configuration

- `BUGFENDER_API_TOKEN`: required access token
- `BUGFENDER_REFRESH_TOKEN`: recommended for automatic token refresh
- `BUGFENDER_API_URL`: optional override, defaults to `https://dashboard.bugfender.com/api`
- `~/.bugfender/mcp.json`: optional config file and local token store for rotated credentials

```json
{
  "default": {
    "apiToken": "YOUR_ACCESS_TOKEN",
    "refreshToken": "YOUR_REFRESH_TOKEN",
    "apiUrl": "https://dashboard.bugfender.com/api"
  }
}
```

When a refresh token is provided, the MCP stores rotated credentials in `~/.bugfender/mcp.json` so automatic refresh survives restarts. Updating the IDE config with a newly generated refresh token resets that local state.

These credentials and the local token store apply only to the stdio executable.
The hosted HTTP executable reads a bearer token from each request and never
reads or writes `~/.bugfender/mcp.json`.

If you are using local or self-hosted Bugfender credentials, `BUGFENDER_API_URL` must point to the matching backend. For example, local credentials generated from `https://dashboard:3000` will not work against `https://dashboard.bugfender.com/api`.

## Cursor / Claude Code

```json
{
  "mcpServers": {
    "bugfender": {
      "command": "npx",
      "args": ["-y", "@bugfender/mcp"],
      "env": {
        "BUGFENDER_API_TOKEN": "YOUR_ACCESS_TOKEN",
        "BUGFENDER_REFRESH_TOKEN": "YOUR_REFRESH_TOKEN",
        "BUGFENDER_API_URL": "https://dashboard.bugfender.com/api"
      }
    }
  }
}
```

## Codex CLI

```bash
codex mcp add bugfender \
  --env BUGFENDER_API_TOKEN='YOUR_ACCESS_TOKEN' \
  --env BUGFENDER_REFRESH_TOKEN='YOUR_REFRESH_TOKEN' \
  --env BUGFENDER_API_URL='https://dashboard.bugfender.com/api' \
  -- npx -y @bugfender/mcp
```

After running `codex mcp add`, restart the Codex session before testing `who_am_i` or `list_apps`.

## Gemini CLI

```bash
gemini mcp add bugfender npx -y @bugfender/mcp \
  --env BUGFENDER_API_TOKEN='YOUR_ACCESS_TOKEN' \
  --env BUGFENDER_REFRESH_TOKEN='YOUR_REFRESH_TOKEN' \
  --env BUGFENDER_API_URL='https://dashboard.bugfender.com/api'
```

After running `gemini mcp add`, start a new Gemini CLI session or reload MCP servers before testing `who_am_i` or `list_apps`.

## Codex App

In the custom MCP server form:

- `Name`: `bugfender`
- `Command to launch`: `npx`
- `Argument 1`: `-y`
- `Argument 2`: `@bugfender/mcp`
- `BUGFENDER_API_TOKEN`: `YOUR_ACCESS_TOKEN`
- `BUGFENDER_REFRESH_TOKEN`: `YOUR_REFRESH_TOKEN`
- `BUGFENDER_API_URL`: `https://dashboard.bugfender.com/api`

Add the arguments as separate rows, not as one combined string.

After saving the server, restart the app before testing `who_am_i` or `list_apps`.

## Hosted Streamable HTTP

Build and start the HTTP entry point with:

```bash
pnpm build
pnpm start:http
```

It exposes:

- `POST /mcp`: stateless MCP Streamable HTTP endpoint
- `GET /healthz`: liveness check
- `GET /readyz`: readiness check

TLS is terminated by the production ingress. Every `/mcp` request must include
`Authorization: Bearer <token>`. The process creates an isolated MCP server and
Bugfender API client for that request; the token is neither shared nor persisted.

Hosted configuration:

- `BUGFENDER_API_URL` (default `https://dashboard.bugfender.com/api`)
- `BUGFENDER_MCP_HOST` (default `0.0.0.0`)
- `BUGFENDER_MCP_PORT` (default `3002`)
- `BUGFENDER_MCP_MAX_REQUEST_BYTES` (default `1048576`)
- `BUGFENDER_MCP_MAX_RESPONSE_BYTES` (default `524288`)
- `BUGFENDER_MCP_MAX_CONCURRENCY` (default `100`)
- `BUGFENDER_MCP_REQUEST_TIMEOUT_MS` (default `35000`)
- `BUGFENDER_MCP_SHUTDOWN_TIMEOUT_MS` (default `10000`)

The hosted entry point uses JSON response mode within the Streamable HTTP
protocol. It is intentionally stateless, so `GET` and `DELETE` on `/mcp` return
`405 Method Not Allowed`.

## Tools

- `who_am_i`
- `list_teams`
- `list_apps`
- `get_app`
- `list_app_versions`
- `get_sdk_snippet`
- `get_crashes`
- `get_crash_stats`
- `get_crash_device_stats`
- `get_crash_details`
- `search_logs`
- `count_logs`
- `count_devices_with_logs`
- `get_network_aggregates`
- `get_network_details`
- `search_devices`
- `count_devices`
- `list_issues`
- `get_issue`
- `update_issue_status`
- `get_issue_stats`
- `get_issue_device_stats`
- `get_issue_devices`
- `get_feedback`
- `get_app_summary`

## Resources

- `bugfender://snippet/{app_id}/{platform}`
- `bugfender://app/{app_id}/logs?...`
- `bugfender://issue/{issue_id}?app_id={app_id}`

## Companion Skills

The companion skills now live in the separate [`bugfender/bugfender-skills`](https://github.com/bugfender/bugfender-skills) repository. They encode opinionated workflows on top of the MCP tools:

- use aggregation before logs
- narrow time ranges early
- size impact before deep-diving
- end with a short triage summary

The MCP package gives the agent raw Bugfender capabilities. The skill adds an opinionated investigation workflow on top of those capabilities.

Use the skill when you want Cursor, Codex, or Claude Code to do things like:

- help set up the Bugfender SDK in an app with the minimum required steps
- fetch the SDK snippet for a platform and explain exactly where it goes
- investigate the top crashes in an app
- summarize issue or feedback trends over a time range
- compare impact before and after an app version
- identify likely cause, scope, and next checks

The investigation skill source lives in:

- `https://github.com/bugfender/bugfender-skills/tree/main/skills/bugfender`

## SDK Setup Skill

The dedicated onboarding skill also lives in [`bugfender/bugfender-skills`](https://github.com/bugfender/bugfender-skills).

Use it when you want Cursor, Codex, or Claude Code to:

- detect the project platform automatically
- fetch the correct Bugfender SDK snippet
- map the setup to the real repository files
- ask one short feature question when optional capabilities like crash reporting or Android logcat matter
- apply the minimum integration changes
- reduce the developer’s work to one final verification step

It also includes platform-specific references for:

- iOS
- Android
- Flutter
- Unity
- .NET MAUI
- Cordova
- Ionic
- Angular
- React
- Vue
- JavaScript
- jQuery
- Titanium
- Web
- React Native

The skill source lives in:

- `https://github.com/bugfender/bugfender-skills/tree/main/skills/bugfender-sdk-setup`

## Install Skills In Cursor, Codex, Or Claude Code

Cursor, Codex, and Claude Code can install the skills directly from GitHub without cloning the repo manually.

In the agent chat inside your IDE, run this prompt with the built-in installer skill:

```text
Use $skill-installer to install these skills from https://github.com/bugfender/bugfender-skills:
- skills/bugfender
- skills/bugfender-sdk-setup
```

After installation, restart the client and use:

```text
Use $bugfender-sdk-setup to set up Bugfender in this app with the minimum required changes.
```
