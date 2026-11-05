# Brownfield discovery: excalidraw-2

- Run: `20261105-105313-feature-new-text-range-styles` (intent hint: feature-new)
- Mode: first-time (full Tier 1 scan, then Tier 2b stack profile)
- Built: 2026-11-05T05:25:55Z, plugin 0.10.1

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-11/argon4-agsdk-only`. Working tree is clean.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- This folder is a git worktree of `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw`. Its git toplevel is this folder, so the precondition passes. The stash stack is shared with the main checkout.
- 1327 tracked files, so no large-repo sampling was needed.
- `.gitignore` does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`). However, `.sdlc/` **is** excluded by `.git/info/exclude` (line 7 of the main repo, shared by all worktrees, not committed), so `git add -A` will not stage it in this clone.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/`, `scripts/`.
- `packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`
- `excalidraw-app/`: `app-language`, `collab`, `components`, `data`, `share`, `tests`
- `examples/`: `with-nextjs`, `with-script-in-browser`
- `dev-docs/`: Docusaurus site (`docs`, `src`, `static`)
- `scripts/`: `stats`, `wasm`, `woff2`

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | Yarn 1 workspaces, Vitest 3, TypeScript 5.9 strict |
| `packages/excalidraw/package.json` | node-typescript | React 19, Jotai, esbuild build |
| `excalidraw-app/package.json` | node-typescript | React, Vite 5, Jotai, Firebase, socket.io-client |
| `examples/with-nextjs/package.json` | node-typescript | Next.js, React |
| `dev-docs/package.json` | node-typescript | Docusaurus (not a workspace member) |

The primary stack is **React + TypeScript**. The plugin ships no adapter for it (only `generic`, `nest`, `python`), so the Tier 2b stack profile ran and its output is at `.sdlc/baseline/stack-profile.md`.

## Test / build / run
- **Proposed test command:** `yarn test:app --watch=false`. It comes from `package.json#scripts.test`, which maps to `test:app` = `vitest`. `yarn.lock` is present.
  - Plain `yarn test` starts Vitest in **watch mode**, so non-interactive runs need `--watch=false`.
  - CLAUDE.md says: "Always run `yarn test:update` before committing" (that is `vitest --update --watch=false`, which rewrites snapshots).
  - Type check: `yarn test:typecheck` (`tsc`). Lint: `yarn test:code` (eslint, max-warnings 0). Format: `yarn test:other` (prettier).
  - To run one file or folder: `yarn test:app --watch=false packages/element/tests/<file>`.
- Gate 0 should confirm which of these Phase 7 runs, and whether snapshot updates are allowed.
- Builds: `yarn build:packages` (esbuild, per package), `yarn build` (app via Vite). Dev server: `yarn start`.

## Docs
- `README.md`: product landing page (an open-source hand-drawn whiteboard).
- `CLAUDE.md`: monorepo layout, `yarn test:update` / `yarn test:typecheck` / `yarn fix`, path aliases in `vitest.config.mts`.
- `AGENTS.md`: use `app.ownerDocument` / `app.ownerWindow` instead of DOM globals; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<…> & …`.
- `.github/copilot-instructions.md`: TypeScript and React coding standards (prefer immutable data and `?.`/`??`, avoid allocation, favour performance).
- `CONTRIBUTING.md`: a link to the docs site.
- `dev-docs/docs/` (Docusaurus): `@excalidraw`, `codebase`, `introduction`.
- Package READMEs: `packages/{excalidraw,common,element,math,utils,laser-pointer}/README.md`, `examples/with-nextjs/README.md`.
- No ADR directory.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/settings.local.json` | claude-code-local-settings (`.claude` is gitignored) |
| `CLAUDE.md` | claude-instructions |
| `AGENTS.md` | agents-instructions |
| `.github/copilot-instructions.md` | copilot-instructions |

