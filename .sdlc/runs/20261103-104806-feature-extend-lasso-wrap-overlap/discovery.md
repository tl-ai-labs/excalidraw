# Discovery — 20261103-104806-feature-extend-lasso-wrap-overlap

Mode: first-time (full Tier 1 scan, plus the Tier 2b stack profile). Built 2026-11-03T05:19:48Z by plugin mmo 0.9.3.

## Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on branch `EX-FE-04/opus55-only` (clean working tree)
- Remote `origin` = https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree**. The stash stack is shared with other worktrees, so use WIP commits rather than a bare `git stash`.
- 1267 tracked files, so no sampling was needed.
- `.gitignore` does **not** cover `.sdlc/`. It does ignore `.claude`.

## Directory topology
Top level: `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus site), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (excalidraw.com app), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.

Entry points: `packages/excalidraw/index.tsx` (library), `packages/*/src/index.ts`, `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`.

## Detected stacks
- Node / TypeScript (TS 5.9.3, `strict: true`, ESNext modules, `jsx: react-jsx`). Node >= 18. The package manager is yarn 1.22.22.
- Frameworks: React 19, Jotai (state), Vite 5 (app build), esbuild (package builds), Vitest 3 with jsdom and vitest-canvas-mock, and Next.js (example only).
- There is no pre-authored adapter for React/TS (only generic, nest and python are available), so the **Tier 2b stack profile was generated** at `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: `yarn test:app --watch=false` (`scripts.test` is `yarn test:app`, which is `vitest`. Without `--watch=false` it stays in watch mode.)
- Scoped to the feature area: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx`
- CLAUDE.md prescribes `yarn test:update` (vitest `--update --watch=false`, which rewrites snapshots) and `yarn test:typecheck` (`tsc`).
- Other commands: `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier), `yarn test:all` (all of the above), `yarn fix`.
- **Gate 0 must confirm the command.** The test baseline was not run in Tier 1, so whether any tests already fail is unknown.

## Docs present
- `README.md` (Excalidraw marketing/readme)
- `CLAUDE.md` (monorepo layout and commands)
- `CONTRIBUTING.md` (points to docs.excalidraw.com)
- `dev-docs/README.md` (Docusaurus)
- `packages/excalidraw/README.md`
- `.github/copilot-instructions.md` (coding standards: performance-first TS, immutable data, `?.`/`??`, plus React guidelines)

There are no ADR directories.

## Detected AI/agent setup
- `CLAUDE.md` (claude-instructions, tracked)
- `.github/copilot-instructions.md` (copilot)
- `.claude/` is absent in the worktree but gitignored. Neither `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/` nor any `routing-policy.yaml` / `gemini*.{yaml,json}` was found.

## Env keys
- Env files present **and tracked in git**: `.env.development`, `.env.production`, `.env.test`.
- Key names per file were **not collected**: the permission system denied the read of the env files during this run. No values were read.
- Env names referenced in code (via `import.meta.env` / `process.env`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PROD, PR_TITLE, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID.

## Monorepo / submodules / LFS
- Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`), with 10 workspace packages. No nx/turbo/lerna/pnpm.
- A single root vitest config (`vitest.config.mts`) maps `@excalidraw/*` to the package sources. Per-package scripts have no `test` script; tests run from the root.
- Submodules: none. LFS: none (`.gitattributes` is only `* text=auto eol=lf`).

## Infra hints
`Dockerfile`, `docker-compose.yml`, `vercel.json`, and the `.github/workflows/` (test.yml, lint.yml, size-limit.yml, test-coverage-pr.yml, and others). Husky and lint-staged pre-commit hooks are active.

## Regulated-repo signals
None detected.

## Feature context (intent: feature-extend, lasso wrap/overlap)
- Lasso code is in `packages/excalidraw/lasso/index.ts` (`LassoTrail extends AnimatedTrail`) and `packages/excalidraw/lasso/utils.ts` (`getLassoSelectedElementIds`). The tests are in `packages/excalidraw/tests/lasso.test.tsx` (1804 lines).
- Current lasso semantics: the selection is the union of **enclosed** elements (any segment point inside the lasso polygon, via `polygonIncludesPointNonZero`) and **intersected** elements (a lasso segment hits the element or its bound text). There is no mode switch.
- The closest existing analogue is box selection's `boxSelectionMode: "contain" | "overlap"`:
  - type at `packages/excalidraw/types.ts:280`, with the AppState field at `:357`
  - defaults and storage config at `packages/excalidraw/appState.ts:132,203`
  - consumed in `packages/element/src/selection.ts:76` and `packages/element/src/bounds.ts:1287+`
  - wired in `packages/excalidraw/components/App.tsx:11311`
  - UI radio in `packages/excalidraw/components/main-menu/DefaultItems.tsx:443` (`PreferencesBoxSelectionModeItem`)
  - i18n keys `labels.boxSelectionMode/Contain/Overlap` in `packages/excalidraw/locales/en.json`
- Snapshot tests (`**/__snapshots__/`) serialize AppState. Adding an AppState field will likely require snapshot updates (`yarn test:update`).

## Coexistence risks
- CLAUDE.md and `.github/copilot-instructions.md` are present. The plugin will never touch them. Their conventions (yarn test:update before commit, the performance-first TS rules) are worth honoring.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
- `.env.development`, `.env.production` and `.env.test` are committed to git. They are off-limits by default.
- Husky and lint-staged pre-commit hooks run prettier and eslint on commit, which may reformat staged files.
- Git worktree: the stash stack is shared with other worktrees and sessions.
- `.sdlc/pre-check-status.json` shows `ok: false`. `discovery_smoke` is pending (the orchestrator posts it) and `test_command_probe` was skipped.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/**`, `.mcp.json`, `.cursor/**`, `node_modules/**` (and nested), `dist/**`, `build/**` (and nested), `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated d.ts output), `.husky/_/**`, `.sdlc/**`, `.git/**`.

`**/__snapshots__/**` are generated but test-managed. Change them only via `yarn test:update`, never by hand.

## Notes
- Scan completed well within the timebox.
- The project-level default off-limits in `.sdlc/project.json` also list `.cursor/rules/**` and `.claude/settings.local.json`, and both are covered above.
