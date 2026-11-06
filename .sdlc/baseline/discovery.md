# Brownfield discovery: excalidraw-4

- Run: `20261106-152507-feature-extend-arrowhead-size` (intent hint: `feature-extend`)
- Mode: first-time (full Tier 1 scan). Finished inside the timebox. No sampling needed (1327 tracked files).
- Plugin: mmo 0.10.1

## Git state
- HEAD: `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/argon4-plus-flash38`
- Working tree: **clean** (`dirty: false`)
- This folder is a **git worktree**. Its common git dir is `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw/.git`. The toplevel is the same as the cwd.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry. `.sdlc/` is ignored **only** through the main checkout's shared `.git/info/exclude` (line 7: `.sdlc/`), and `git check-ignore` confirms it. So `git add -A` will not stage `.sdlc/` here. That protection is local to this machine and is not committed.

## Directory topology
Top-level dirs: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`.
- `packages/` holds `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`
- `excalidraw-app/` holds `app-language`, `collab`, `components`, `data`, `share`, `tests`
- `examples/` holds `with-nextjs`, `with-script-in-browser`
- `dev-docs/` is the Docusaurus docs site (it has its own yarn.lock and is not a root workspace)

Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx` (app).

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` | node-typescript | react, vite, vitest, yarn-workspaces |
| `packages/excalidraw/package.json` | node-typescript | react, jotai |
| `excalidraw-app/package.json` | node-typescript | react, vite, jotai, firebase, socket.io-client |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `examples/with-script-in-browser/package.json` | node-typescript | react |
| `dev-docs/package.json` | node-javascript | docusaurus, react |

TypeScript 5.9.3 with `strict: true` and `moduleResolution: bundler`. Path aliases for `@excalidraw/*` are set in `tsconfig.json` and `vitest.config.mts`.

## Test / build commands
- **Proposed test command: `yarn test`.** Source: `package.json#scripts.test`, which runs `yarn test:app` and then `vitest`. Yarn was chosen because `yarn.lock` exists and `packageManager` is `yarn@1.22.22`.
  - On a TTY, plain `yarn test` starts vitest in watch mode. For a single non-interactive run, use `yarn test:app --watch=false`.
- From CLAUDE.md: `yarn test:typecheck` (tsc), `yarn test:update` (updates snapshots, so it writes `__snapshots__`), `yarn fix` (prettier and eslint `--fix`, which modify files).
- `test:all` runs typecheck, eslint, prettier check and vitest.
- **Gate 0 must confirm the test command.**

## Docs present
`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (a pointer to docs.excalidraw.com), `dev-docs/README.md` with `dev-docs/docs/` (Docusaurus), `.github/copilot-instructions.md`. No ADR directories.
- AGENTS.md rules: use `app.ownerDocument`/`app.ownerWindow` rather than globals for DOM APIs. Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & …`.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/` | claude-code-project-dir |
| `.claude/settings.local.json` | claude-code-settings-local (gitignored by `.gitignore`'s `.claude` entry) |
| `CLAUDE.md` | claude-instructions |
| `AGENTS.md` | agents-instructions |
| `.github/copilot-instructions.md` | copilot-instructions |

None of these were found: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, a repo-local `routing-policy.yaml`, or `gemini*.{yaml,json}`.

## Env file keys (names only)
- `.env.development` has 20 keys and `.env.production` has 15, all `VITE_APP_*` plus `MODE` and `FAST_REFRESH`. `.env.test` has 1 key: `VITE_DEBUG_DOM`.
- Code references env through `import.meta.env.*` (Vite) and `process.env.*` (scripts/CI). The full list is in baseline.json.
- These env files are committed, so they hold public config, not secrets. They are still off-limits.

## Monorepo / submodules / LFS
- Monorepo: **Yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`), 10 workspace packages. There are no per-package test scripts. A single root `vitest.config.mts` covers everything, so scope a run with a path filter, e.g. `yarn test:app --watch=false packages/element`.
- Submodules: none.
- LFS: none. `.gitattributes` holds only `* text=auto eol=lf`.
- Encrypted secrets (git-crypt/sops/.pem/.key): none tracked.

## Infra hints
`Dockerfile`, `docker-compose.yml`, `.github/workflows/` (13 workflows, including test, lint, size-limit and stats), `vercel.json`, `firebase-project/`, `.codesandbox/`, Husky `pre-commit` running lint-staged. No terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None found. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored.** "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run." In practice this checkout already ignores `.sdlc/` through the shared `.git/info/exclude` of the main checkout, so `git add -A` will not pick it up here. That protection is local and uncommitted, so the `.gitignore` entry is optional.
- Claude Code project config (`.claude/settings.local.json`) and Copilot instructions (`.github/copilot-instructions.md`) are present. The plugin will not touch them.
- Husky pre-commit with lint-staged: any commit made during the run will trigger prettier and eslint.
- There is no Cursor, Aider, custom MCP or repo-local routing-policy config.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `.claude/settings.local.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**` and `**/node_modules/**`, `dist/**` and `**/dist/**`, `build/**` and `**/build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated), `.git/**`, `.sdlc/**`.

## Notes for this run (arrowhead size)
- Per-arrowhead sizes live in `getArrowheadSize()` in `packages/element/src/bounds.ts` (around line 727). It is tested in `packages/element/tests/bounds.test.ts`.
- The `Arrowhead` types are in `packages/element/src/types.ts` (around lines 342-376). Legacy-name normalisation is in `packages/element/src/arrowheads.ts`.
- The UI action is `actionChangeArrowhead` in `packages/excalidraw/actions/actionProperties.tsx` (around line 1960). Labels are in `packages/excalidraw/locales/en.json`, and restore logic is in `packages/excalidraw/data/restore.ts`.

## Tier 2b
Triggered. The stack is React and TypeScript, and no pre-authored adapter matches it (only generic, nest and python ship). The profile is at `.sdlc/baseline/stack-profile.md`.
