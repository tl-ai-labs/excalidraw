# Discovery: excalidraw-2 (run 20261106-152440-feature-new-text-range-styling)

Mode: first-time, full Tier 1 scan, plus the Tier 2b stack profile (the stack is React/TypeScript and none of the shipped adapters match it). Built 2026-11-06.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79`, branch `EX-NF-11/argon4-plus-flash38`. The working tree is clean. It is a git worktree (`.git` is a file).
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- **`.gitignore` does not cover `.sdlc/`** (gitignore_covers_sdlc: false). It does ignore `.claude`, `build`, `dist`, `node_modules`, `coverage`, `dev-dist`, `packages/excalidraw/types`, `meta*.json`, `html`, `firebase`, `logs`.

## Topology
Top level: `excalidraw-app/` (excalidraw.com app: `collab/`, `data/`, `components/`, `share/`, `tests/`), `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `examples/` (with-nextjs, with-script-in-browser), `dev-docs/` (Docusaurus, own yarn.lock, not a workspace), `firebase-project/`, `public/`, `scripts/`, `.github/`, `.husky/`, `.codesandbox/`. 1327 tracked files.

Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/element/src/index.ts`, `packages/common/src/index.ts`.

## Detected stacks
- Root `package.json`: node-typescript. Yarn 1.22.22 workspaces (`excalidraw-app`, `packages/*`, `examples/*`). TypeScript 5.9.3 with strict mode. Vite 5, Vitest 3 with jsdom and vitest-canvas-mock, ESLint and Prettier 2.
- `excalidraw-app`: React 19, Jotai, Firebase 11, socket.io-client 4.
- `packages/excalidraw`: React (peer 17/18/19), Jotai, roughjs.
- `examples/with-nextjs`: Next 14. `dev-docs`: Docusaurus 2.
- There is no matching pre-authored adapter (we ship generic, nest and python), so the stack profile was built: `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: **`yarn test:app --watch=false`** (`package.json#scripts.test` is `yarn test:app`, which runs `vitest`. Without `--watch=false`, vitest runs in watch mode in a TTY.)
- `yarn test:update` is what CLAUDE.md asks for before commits. It rewrites snapshots, so use it only on purpose.
- `yarn test:typecheck` (tsc), `yarn test:code` (eslint --max-warnings=0), `yarn test:other` (prettier), `yarn test:all`.
- No per-package test scripts. One root `vitest.config.mts` maps the `@excalidraw/*` aliases to the source. To scope a run, pass a path: `yarn test:app --watch=false packages/element/tests/textElement.test.ts`.
- **Gate 0 must confirm** the test command. Pre-existing test status was not checked (Tier 1 does not run tests).

## Docs
`README.md`, `CLAUDE.md` (monorepo layout, run `yarn test:update` before committing, `yarn test:typecheck`, `yarn fix`), `AGENTS.md` (use `app.ownerDocument`/`app.ownerWindow` instead of DOM globals; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & …`), `CONTRIBUTING.md` (points to the docs site), `.github/copilot-instructions.md` (TypeScript/React style: immutable data, performance first, optional chaining). `dev-docs/docs/codebase/` holds the docs site's codebase notes. There are package READMEs for excalidraw, element, common, math, utils and laser-pointer. No ADR directory.

## Detected AI/agent setup
- `.claude/` (dir) with `.claude/settings.local.json`. It is gitignored and holds an `env` block.
- `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- Env files present **and tracked in git**: `.env.development`, `.env.production`, `.env.test`. These are Vite build-config files.
- **Key names from the env files were not collected**: the permission classifier blocked the read (Credential Exploration), and no values were read. `env_keys_by_file` is empty.
- Env names referenced in code (from the grep): DEV, MODE, PROD, PKG_NAME, PKG_VERSION, IS_PREACT, VITE_APP_AI_BACKEND, VITE_APP_BACKEND_V2_GET_URL, VITE_APP_BACKEND_V2_POST_URL, VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX, VITE_APP_DISABLE_PREVENT_UNLOAD, VITE_APP_DISABLE_SENTRY, VITE_APP_ENABLE_TRACKING, VITE_APP_FIREBASE_CONFIG, VITE_APP_GIT_SHA, VITE_APP_LIBRARY_BACKEND, VITE_APP_LIBRARY_URL, VITE_APP_PLUS_APP, VITE_APP_PLUS_EXPORT_PUBLIC_KEY, VITE_APP_PLUS_LP, VITE_APP_WS_SERVER_URL, VITE_DEBUG_DOM, VITE_WORKER_ID, plus the CI-only GITHUB_*, RUNNER_NAME, OSS_STATS_*.

## Monorepo / submodules / LFS / infra
- Yarn workspaces monorepo. Packages: excalidraw-app, @excalidraw/{excalidraw, element, common, math, utils, fractional-indexing, laser-pointer}, with-nextjs, with-script-in-browser.
- Submodules: none. LFS: none (`.gitattributes` holds only `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/, and 12 GitHub workflows (test, lint, size-limit, stats, test-coverage-pr, …). The Husky pre-commit hook exists but its `yarn lint-staged` line is commented out.
- No encrypted-secret tooling found (no sops, git-crypt, .pem or .key files).

## Regulated-repo signals
None found.

## Text-element pointers for the upcoming feature (range colour/highlight)
- **Type**: `packages/element/src/types.ts:253`, `ExcalidrawTextElement` (fields `text`, `originalText`, fontSize, fontFamily, textAlign, lineHeight, autoResize, containerId, baseFontSize…). Colour today is element-wide `strokeColor` from the base type.
- **Creation**: `packages/element/src/newElement.ts:337` `newTextElement`, `:540` `refreshTextDimensions`.
- **Mutation / versioning** (drives collab): `packages/element/src/mutateElement.ts:40` `mutateElement`, `:149` `newElementWith`, `:188` `bumpVersion`.
- **Layout / wrapping**: `packages/element/src/textElement.ts`, `textMeasurements.ts`, `textWrapping.ts:398` `wrapText`. `text` is the wrapped form of `originalText`, so wrapping inserts newlines and character offsets in `text` and `originalText` differ. Range offsets should most likely be stored against `originalText` and mapped onto the wrapped lines when rendering.
- **Canvas render**: `packages/element/src/renderElement.ts:660-718`. The text branch splits `element.text` on `\n` and calls `fillText` once per line, with `fillStyle = applyDarkModeFilter(strokeColor, …)`, inside a per-element offscreen canvas cache (`elementWithCanvasCache` `:724`, `generateElementCanvas` `:280`). Per-range runs need several `fillText` calls per line, with x positions taken from measured run widths, and the canvas cache must be invalidated when the styling changes. RTL text is special-cased.
- **Scene render**: `packages/excalidraw/renderer/staticScene.ts`.
- **WYSIWYG editing**: `packages/excalidraw/wysiwyg/textWysiwyg.tsx:250` `textWysiwyg`, called from `packages/excalidraw/components/App.text.ts:59`. The editor is a **plain `<textarea>`** (`:533`) and only handles `originalText` through `onChange` and `onSubmit`. It cannot show per-range colour while you edit, but `selectionStart`/`selectionEnd` give the range to style. Offsets have to be preserved when text is inserted or deleted.
- **Style actions / properties panel**: `packages/excalidraw/actions/actionProperties.tsx:366` `actionChangeStrokeColor` (uses `resolveColorTarget`, `changeProperty` and `newElementWith`), `:1007` font size, `:1168` font family.
- **Serialize / load**: `packages/excalidraw/data/json.ts:52` `serializeAsJSON`, `:102` `loadFromJSON`. Also `data/blob.ts` and `data/encode.ts`.
- **Restore / normalise** (backward compatibility for new fields): `packages/excalidraw/data/restore.ts:555`, the `case "text"` branch of `restoreElementWithProperties`. A new field must be defaulted here.
- **Collab reconcile**: `packages/excalidraw/data/reconcile.ts:23` `shouldDiscardRemoteElement` and `:73` `reconcileElements`. These work at element level by version/versionNonce, so a new field syncs as long as edits bump the version. The app side is `excalidraw-app/collab/Collab.tsx` (`_reconcileElements` ~:348/:612), `collab/Portal.tsx` (`broadcastScene`, `_broadcastSocketData` :85) and `excalidraw-app/data/firebase.ts`.
- **History / undo**: `packages/element/src/delta.ts` and `packages/element/src/store.ts` (element deltas).
- **SVG export**: `packages/excalidraw/renderer/staticSvgScene.ts:97` `renderElementToSvg`. The text branch (~:805-835) emits one `<text>` per line with `fill=strokeColor` and `white-space: pre`. Ranges would map to `<tspan fill=…>` children, and highlights to background `<rect>`s, or to tspans when the backend supports it. Export entry: `packages/excalidraw/scene/export.ts:1354` `exportScene`.
- **Clipboard / skeleton**: `packages/excalidraw/clipboard.ts`, `components/App.clipboard.ts`, `packages/element/src/transform.ts`.
- **Tests to extend**: `packages/element/tests/textElement.test.ts`, `textWrapping.test.ts`, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`, `packages/excalidraw/tests/data/restore.test.ts`, `tests/data/reconcile.test.ts`, `tests/scene/export.test.ts` (has snapshots), `tests/export.test.tsx`, `excalidraw-app/tests/collab.test.tsx`. Fixtures are in `packages/excalidraw/tests/fixtures/elementFixture.ts`. Many `__snapshots__` files serialise whole elements, so adding a field to text elements will change snapshots across the suite (`yarn test:update`).

## Coexistence risks
- **`.sdlc/` not gitignored**: "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."
- Repo rules for agents live in `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md`. They are off-limits for writes, but codegen should follow them.
- `.claude/settings.local.json` exists (gitignored, has an `env` block) and is untouched.
- The env files `.env.development`, `.env.production` and `.env.test` are committed to git. They are off-limits and their key names were not collected.
- No custom MCP, Cursor, Aider or repo-local routing policy was found.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated), `.git/**`, `.sdlc/**`, `yarn.lock`.
No files with a GENERATED header were found in tracked TS/JS.

## Discovery notes
- Group 7: the permission classifier denied reading the env files. Key extraction was skipped, not worked around.
- The scan finished within the timebox. No sampling was needed (1327 tracked files).
