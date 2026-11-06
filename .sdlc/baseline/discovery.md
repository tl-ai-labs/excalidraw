# Discovery: 20261106-feature-new-drawing-pages

Mode: first-time (full Tier 1 scan) | Built: 2026-11-06T04:44:02Z | Plugin: mmo 0.10.1
Intent (context only): feature-new, "Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration."

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-12/opus55-plus-flash38-v2`, working tree clean.
- Remote `origin` is https://github.com/tl-ai-labs/excalidraw.git
- This is a git worktree. Its git dir lives in the main clone at `/Users/macbook/Documents/GitHub/excalidraw/.git`.
- `.gitignore` does not list `.sdlc/` (`gitignore_covers_sdlc: false`). `.sdlc/` is still ignored here, through `.git/info/exclude` (line 7) in the main clone, which every worktree shares. That rule exists only on this machine and is never committed.

## Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/`, `examples/`, `excalidraw-app/`, `firebase-project/`, `packages/`, `public/`, `scripts/`. 1327 tracked files.
- `packages/`: `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`
- `excalidraw-app/`: `collab/`, `components/`, `data/`, `share/`, `tests/`, `app-language/`
- `examples/`: `with-nextjs`, `with-script-in-browser`
- Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx` (the app), `packages/excalidraw/index.tsx` (the library)

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root) | node-typescript | React 19, Vite 5, Vitest 3, Yarn 1 workspaces, TypeScript 5.9 (strict) |
| `packages/excalidraw/package.json` | node-typescript | React, jotai (+ jotai-scope), radix-ui, esbuild build |
| `excalidraw-app/package.json` | node-typescript | React, Vite, jotai, socket.io-client, firebase, idb-keyval |
| `examples/with-nextjs/package.json` | node-typescript | Next.js |
| `dev-docs/package.json` | node-javascript | Docusaurus (not a workspace member) |

None of the pre-authored adapters (`generic`, `nest`, `python`) covers React/TypeScript, so Tier 2b ran and wrote `.sdlc/baseline/stack-profile.md`.

## Test / build commands
- Proposed: `yarn test:app --watch=false`. It comes from `package.json#scripts.test`, where `test` runs `yarn test:app`, which runs `vitest`. `yarn.lock` is present. Plain `vitest` starts in watch mode, so the proposal adds `--watch=false`.
- CLAUDE.md asks for `yarn test:update` (vitest with `--update`, which rewrites snapshots) before committing, and `yarn test:typecheck` (`tsc`).
- Other commands: `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier), `yarn test:all`.
- Gate 0 must confirm the command. Whether the suite passes at HEAD is not known yet: discovery does not run tests.

## Docs
`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` (one line pointing to the docs site), `.github/copilot-instructions.md`, `dev-docs/` (Docusaurus; `dev-docs/docs/codebase/json-schema.mdx` documents the `.excalidraw` file format), package READMEs. There is no ADR directory and no ARCHITECTURE.md.
- AGENTS.md rules: use `app.ownerDocument`/`app.ownerWindow` for DOM APIs, not the globals. Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`.

## Detected AI/agent setup
- `.claude/` (dir) and `.claude/settings.local.json` (holds only an `env` key; the folder is gitignored)
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- Not found: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`

## Env keys (names only)
- `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (1 key). All three are tracked in git. The names are all `VITE_APP_*` / `MODE` / `FAST_REFRESH` / `VITE_DEBUG_DOM`, meaning public build-time config, not secrets. The full list is in baseline.json.
- Referenced in code through `import.meta.env` / `process.env`: the same VITE_APP_* set, plus CI-only `GITHUB_*`, `OSS_STATS_*`, `PR_TITLE`, `RUNNER_NAME` (in `scripts/`).

## Monorepo, submodules, LFS
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*` (10 packages). One root `vitest.config.mts` with path aliases runs all the tests, so a single package is tested by path filter, e.g. `yarn test:app --watch=false packages/excalidraw`.
- No submodules (no `.gitmodules`).
- No LFS (`.gitattributes` holds only `* text=auto eol=lf`).
- Generated files: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`.

## Infra
Dockerfile, docker-compose.yml, vercel.json, firebase-project/, and GitHub workflows (test, lint, size-limit, stats, test-coverage-pr, docker build/publish, autorelease, locales-coverage, semantic-pr-title, sentry-production). Husky + lint-staged pre-commit hooks.

## Regulated-repo signals
None found.

