# Discovery — 20261109-163500-feature-extend-lasso-wrap-overlap

Mode: first-time (full Tier 1 scan). Built 2026-11-09T11:07:43Z, plugin mmo 0.10.1.
Intent hint: feature-extend, which makes free-form lasso selection respect the Wrap/Overlap preference that box selection uses.

## Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on branch `EX-FE-04/opus55-plus-flash38-agsdk` (a git worktree). The working tree is clean.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- `.gitignore` covers `.sdlc/`: **no**, but `.sdlc/` is already excluded by the shared `.git/info/exclude` (line 7 in the main repo /Users/macbook/Documents/GitHub/Google-Projects/excalidraw/.git), so `git add -A` will not stage run artifacts in this clone. It does ignore `.claude`, `build`, `dist`, `node_modules`, `coverage`, `packages/excalidraw/types`, `meta*.json`, `html`, `firebase`, `.env.*.local`.

## Topology
Tracked files: 1267 (normal size, no sampling needed).
Top level: `excalidraw-app/` (Vite web app), `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `examples/` (with-nextjs, with-script-in-browser), `dev-docs/` (Docusaurus site, not a workspace), `firebase-project/`, `public/`, `scripts/`, `.github/`, `.husky/`, `.codesandbox/`, `.claude/`.
Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`.
Files that matter for this intent: `packages/excalidraw/lasso/index.ts`, `packages/excalidraw/lasso/utils.ts`, `packages/excalidraw/tests/lasso.test.tsx`.

## Detected stacks
- `package.json` → **node-typescript**: React 19, Vite 5, Vitest 3, TypeScript 5.9 (strict), Yarn 1.22 workspaces, esbuild for package builds. Node >= 18 (CI uses 20.x).
- None of the shipped stack adapters (generic, nest, python) matches. **Tier 2b adaptive profile is triggered** (React/TS has no adapter), but this pass did not run it and no `.sdlc/baseline/stack-profile.md` exists yet. Until the profile runs, the architect falls back to `generic.md`.

## Test / build commands
- Proposed: **`yarn test:app --watch=false`** (`scripts.test` → `yarn test:app` → `vitest`; `yarn.lock` is present). The `--watch=false` flag stops vitest from entering watch mode.
- Scoped: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx`
- CLAUDE.md recommends `yarn test:update`, which updates snapshots. Gate 0 should decide whether snapshot updates are acceptable. CI (`.github/workflows/test.yml`) runs `yarn test:app`.
- Typecheck: `yarn test:typecheck` (`tsc`). Lint: `yarn test:code` (eslint, `--max-warnings=0`).
- Gate 0 must confirm the command. This pass did not run any tests, so the test baseline (pass/fail) is **unknown**.

## Docs present
README.md, CLAUDE.md (project structure, workflow, commands), CONTRIBUTING.md (points to docs site), `.github/copilot-instructions.md` (TS/React coding standards), `dev-docs/` (Docusaurus), per-package READMEs. No ADR directory.

## Detected AI/agent setup
- `.claude/`, which holds `.claude/settings.local.json`. The whole `.claude` dir is gitignored.
- `CLAUDE.md` (project instructions, tracked)
- `.github/copilot-instructions.md` (GitHub Copilot)
- None found: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`, `CLAUDE.local.md`, `AGENTS.md`.

## Env keys (names only)
- Tracked env files: `.env.development`, `.env.production`, `.env.test`. **The permission classifier denied reading key names from these files**, so `env_keys_by_file` is empty. No values were read.
- Names referenced in code (`import.meta.env.*` / `process.env.*`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PROD, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID.

## Monorepo / submodules / LFS
- Monorepo: **Yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`), 10 workspace packages. `dev-docs` has a package.json but is not a workspace. One root `vitest.config.mts` with path aliases covers every package.
- Submodules: none (no `.gitmodules`).
- LFS: none. `.gitattributes` only sets `* text=auto eol=lf`.
- No encrypted-secret tooling seen (no git-crypt/sops markers in `.gitattributes`).

## Infra hints
Dockerfile, docker-compose.yml, GitHub Actions (11 workflows, including test, lint, size-limit, test-coverage-pr), vercel.json, firebase-project/ (firestore/storage rules), Husky pre-commit + lint-staged, .codesandbox/.

## Regulated-repo signals
None. No SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR docs, no compliance dirs, no CODEOWNERS. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored**: Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. (Mitigated locally: `.git/info/exclude` already ignores `.sdlc/`, so adding it to `.gitignore` is optional.) Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run.
- **Claude Code / Copilot config**: `.claude/settings.local.json`, `CLAUDE.md`, and `.github/copilot-instructions.md` are left untouched by default.
- **Husky pre-commit + lint-staged**: any commit runs the lint/prettier hooks, which may reformat staged files.
- **Snapshot tests**: `yarn test:update` rewrites `__snapshots__`. A selection-behaviour change may change snapshots outside the lasso test.

## Proposed off-limits
`.git/**`, `.env.development`, `.env.production`, `.env.test`, `.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `node_modules/**` (and nested), `dist/**`, `build/**`, `dev-dist/**`, `.next/**`, `packages/excalidraw/types/**` (generated, gitignored), `.sdlc/**`.
Generated-file header spot-check: not performed (skipped after the env read denial). No vendor/third_party dirs.

## Notes / errors
- The auto-mode permission classifier denied two Bash reads: a combined env-key/source-ref scan, then a narrower names-only `grep | cut -d= -f1` over the env files. I did not work around the denials, so env key names come only from the code-reference grep.
