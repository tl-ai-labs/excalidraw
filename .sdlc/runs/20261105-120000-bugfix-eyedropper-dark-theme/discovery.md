# Discovery: excalidraw-monorepo (EX-BF-04 worktree)

Run: `20261105-120000-bugfix-eyedropper-dark-theme` | mode: first-time | built 2026-11-04T19:17:27Z | plugin 0.10.1
Intent: bugfix. In dark theme the eyedropper saves the on-screen dark-mode colour instead of the element's real colour.

## 1. Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` on `EX-BF-04/opus55-plus-sonnet55`. Working tree clean.
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree** (`.git` is a file pointing to `/Users/apple/Documents/GitHub/excalidraw/.git/worktrees/EX-BF-04`). The stash stack and `.git/info/exclude` are shared with the main checkout.
- `.gitignore` does **not** list `.sdlc/` (`gitignore_covers_sdlc: false`). `.sdlc/` is still ignored in practice, through the shared `.git/info/exclude` (line 7) of the main checkout.

## 2. Topology
Top level: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples` (with-nextjs, with-script-in-browser), `excalidraw-app` (app-language, collab, components, data, share, tests), `firebase-project`, `packages` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public`, `scripts`.
Entry points: `packages/excalidraw/index.tsx` (library), `excalidraw-app/index.tsx` and `excalidraw-app/App.tsx` (app), `packages/{common,element,math,utils}/src/index.ts`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, yarn@1.22.22 workspaces) | node-typescript | react 19, vite 5, vitest 3, jotai, sass |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `dev-docs/package.json` (not a workspace) | node-javascript | docusaurus |

TypeScript 5.9.3, `strict: true`, ESM, `moduleResolution: bundler`, path aliases `@excalidraw/*` defined in `tsconfig.json` and `vitest.config.mts`.
No pre-authored adapter matches (shipped: generic, nest, python), so the Tier 2b stack profile was built: `.sdlc/baseline/stack-profile.md`.

## 4. Test / build commands
- Proposed: **`yarn test:app --watch=false`** (source: `package.json#scripts.test` -> `yarn test:app` -> `vitest`). A bare `yarn test` starts vitest in **watch mode** and never exits.
- Targeted run for this bug: `yarn test:app --watch=false packages/excalidraw/tests/eyeDropper.test.tsx`
- Typecheck: `yarn test:typecheck` (`tsc`). Lint: `yarn test:code`. Format: `yarn test:other`.
- CLAUDE.md says "always run `yarn test:update` before committing". That command rewrites snapshots (`--update`), so it can hide snapshot regressions. Gate 0 should decide whether to use it.
- Single vitest config at root (jsdom, `setupTests.ts`, globals, coverage thresholds lines 60 / branches 70 / functions 63 / statements 60). 121 tracked `*.test.ts(x)` files.
- Tests were **not run** in Tier 1. Pre-existing failures are unknown. `.sdlc/pre-check-status.json` shows `test_command_probe: skip`.

## 5. Docs
- `README.md`: product README (links, badges).
- `CLAUDE.md`: monorepo layout, yarn workspaces, `yarn test:typecheck` / `yarn test:update` / `yarn fix`.
- `CONTRIBUTING.md`: link to docs.excalidraw.com.
- `dev-docs/README.md`: Docusaurus site.
- `.github/copilot-instructions.md`: coding standards (TS, functional React with hooks, PascalCase components, camelCase functions, ALL_CAPS constants, prefer immutable data, `?.`/`??`).
- No ADR directory, no ARCHITECTURE.md, no AGENTS.md.

## Detected AI/agent setup
- `.claude/` (dir), with `.claude/settings.local.json` only. `.claude` is gitignored.
- `CLAUDE.md` (project instructions)
- `.github/copilot-instructions.md` (GitHub Copilot)
- Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## 7. Environment keys (names only)
- Env files present **and tracked in git**: `.env.development`, `.env.production`, `.env.test`. No `.env` / `.env.local` on disk.
- Key names from env files: **not collected**. The permission classifier denied reading env files this session. No values were read.
- Referenced in code (`import.meta.env.*` / `process.env.*`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PROD, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID.

## 8. Monorepo / submodules / LFS / infra
- Monorepo: **yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`), 10 workspace packages. `dev-docs` is outside the workspaces. Packages have no `test` scripts: all tests run from the root vitest. Scope by path.
- Submodules: none. LFS: none (`.gitattributes` is only `* text=auto eol=lf`).
- Infra: `Dockerfile`, `docker-compose.yml`, `.github/workflows/` (11 workflows incl. test.yml, lint.yml), `vercel.json`, `firebase-project/`, `.husky/` (pre-commit hook is commented out, so it is a no-op), `.lintstagedrc.js`.
- Generated files: `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`.

## 9. Regulated-repo signals
None found (no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR files, no CODEOWNERS).

## Coexistence risks
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. *(Mitigation already in place: the main checkout's `.git/info/exclude` lists `.sdlc/`, so `git add -A` skips it in this worktree for now. That exclusion is local and not versioned.)*
- **Copilot instructions** at `.github/copilot-instructions.md`. Untouched by default.
- **Tracked env files.** `.env.development`, `.env.production` and `.env.test` are committed. They stay off-limits, and their contents were not inspected.
- **Aggressive / unanchored `.gitignore` entries.** `build`, `dist`, `html`, `logs`, `coverage`, `firebase`, `meta*.json` and `.claude` match at any depth. A new file or folder with one of those names (e.g. a `html/` fixture dir or a `meta-*.json` file) would be silently untracked. `packages/excalidraw/types` is also ignored.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `.yarn/**`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `.git/**`

## Orientation for this intent (read-only pointers)
- `packages/excalidraw/components/EyeDropper.tsx`: `getCurrentColor` samples the raw canvas pixel via `ctx.getImageData(...)` + `rgbToHex`. In dark theme the canvas is rendered with dark-mode-transformed colours, so the sampled value is the on-screen colour.
- `packages/common/src/colors.ts`: `applyDarkModeFilter(color)` (invert 93% + hue-rotate 180deg, cached) is the forward transform. A fix will likely need its inverse or an element hit-test that returns the stored colour.
- Existing test: `packages/excalidraw/tests/eyeDropper.test.tsx` (one test, preview positioning). `packages/common/src/colors.test.ts` covers colour helpers.

## Pre-existing .sdlc state
`.sdlc/project.json` (default policy `opus55-plus-sonnet55`) and `.sdlc/pre-check-status.json` (`ok: false`, `discovery_smoke` pending) existed before this run.
