# Discovery: excalidraw (first-time)

- Run: `20261106-bugfix-eyedropper-dark-theme`
- Built: 2026-11-06 (Tier 1, plugin 0.10.1)
- Intent hint: bugfix. In dark theme the eyedropper saves the on-screen dark-mode colour instead of the element's real colour.

## Git state
- HEAD: `4872083c044491b6d5c96ae134a75464f96d6831`
- Branch: `EX-BF-04/argon4-plus-flash38` (main branch: `master`)
- Working tree: clean
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- `.gitignore` covers `.sdlc/`: **no**. But `.git/info/exclude` lists `.sdlc/` (local to this checkout, not shared), so `git add -A` will not stage run artifacts here. `.gitignore` itself ignores `.claude`, `build`, `dist`, `node_modules`, `coverage`, `dev-dist`, `packages/excalidraw/types` and `.env.*.local`.

## Topology
Top-level dirs: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples` (`with-nextjs`, `with-script-in-browser`), `excalidraw-app` (`app-language`, `collab`, `components`, `data`, `share`, `tests`), `firebase-project`, `packages` (`common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`), `public`, `scripts`.

1267 tracked files, 121 test files (`*.test.ts(x)`). No sampling needed.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/{common,element,math,utils}/src/index.ts`.

Orientation for this intent: `packages/excalidraw/components/EyeDropper.tsx`, `packages/excalidraw/components/EyeDropper.scss`, `packages/excalidraw/tests/eyeDropper.test.tsx`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` | node-typescript | React, Vite, Vitest, yarn workspaces (yarn@1.22.22, TypeScript 5.9.3) |
| `excalidraw-app/package.json` | node-typescript | React 19.0.0, Vite |
| `packages/excalidraw/package.json` | node-typescript | React (peer ^17 / ^18 / ^19), esbuild build |
| `examples/with-nextjs/package.json` | node-typescript | Next 14.1, React 19 |
| `dev-docs/package.json` | node-javascript | Docusaurus 2 (not a workspace member) |

No shipped stack adapter fits (we ship `generic.md`, `nest.md`, `python.md`). **The Tier 2b adaptive stack profile applies** (React + TS, not covered). Discovery did not build it (`adaptive_profile: false`); it runs on Gate 0 approval and writes `.sdlc/baseline/stack-profile.md`.

## Monorepo
Yarn workspaces (`package.json#workspaces`: `excalidraw-app`, `packages/*`, `examples/*`). Packages: `excalidraw-app`, `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/excalidraw`, `@excalidraw/fractional-indexing`, `@excalidraw/laser-pointer`, `@excalidraw/math`, `@excalidraw/utils`, `with-nextjs`, `with-script-in-browser`. No workspace defines `scripts.test`. All tests run from the root `vitest.config.mts`, which maps `@excalidraw/*` to the source paths. Per-package run: `yarn test:app --watch=false <package-root>`.

## Test / build commands
- **Proposed:** `yarn test:app --watch=false` (from `package.json#scripts.test` -> `yarn test:app` -> `vitest`; `yarn.lock` present). Plain `yarn test` starts vitest in watch mode on a TTY, so `--watch=false` is added. Gate 0 must confirm.
- Targeted for this intent: `yarn test:app --watch=false packages/excalidraw/tests/eyeDropper.test.tsx`
- Typecheck: `yarn test:typecheck` (`tsc`). CLAUDE.md recommends it.
- CLAUDE.md says to run `yarn test:update` before committing. That passes `--update` and rewrites snapshots, which can hide snapshot regressions. Do not use it as the verification command.
- Lint/format: `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier), `yarn fix`.
- Tests were not run during discovery (Tier 2). Baseline pass/fail is unknown.

## Docs
- `README.md`: product overview (open-source hand-drawn whiteboard).
- `CLAUDE.md`: monorepo layout, yarn workflow, path aliases, esbuild/Vite build. No custom-framework declaration.
- `CONTRIBUTING.md`: points to docs.excalidraw.com.
- `dev-docs/README.md`: Docusaurus site.
- No ADR directories, no `AGENTS.md`, no `ARCHITECTURE.md`.

## Detected AI/agent setup
- `.claude/` (Claude Code project dir), which contains `.claude/settings.local.json`
- `CLAUDE.md` (project instructions)
- Not found: `.mcp.json`, `CLAUDE.local.md`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `.github/copilot-instructions.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`

## Env keys (names only)
- `.env.development`: MODE, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_LIBRARY_URL, VITE_APP_LIBRARY_BACKEND, VITE_APP_WS_SERVER_URL, VITE_APP_PLUS_LP, VITE_APP_PLUS_APP, VITE_APP_AI_BACKEND, VITE_APP_FIREBASE_CONFIG, VITE_APP_DEV_DISABLE_LIVE_RELOAD, VITE_APP_ENABLE_TRACKING, FAST_REFRESH, VITE_APP_PORT, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_COLLAPSE_OVERLAY, VITE_APP_ENABLE_ESLINT, VITE_APP_ENABLE_PWA, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_DISABLE_PREVENT_UNLOAD
- `.env.production`: the same family (15 keys)
- `.env.test`: VITE_DEBUG_DOM
- All three env files are **tracked in git**. Their keys are client-bundled `VITE_*` config (URLs, flags, a public key). Values were not read. They are off-limits.
- Referenced in code (`process.env` / `import.meta.env`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PR_TITLE, PROD, VITE_APP_DISABLE_SENTRY, VITE_APP_GIT_SHA, VITE_WORKER_ID, and the VITE_APP_* keys above.

## Submodules / LFS
- Submodules: none (no `.gitmodules`).
- LFS: none (`.gitattributes` holds only `* text=auto eol=lf`).

## Infra hints
`Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/`, `.codesandbox/`, and `.github/workflows/` (11 workflows, including `test.yml`, `lint.yml`, `test-coverage-pr.yml`, `size-limit.yml`). Husky + lint-staged pre-commit hooks (`.husky/`, `.lintstagedrc.js`). No Terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None detected.

## Coexistence risks
- Claude Code project config at `.claude/settings.local.json`. The plugin never touches it, and it is gitignored.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Locally this is already covered by `.git/info/exclude`, so the risk only applies to other clones.)
- Husky pre-commit hooks run lint-staged (prettier/eslint) on commit, so a commit may reformat files.

## Proposed off-limits
`.env`, `.env.*` (including the tracked `.env.development`, `.env.production`, `.env.test`), `.claude/**`, `.mcp.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated), `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` and `packages/excalidraw/subset/woff2/woff2-wasm.ts` (generated wasm bundles), `.sdlc/**`, `.git/**`.