Not present: `.claude/settings.json`, `CLAUDE.local.md`, `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env file keys
- Env files present: `.env.development`, `.env.production`, `.env.test`. **All three are tracked in git.** They are Vite build-time env files. Local overrides (`.env.local`, `.env.*.local`) are gitignored, and none exist.
- **Per-file key names were not collected:** the permission system denied reading the env files twice. No values were read. Gate 0 can ask the user if key names are needed.
- Env names referenced in code (`process.env.*` and `import.meta.env.*`):
  - `VITE_APP_*`: `AI_BACKEND`, `BACKEND_V2_GET_URL`, `BACKEND_V2_POST_URL`, `DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX`, `DISABLE_PREVENT_UNLOAD`, `DISABLE_SENTRY`, `ENABLE_TRACKING`, `FIREBASE_CONFIG`, `GIT_SHA`, `LIBRARY_BACKEND`, `LIBRARY_URL`, `PLUS_APP`, `PLUS_EXPORT_PUBLIC_KEY`, `PLUS_LP`, `WS_SERVER_URL`
  - Other names: `VITE_DEBUG_DOM`, `VITE_WORKER_ID`, `DEV`, `MODE`, `PROD`, `PKG_NAME`, `PKG_VERSION`, `IS_PREACT`, `OSS_STATS_API_URL`, `OSS_STATS_TOKEN`, and the CI names `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SERVER_URL`, `GITHUB_SHA`, `PR_TITLE`, `RUNNER_NAME`

## Source topology, monorepo, submodules, LFS
- **Monorepo:** Yarn 1 workspaces (`excalidraw-app`, `packages/*`, `examples/*`). No nx, turbo, lerna, rush or pnpm.
- Internal imports go through path aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/excalidraw/*`). These are defined in `tsconfig.json` paths and `vitest.config.mts` aliases.
- No workspace package has its own `test` script. One root Vitest config runs every test.
- Entry points: `packages/excalidraw/index.tsx` (library), `packages/excalidraw/components/App.tsx` (editor class, about 11.5k lines, split into `App.*.ts` helper modules), `packages/{common,element,math,utils}/src/index.ts`, `excalidraw-app/index.tsx` and `App.tsx`.
- **Submodules:** none. **LFS:** none (`.gitattributes` only sets `* text=auto eol=lf`).
- Generated files (first-5-line marker): `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`.
- Infra: `Dockerfile`, `docker-compose.yml`, `vercel.json`, 12 GitHub workflows (`test.yml`, `lint.yml`, `size-limit.yml`, `stats.yml`, `test-coverage-pr.yml`, …), Husky plus lint-staged pre-commit hooks.

## Regulated-repo signals
None found. No `SECURITY.md`, `PRIVACY.md` or compliance files, no HIPAA/PCI/SOC2 directories, no CODEOWNERS. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored:** "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
  - Mitigation already in place: `.git/info/exclude` lists `.sdlc/`, so in this local clone `git add -A` will not stage run artifacts. Adding the `.gitignore` entry is optional here, and doing so would be a committed change to a tracked file.
- **Claude Code local settings** at `.claude/settings.local.json`: the plugin never touches them.
- **Agent instruction files** (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`): read as guidance, off-limits for edits by default.
- **Husky pre-commit hook** runs lint-staged (eslint/prettier) on commit. Commits the plugin makes may be reformatted or rejected by the hook.
- **Worktree:** the stash stack is shared with `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw` and other worktrees. Never use bare `git stash pop`.
- **Snapshot tests:** `yarn test:update` rewrites `__snapshots__/` files. Gate 0 should decide whether those files are in scope.

## Proposed off-limits
- `.env`, `.env.*`, `.env.local`
- `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`
- `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `.next/**`, `**/.next/**`, `excalidraw-app/dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`
- `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts` (generated)
- `.git/**`, `.sdlc/**`

## Scan notes
- The full Tier 1 scan finished inside the timebox, and no sampling was needed.
- Gap: env-file key names (Group 7, per file) were not collected because reading them was denied.
