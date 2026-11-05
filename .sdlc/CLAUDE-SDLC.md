# SDLC plugin context (plugin-owned)

This file is maintained by the mmo plugin. It is not imported into `CLAUDE.md`, which is off-limits to plugin runs.

## Project fingerprint

- Stack: TypeScript + React 19 monorepo, Yarn 1 workspaces, Vitest 3 in jsdom (profile: `baseline/stack-profile.md`)
- Baseline git head: `14bb42edee3d6fee6be264e3ee78670b3b9cee79` (built 2026-11-05)
- Default policy: `argon4-agsdk-only` (`project.json`)
- Test command used by runs: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
  (never `yarn test:update`, which rewrites snapshots)
- Off-limits AI configs: `.claude/settings.local.json`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

## Run history

See [ledger.md](ledger.md) (machine mirror: `ledger.json`). Last run: `20261105-152345-feature-extend-arrowhead-size`
(feature-extend, accepted 2026-11-05, uncommitted).