## Intent-relevant modules (pages feature)
- **Scene / element storage:** `packages/element/src/Scene.ts` (a single flat ordered element list with maps and fractional indices), `packages/element/src/types.ts` (element base: `frameId`, `groupIds`, `index`, `customData`, `version`/`versionNonce`), `packages/element/src/fractionalIndex.ts`. Elements carry no page or scene id today.
- **App state / viewport:** `packages/excalidraw/appState.ts` (`getDefaultAppState`, `APP_STATE_STORAGE_CONF` browser/export/server flags; `scrollX`/`scrollY`/`zoom` are browser-only and are not exported), `packages/excalidraw/types.ts` (`AppState`, `ExcalidrawProps`, `SceneData`, `ExcalidrawImperativeAPI`), `packages/excalidraw/components/App.tsx` (11.5k lines: `updateScene`, `resetScene`, `syncActionResult`, `getSceneElements`).
- **Serialization / restore / file format:** `packages/excalidraw/data/json.ts` (`serializeAsJSON`, `loadFromJSON`, `isValidExcalidrawData`), `packages/excalidraw/data/types.ts` (`ExportedDataState`/`ImportedDataState`), `packages/excalidraw/data/restore.ts` (`restoreElements`, `restoreAppState`), `packages/excalidraw/data/blob.ts` (file and PNG-embedded scene load), `packages/common/src/constants.ts` (`VERSIONS.excalidraw = 2`, `EXPORT_DATA_TYPES`), `dev-docs/docs/codebase/json-schema.mdx`.
- **Collaboration:** `excalidraw-app/collab/Collab.tsx` (handles `WS_SUBTYPES.INIT/UPDATE`, `_reconcileElements`, `handleRemoteSceneUpdate`, `syncElements`, `saveCollabRoomToFirebase`), `excalidraw-app/collab/Portal.tsx` (`broadcastScene`, which syncs by element version), `excalidraw-app/data/index.ts` (`SocketUpdateDataSource` payload types, `getSyncableElements`), `excalidraw-app/data/firebase.ts` (`saveToFirebase`/`loadFromFirebase`, stores encrypted elements only), `excalidraw-app/app_constants.ts` (`WS_EVENTS`, `WS_SUBTYPES`, `STORAGE_KEYS`), `packages/excalidraw/data/reconcile.ts`.
- **Local persistence:** `excalidraw-app/data/LocalData.ts` (debounced `LocalData.save`), `excalidraw-app/data/localStorage.ts` (`importFromLocalStorage`, keys `excalidraw` / `excalidraw-state`), `excalidraw-app/data/tabSync.ts`, `excalidraw-app/App.tsx` (`initializeScene`, the `onChange` path to `collabAPI.syncElements` + `LocalData.save`), `packages/excalidraw/data/EditorLocalStorage.ts`.
- **History / undo:** `packages/excalidraw/history.ts` (`History`, `HistoryDelta`), `packages/element/src/store.ts` (`Store`, `CaptureUpdateAction`, `StoreDelta`, `StoreSnapshot`), `packages/element/src/delta.ts`, `packages/excalidraw/actions/actionHistory.tsx`.
- **UI layer for a tab bar:** `packages/excalidraw/components/LayerUI.tsx` (renders `<Footer>` near line 657 and the top-right UI near line 400; `MobileMenu` for mobile), `packages/excalidraw/components/footer/Footer.tsx` (zoom/undo left, `FooterCenterTunnel.Out`, help right), `packages/excalidraw/components/footer/FooterCenter.tsx` (tunnel slot that hosts can fill), `packages/excalidraw/context/tunnels.ts`, `packages/excalidraw/components/MobileMenu.tsx`, `excalidraw-app/components/AppFooter.tsx` (the app already fills the `Footer` slot), `packages/excalidraw/locales/en.json` (i18n labels).
- **Relevant tests:** `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/data/reconcile.test.ts`, `packages/excalidraw/tests/history.test.tsx`, `excalidraw-app/tests/collab.test.tsx`, helpers `packages/excalidraw/tests/helpers/api.ts`, `packages/excalidraw/tests/test-utils.ts`.

## Coexistence risks
- You have Claude Code project config (`.claude/settings.local.json`, `CLAUDE.md`, `AGENTS.md`). The plugin will not touch them.
- You have GitHub Copilot instructions at `.github/copilot-instructions.md`. They stay untouched.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Today the main clone's `.git/info/exclude` hides `.sdlc/` on this machine. That rule is local only.)
- Husky pre-commit runs lint-staged (eslint/prettier) on commits.
- Cursor, Aider, custom MCP servers and repo-local routing-policy.yaml: none found.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**`

## Notes
- The scan finished within the timebox and needed no sampling (1327 tracked files).
- Pass `--update` only on purpose: it rewrites `__snapshots__`.
