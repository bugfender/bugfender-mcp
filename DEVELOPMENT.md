# Development

## Local Setup

```bash
pnpm install
pnpm check
pnpm build
```

Build output is generated in `dist/`.

## Repository Layout

```text
src/                  MCP server source
dist/                 generated build output
skills/bugfender/     companion investigation skill
README.md             public package docs
DEVELOPMENT.md        maintainer development notes
RELEASING.md          release and publish workflow
LICENSE               Apache-2.0 license
```

## Development Notes

- `src/` is the source of truth.
- `dist/` is generated and should not be committed.
- `node_modules/` should not be committed.
- `pnpm-lock.yaml` is the maintainer lockfile.
- the published npm tarball includes only `dist/**/*`, `README.md`, and `LICENSE`

## Public Repo Checklist

Keep:

- `src/`
- `skills/bugfender/`
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
