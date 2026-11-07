# Discovery — Excalidraw monorepo (EX-FE-04-argon worktree)

Built: 2026-11-06 · mode: first-time · run dir: `.sdlc/runs/pending-discovery/` · plugin 0.10.1 · upcoming job: `feature-extend`

## Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on `EX-FE-04/argon4-plus-flash38`. The tree is clean. This is a git worktree, and its toplevel matches the cwd.
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- `.gitignore` does not list `.sdlc/` (`gitignore_covers_sdlc: false`). The shared `.git/info/exclude` (line 7, `.sdlc/`) does ignore it, so in this clone `git add -A` will not pick up `.sdlc/`. That rule is local to this machine.

## Topology
Top level: `excalidraw-app/` (Vite web app), `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `examples/` (with-nextjs, with-script-in-browser), `dev-docs/` (Docusaurus site, not a workspace), `scripts/`, `public/`, `firebase-project/`, `.github/`, `.husky/`, `.codesandbox/`, `.claude/`. 1267 tracked files.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, and `packages/*/src/index.ts`.

## Detected stacks
- Root `package.json`: node-typescript. Yarn 1 workspaces, TypeScript 5.9 (strict, ESNext, react-jsx), Vite 5, Vitest 3 (jsdom), esbuild for packages.
- `excalidraw-app`: React 19, Vite, jotai, firebase, socket.io-client.
- `packages/excalidraw`: React component library, jotai + jotai-scope, SCSS.
- `examples/with-nextjs`: Next.js. `dev-docs`: Docusaurus.
- Primary stack: React + TypeScript. **No pre-authored adapter matches it** (only generic/nest/python ship), so Tier 2b ran and wrote `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: **`yarn test`** (`package.json#scripts.test` → `yarn test:app` → `vitest`; yarn.lock is present).
- Caveat: plain `vitest` starts in watch mode. For non-interactive runs use `yarn test:app --watch=false`. CLAUDE.md asks for `yarn test:update` before committing (this rewrites snapshots) and `yarn test:typecheck` (tsc). Lint is `yarn test:code`, formatting is `yarn test:other`, and `yarn test:all` runs everything.
- CI (`.github/workflows/test.yml`) runs `yarn install && yarn test:app` on Node 20.
- Gate 0 must confirm the command. No tests were run, so there is no known-failing baseline.

## Docs
README.md, CLAUDE.md, CONTRIBUTING.md (points to the docs site), dev-docs/README.md, dev-docs/docs/ (Docusaurus: @excalidraw, codebase, introduction), packages/excalidraw/README.md. No ADR directory.

## Detected AI/agent setup
- `.claude/` with `.claude/settings.local.json` (untracked; `.claude` is in .gitignore)
- `CLAUDE.md` (tracked project instructions)
- `.github/copilot-instructions.md` (coding standards for Copilot)
- None of these were found: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- Env files present (all tracked): `.env.development`, `.env.production`, `.env.test`.
- **The permission system denied reading them, even for names only.** `env_keys_by_file` is null.
- Names referenced in code (`import.meta.env.*` / `process.env.*`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PROD, PR_TITLE, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID.

## Monorepo, submodules, LFS
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*` (10 packages). `dev-docs` is outside the workspaces.
- Tests are scoped by path with the single root `vitest.config.mts`, which also defines the `@excalidraw/*` aliases to source.
- No submodules. No LFS (`.gitattributes` is `* text=auto eol=lf` only). No encrypted secret files are tracked.

## Infra hints
Dockerfile, docker-compose.yml, 10 GitHub workflows (test, lint, size-limit, coverage, docker, sentry, autorelease, ...), vercel.json, firebase-project/, .codesandbox/, husky + lint-staged pre-commit.

## Regulated-repo signals
None found.

## Coexistence risks
- `.sdlc/` is not in `.gitignore`, so run artifacts under `.sdlc/` (packets, backups, telemetry) would be untracked but visible to `git add -A`. The local `.git/info/exclude` covers `.sdlc/` in this clone, which lowers the risk here. Gate 0 can still offer to add `.gitignore` (append) to this run's allowlist so the plugin adds the entry as part of the run.
- Husky pre-commit runs lint-staged (eslint/prettier) on commit. Commits may reformat or reject changes.
- `yarn test:update` rewrites `__snapshots__`. Any feature that changes UI or appState will churn snapshots (e.g. `packages/excalidraw/tests/__snapshots__/*.snap`). Review snapshot diffs before accepting them.
- `.github/copilot-instructions.md` is untouched. It has style rules (functional components, immutability, PascalCase/camelCase/ALL_CAPS) that are worth honoring.
- `packages/excalidraw/components/App.tsx` is about 13.9k lines. Edits there need surgical, anchored diffs.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `.next/**`, `coverage/**`, `packages/excalidraw/types/**` (generated types), `.git/**`, `.sdlc/**`

## Discovery notes
- The permission system blocked the env-file key-name extraction. Everything else completed.
