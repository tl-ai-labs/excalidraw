# Discovery — 20261109-bugfix-eyedropper-dark-theme

Mode: first-time · Built: 2026-11-09T11:45:44Z · Plugin 0.10.1 · Tier 1 completed well inside the timebox (1,267 tracked files, so no sampling was needed).

## Git state
- HEAD `4872083c044491b6d5c96ae134a75464f96d6831` on branch `EX-BF-04/opus55-plus-flash38-agsdk`. Working tree clean.
- Remote: `origin` https://github.com/tl-ai-labs/excalidraw.git
- This is a **git worktree** of `/Users/macbook/Documents/GitHub/excalidraw`, so the stash stack is shared with that checkout.
- `.gitignore` does **not** mention `.sdlc`. `.sdlc/` is currently ignored only through `/Users/macbook/Documents/GitHub/excalidraw/.git/info/exclude` (line 7), which is a local, unshared setting.

## Topology
Top level: `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`.
Packages: `packages/{common,element,excalidraw,fractional-indexing,laser-pointer,math,utils}`. App: `excalidraw-app/`. Examples: `examples/{with-nextjs,with-script-in-browser}`.
Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `excalidraw-app/index.html`, `packages/excalidraw/index.tsx`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| package.json | node-typescript | React, Vite, Vitest, Yarn workspaces (yarn@1.22.22) |
| packages/excalidraw/package.json | node-typescript | React (peer 17/18/19), Jotai, Sass, Testing Library |
| excalidraw-app/package.json | node-typescript | React 19, Vite, Jotai, Firebase, socket.io-client, Sentry |
| examples/with-nextjs/package.json | node-typescript | Next 14.1, React 19 |
| dev-docs/package.json | node-javascript | Docusaurus 2.2 |

TypeScript 5.9.3, `strict: true`, ESM, `moduleResolution: bundler`. No pre-authored adapter matches (shipped: generic, nest, python), so the Tier 2b stack profile was built at `.sdlc/baseline/stack-profile.md`.

## Test command
- **Proposed:** `yarn test --watch=false`. `scripts.test` is `yarn test:app`, which runs `vitest`. `yarn.lock` is present. Without `--watch=false`, vitest starts in watch mode.
- CLAUDE.md says to run `yarn test:update` (vitest with `--update --watch=false`) before committing and `yarn test:typecheck` (`tsc`) for types.
- Scoped run: `yarn test:app --watch=false packages/excalidraw/tests/eyeDropper.test.tsx`.
- Gate 0 must confirm. Whether any tests already fail is **unknown**: discovery does not run tests, and the pre-check test probe was skipped.

## Docs
README.md, CLAUDE.md, CONTRIBUTING.md (points to docs.excalidraw.com), .github/copilot-instructions.md, the dev-docs/ Docusaurus site, and per-package READMEs (excalidraw, common, element, math, utils, laser-pointer, examples/with-nextjs). There are no ADR directories, ARCHITECTURE.md or AGENTS.md.

## Detected AI/agent setup
- `CLAUDE.md`: claude-instructions
- `.github/copilot-instructions.md`: copilot

Not present: `.claude/`, `CLAUDE.local.md`, `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys
- Env files: `.env.development`, `.env.production`, `.env.test`. All three are **tracked in git**. They hold Vite client-side config.
- **Key names per file were not collected.** The key-name extraction command was denied by the permission classifier, and no values were read.
- Referenced in code (`process.env.*` / `import.meta.env.*`): DEV, IS_PREACT, MODE, PKG_NAME, PKG_VERSION, PR_TITLE, PROD, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID.

## Monorepo, submodules, LFS
- Monorepo type: Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). `dev-docs` has its own package.json but is not a workspace.
- No workspace package defines `scripts.test`. All tests run from the root through one `vitest.config.mts`, whose aliases map `@excalidraw/*` to source. To scope a run, pass a path filter.
- There are 121 tracked `*.test.ts(x)` files and 24 tracked snapshot files.
- No submodules. No LFS: `.gitattributes` only contains `* text=auto eol=lf`.

## Infra
Dockerfile, docker-compose.yml, vercel.json, firebase-project/, and 11 GitHub workflows (including test.yml, lint.yml, test-coverage-pr.yml and size-limit.yml). Husky and lint-staged pre-commit hooks are installed.

## Regulated-repo signals
None found.

## Coexistence risks
- **GitHub Copilot instructions** are at `.github/copilot-instructions.md`. The plugin will never touch them. They contain coding preferences (TypeScript, performance, immutability) that are worth honouring.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Right now the main checkout's `.git/info/exclude` hides `.sdlc/`, but that setting is local and other clones won't have it.)
- **Husky pre-commit hooks** run lint-staged (eslint and prettier) on commit. A commit can fail or reformat files.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/**`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `**/dev-dist/**`, `.next/**`, `**/.next/**`, `.git/**`, `.sdlc/**`, `**/__snapshots__/**`, `yarn.lock`.
Snapshots are generated. Move them into scope only if the fix legitimately changes rendered output.

## Pointers for this intent (eyedropper in dark theme)
- `packages/excalidraw/components/EyeDropper.tsx`: `getCurrentColor` reads the canvas pixel (`ctx.getImageData`, then `rgbToHex`). In dark theme that pixel has already been through `applyDarkModeFilter` or `DARK_THEME_FILTER`, and nothing reverses that before the colour reaches `onChange` or `onSelect`.
- Dark-mode colour helpers: `packages/common/src/colors.ts:83` (`applyDarkModeFilter`) and `packages/common/src/constants.ts:194` (`DARK_THEME_FILTER = "invert(93%) hue-rotate(180deg)"`). They are applied in `packages/element/src/renderElement.ts` and `packages/element/src/shape.ts`.
- Eyedropper consumers: `components/App.tsx`, `components/App.bucketFill.ts`, `components/LayerUI.tsx`, `components/ColorPicker/ColorPicker.tsx`, `components/ColorPicker/ColorInput.tsx`.
- Existing tests: `packages/excalidraw/tests/eyeDropper.test.tsx` and `packages/excalidraw/tests/bucketFill.test.tsx`.
