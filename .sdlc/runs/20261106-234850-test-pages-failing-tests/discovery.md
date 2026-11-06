# Discovery: 20261106-234850-test-pages-failing-tests

Mode: refresh, decision **incremental** (`discovery-refresh.mjs`: 167 files changed since baseline, 1 commit; no stack manifest changed; policy unchanged).
Baseline before: HEAD `14bb42ed`, built 2026-11-06T04:44:02Z. Now: HEAD `b0fdf640`, built 2026-11-06T18:19:55Z.
Rescanned: git state, AI-config presence, env references in the delta, regulated signals, docs delta. Carried forward unchanged: topology, stacks, test scripts, monorepo/submodules/LFS. Stack profile (`.sdlc/baseline/stack-profile.md`) reused, not rebuilt.

## Git state
- Branch `EX-NF-12/opus55-plus-flash38-v2`, HEAD `b0fdf640` ("EX-NF-12 opus55-plus-flash38-v2: run and evidence"), clean, up to date with origin.
- Remote: origin `https://github.com/tl-ai-labs/excalidraw.git`.
- Git worktree; common dir `/Users/macbook/Documents/GitHub/excalidraw/.git`.
- `gitignore_covers_sdlc: false`. `.sdlc/` is ignored only through the main clone's `.git/info/exclude` (line 7), and **115 `.sdlc/` files are tracked** (force-added in b0fdf640).

## Delta since baseline (b0fdf640)
Drawing-pages feature: 52 source/test/doc files, plus 115 `.sdlc/` files. New files: `packages/element/src/pages.ts`, `packages/excalidraw/actions/actionPages.ts`, `packages/excalidraw/components/PagesTabBar/PagesTabBar.{tsx,scss}`, `packages/element/tests/pages.test.ts`, `packages/excalidraw/tests/data/pages.test.ts`, `packages/excalidraw/tests/pages.test.tsx`. Also edits to Scene, history, App, SearchMenu, data/restore/json/blob, the collab layer in excalidraw-app, and regenerated snapshots (history, regressionTests, contextmenu, export, excalidraw, Mermaid). No package.json or lockfile changes.

## Detected stacks
Unchanged: Node/TypeScript yarn-workspaces monorepo (yarn 1.22.22, TS strict). React + Vite + Vitest, jotai, radix-ui, esbuild (packages), firebase/socket.io (app), Next.js example, Docusaurus dev-docs (not a workspace member). Stack profile `.sdlc/baseline/stack-profile.md` still applies (no pre-authored React adapter).

## Test command
- Proposed for this run: `yarn test:app --watch=false packages/excalidraw/tests/pages.test.tsx` (vitest via `package.json#scripts.test:app`).
- Repo-wide: `yarn test:app --watch=false`. Also `yarn test:typecheck` (tsc). CLAUDE.md's `yarn test:update` rewrites snapshots, so avoid it unless a snapshot change is intended.
- Target file: `packages/excalidraw/tests/pages.test.tsx` (16 tests in `describe("pages")`).

## Docs
Unchanged set (README, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, copilot-instructions, dev-docs, package READMEs, CHANGELOG). The delta changed only the content of `dev-docs/docs/codebase/json-schema.mdx` and `packages/excalidraw/CHANGELOG.md`.

## Detected AI/agent setup
- `.claude/` with `settings.local.json`
- `CLAUDE.md`, `AGENTS.md`
- `.github/copilot-instructions.md`
- None found: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`.

## Env keys
Unchanged (names only): `.env.development`, `.env.production`, `.env.test` are tracked. The delta adds no new env references.

## Monorepo / submodules / LFS / infra
Unchanged: yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`), one root `vitest.config.mts`. No submodules, no LFS. Dockerfile, docker-compose, GitHub workflows, vercel.json, firebase-project.

## Regulated-repo signals
None. `regulated_repo_warning_required: false`.

## Coexistence risks
- Claude Code config (`.claude/settings.local.json`, CLAUDE.md, AGENTS.md) and Copilot instructions are present. The run leaves them untouched.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Locally they are hidden by the main clone's `.git/info/exclude`, but 115 `.sdlc/` files are already tracked, so edits to them show up in git.)
- Husky + lint-staged pre-commit hooks run eslint/prettier on commit.
- `.sdlc/local/write-contract.json` is inactive and still holds the previous run's allowlist (pages feature, broad). Gate 0 must replace it with this run's scope.

## Repo-state risks
1. **3 tests fail before this run starts**, all in `packages/excalidraw/tests/pages.test.tsx` (reported by the caller; discovery did not re-run them):
   - "deletes a page via the menu" (line 172)
   - "keeps undo on its page" (line 313)
   - "finds text on another page and switches to it" (line 356)
   Verification must compare against this failing pre-run state, not a green baseline.
2. HEAD is one large commit (167 files, ~30k insertions) with regenerated snapshots. `yarn test:update` would silently re-bless snapshots, so keep to a non-updating test command.
3. `.sdlc/` is tracked at HEAD. Refreshing `.sdlc/baseline/current.json` (done by this discovery) modifies a tracked file, so `git status` now shows it as modified.
4. Worktree shares its stash stack with other worktrees (`/Users/macbook/Documents/GitHub/excalidraw/.git`).

## Likely-relevant modules for the 3 failures
- Delete via menu: `packages/excalidraw/actions/actionPages.ts`, `packages/excalidraw/components/PagesTabBar/PagesTabBar.tsx`, `packages/element/src/pages.ts`
- Undo per page: `packages/excalidraw/history.ts`, `packages/element/src/store.ts`, `packages/element/src/delta.ts`, `packages/excalidraw/components/App.tsx`
- Cross-page search: `packages/excalidraw/components/SearchMenu.tsx`, `packages/excalidraw/components/App.tsx`
- Test helpers: `packages/excalidraw/tests/helpers/api.ts`, `packages/excalidraw/tests/helpers/ui.ts`, `packages/excalidraw/tests/test-utils.ts`

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**`
