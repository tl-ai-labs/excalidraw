# Discovery — Tier 1 (first-time)

- Run: `20261104-061406-bugfix-eyedropper-dark-theme`
- Built: 2026-11-04T00:44:54Z, plugin mmo 0.9.3
- Scan was quick; no sampling or timebox truncation needed (1267 tracked files).

## Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` on branch `EX-BF-04/opus55-only`, working tree **clean**.
- Remote `origin` → https://github.com/tl-ai-labs/excalidraw.git
- This folder is a **git worktree** (gitdir: `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git/worktrees/EX-BF-04`). The git root matches the run folder.
- `.gitignore` does **not** list `.sdlc/` (`gitignore_covers_sdlc: false`). However `.sdlc/` is excluded through the main repo's `.git/info/exclude` (line 7), so `git add -A` ignores it here. That exclude is local only: it does not travel with the repo.

## Topology
Yarn-workspaces monorepo. Top level: `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `excalidraw-app/`, `examples/` (with-nextjs, with-script-in-browser), `dev-docs/` (Docusaurus site), `firebase-project/`, `public/`, `scripts/`, `.github/`, `.husky/`, `.codesandbox/`.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/{common,element,math,utils}/src/index.ts`.

Upcoming bugfix target area (presence only): `packages/excalidraw/components/EyeDropper.tsx`, `packages/excalidraw/components/EyeDropper.scss`, existing test `packages/excalidraw/tests/eyeDropper.test.tsx`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | React 19 types, Vite 5, Vitest 3 (jsdom, vitest-canvas-mock), TypeScript 5.9, Yarn 1.22 workspaces |
| `packages/excalidraw/package.json` | node-typescript | react, jotai, jotai-scope |
| `excalidraw-app/package.json` | node-typescript | react, jotai, vite |
| `examples/with-nextjs/package.json` | node-typescript | next, react |

No Python/Go/Rust/Java manifests. No shipped adapter matches React/TypeScript (only `generic`, `nest`, `python` ship), so **Tier 2b adaptive stack profile is triggered** (condition 1). Not run here; it waits for Gate 0 approval.

## Test / build commands
- Proposed: **`yarn test:app --watch=false`** (source: `package.json#scripts.test` → `yarn test:app` → `vitest`; `yarn.lock` present). Plain `yarn test` starts Vitest in **watch mode**, so non-interactive runs need `--watch=false`.
- Targeted for this bugfix: `yarn test:app --watch=false packages/excalidraw/tests/eyeDropper.test.tsx`
- CLAUDE.md asks for `yarn test:update` (full suite, updates snapshots) before committing and `yarn test:typecheck` (`tsc`) for types. `yarn test:update` rewrites snapshot files, so it can change files outside a narrow scope.
- Lint: `yarn test:code` (eslint, max-warnings=0); format: `yarn test:other` (prettier).
- No workspace package defines its own `test` script; everything runs from the root `vitest.config.mts`.
- Gate 0 must confirm the command. Tests were **not** run here (Tier 1); pass/fail status at baseline is unknown.

## Docs
`README.md`, `CLAUDE.md`, `CONTRIBUTING.md` (points to docs.excalidraw.com), `dev-docs/README.md`, package READMEs in `packages/{excalidraw,common,element,math,utils,laser-pointer}`, `examples/with-nextjs/README.md`. No ARCHITECTURE.md, AGENTS.md or ADR directory.

## Detected AI/agent setup
- `CLAUDE.md` — project Claude Code instructions (monorepo layout, test/typecheck/fix commands).
- `.github/copilot-instructions.md` — Copilot coding standards (TypeScript/React guidelines: prefer immutable data, `?.`/`??`, performance over allocations).
- Not present: `.claude/`, `CLAUDE.local.md`, `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (1 key: `VITE_DEBUG_DOM`). All `MODE`/`VITE_APP_*`/`FAST_REFRESH` names. No `.env` or `.env.local` present.
- Referenced in code via `import.meta.env` / `process.env`: 24 names (see `baseline.json`), including `VITE_APP_DISABLE_SENTRY`, `VITE_APP_GIT_SHA`, `VITE_WORKER_ID`, `PKG_NAME`, `PKG_VERSION`, `IS_PREACT`.

## Monorepo, submodules, LFS
- Monorepo: Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`), 10 packages. No nx/turbo/lerna/rush/pnpm.
- Submodules: none.
- LFS: none (`.gitattributes` only sets `* text=auto eol=lf`).
- Generated files: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`.

## Infra hints
`Dockerfile`, `docker-compose.yml`, `.github/workflows/` (test, lint, size-limit, test-coverage-pr, docker build/publish, autorelease, sentry, etc.), `vercel.json`, `.husky/` pre-commit with `lint-staged`, `.codesandbox/`. No Terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None found. `regulated_repo_warning_required: false`.

## Coexistence risks
- **Copilot instructions** at `.github/copilot-instructions.md`: the plugin will never touch them. The style rules there match CLAUDE.md conventions and can inform the change spec.
- **`.sdlc/` not in `.gitignore`**: your `.gitignore` doesn't cover `.sdlc/`. In this clone it is excluded via `.git/info/exclude`, so it is currently hidden from `git add -A`, but that protection is local and not committed. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
- **Husky pre-commit hooks**: any commit will run `lint-staged` (eslint/prettier). If formatting is off, the commit fails rather than going through silently.
- **Snapshot updates**: `yarn test:update` (the CLAUDE.md pre-commit step) rewrites `__snapshots__` files. Any snapshot diff should be reviewed, not taken as noise.
- No Cursor, Aider, MCP or repo-local routing-policy conflicts.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.mcp.json`, `.cursor/**`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `routing-policy.yaml`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `target/**`, `vendor/**`, `third_party/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**` (plugin-managed).
