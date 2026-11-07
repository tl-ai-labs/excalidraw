# Brownfield discovery (Tier 1)

- Run: `20261106-162734-feature-extend-lasso-wrap-overlap` (mode: first-time)
- Built: 2026-11-06T10:59:50Z, plugin mmo 0.10.1
- Intent hint: feature-extend. Make the free-form lasso selection follow the same Wrap/Overlap box-selection preference that rectangle box selection already uses.

## Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on branch `EX-FE-04/opus55-plus-flash38-v2` (a git worktree; the main checkout is at `/Users/macbook/Desktop/Work/AI studies TL/excalidraw`)
- Working tree clean (`git_dirty: false`)
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry. `.sdlc/` is ignored right now only through the shared `.git/info/exclude` (line 7) of the main checkout.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (the excalidraw.com app), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`. There is no root `src/`. The editor code is in `packages/excalidraw/` and `packages/element/`.

Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx` (app).

Git tracks 1267 files, so no sampling was needed.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| package.json (root) | node-typescript | React 19 types, Vite 5, Vitest 3, Yarn 1 workspaces, TS 5.9 strict |
| packages/excalidraw/package.json | node-typescript | react, jotai |
| excalidraw-app/package.json | node-typescript | react, jotai, vite |
| examples/with-nextjs/package.json | node-typescript | next, react |
| examples/with-script-in-browser/package.json | node-typescript | react, vite |
| dev-docs/package.json | node-javascript | docusaurus (not a workspace member) |

The main stack is React and TypeScript. None of the shipped stack adapters fit it: generic.md, nest.md and python.md are the only ones. **Tier 2b adaptive stack profile is triggered.** This Tier 1 pass did not build it.

## Test / build commands
- **Proposed:** `yarn test --watch=false`. The chain is `scripts.test` -> `yarn test:app` -> `vitest`. Yarn was chosen because `yarn.lock` is present.
- Targeted run for this intent: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
- Other checks: `yarn test:typecheck` (tsc) and `yarn test:code` (eslint, max-warnings 0).
- CLAUDE.md asks for `yarn test:update` before committing. That command rewrites snapshots.
- No package has its own `test` script. Vitest runs from the repo root and uses the path aliases in `vitest.config.mts`.
- Gate 0 must confirm the command.

## Docs
README.md, CLAUDE.md (monorepo layout plus commands), CONTRIBUTING.md (points to docs.excalidraw.com), `.github/copilot-instructions.md`, `dev-docs/` (Docusaurus: `docs/@excalidraw`, `docs/codebase`, `docs/introduction`), and READMEs for each package. There are no ADR directories, and no AGENTS.md or ARCHITECTURE.md.

## Detected AI/agent setup
- `.claude/` (Claude Code project config), which holds `.claude/settings.local.json`. `.gitignore` excludes `.claude` (line 29).
- `CLAUDE.md`: project instructions. It does not declare a custom framework.
- `.github/copilot-instructions.md`: GitHub Copilot coding standards (be brief, prefer immutable data, use `?.`/`??`, favor performance).
- Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env file keys (names only)
- `.env.development` (20 keys), `.env.production` (15 keys) and `.env.test` (1 key) are **tracked in git**. They hold the public `VITE_APP_*` build config. No `.env` or `.env.local` exists. `.gitignore` excludes the `*.local` variants and `.envrc`.
- Env names the code references: the `VITE_APP_*` set, plus `MODE`, `DEV`, `PROD`, `PKG_NAME`, `PKG_VERSION`, `IS_PREACT`, `PR_TITLE`, `VITE_DEBUG_DOM`, `VITE_WORKER_ID`, `VITE_APP_GIT_SHA` and `VITE_APP_DISABLE_SENTRY`.

## Monorepo / submodules / LFS
- Monorepo type: Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). There is no nx, turbo, lerna, pnpm or rush.
- Submodules: none.
- LFS: none. `.gitattributes` holds only `* text=auto eol=lf`.

## Infra hints
Dockerfile, docker-compose.yml, vercel.json, firebase-project/, Husky and lint-staged pre-commit hooks, and 11 GitHub workflows (including test.yml, lint.yml, size-limit.yml and test-coverage-pr.yml).

## Regulated-repo signals
None found. `regulated_repo_warning_required: false`.

## Feature orientation (for the intent)
- Lasso: `packages/excalidraw/lasso/index.ts`, `packages/excalidraw/lasso/utils.ts`, test `packages/excalidraw/tests/lasso.test.tsx`
- Files that mention the box-selection mode or wrap/overlap: `packages/element/src/selection.ts`, `packages/element/src/bounds.ts`, `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/data/restore.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/main-menu/DefaultItems.tsx`, tests `packages/excalidraw/tests/selection.test.tsx` and `packages/element/tests/bounds.test.ts`

## Coexistence risks
- `.claude/` holds Claude Code project config, including settings.local.json. The plugin leaves it untouched.
- GitHub Copilot instructions are at `.github/copilot-instructions.md`. The plugin never touches them. Their style rules are still worth reading.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Right now `.sdlc/` is hidden only by the main checkout's shared `.git/info/exclude`. That covers this worktree, but a fresh clone would not have it.)
- Husky and lint-staged pre-commit hooks run prettier and eslint on every commit.
- Snapshot tests exist (`packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`). `yarn test:update` would rewrite them silently, so look over any snapshot diffs.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.envrc`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `excalidraw-app/dev-dist/**`, `.next/**`, `**/.next/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` (generated), `packages/excalidraw/subset/woff2/woff2-wasm.ts` (generated), `.git/**`, `.sdlc/**`

## Notes
The Tier 1 scan finished well within the timebox, with no read failures and no sampling.
