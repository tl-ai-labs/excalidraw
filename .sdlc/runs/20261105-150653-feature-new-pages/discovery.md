# Discovery — run 20261105-095607-feature-new-pages

- Mode: first-time (full Tier 1 scan)
- Intent: feature-new — "Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration."
- Built: 2026-11-05T04:28:55Z, plugin mmo 0.9.3

## 1. Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-12/opus55-only`; working tree clean.
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- **Git worktree.** `.git` is a file; git-dir `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git/worktrees/EX-NF-12`, common dir `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git`. Toplevel matches cwd. The stash stack is shared with other worktrees, so rollback should use commits/refs, not bare `git stash`.
- `.gitignore` does **not** cover `.sdlc/` (`gitignore_covers_sdlc: false`). However, `.sdlc/` **is** excluded through the shared `/Users/macbook/Desktop/Work/AI studies TL/excalidraw/.git/info/exclude` (line 7), so `git status` and `git add -A` already ignore it in this clone.
- 1327 tracked files, so no sampling was needed.

## 2. Topology
Top-level: `.codesandbox`, `.github`, `.husky`, `dev-docs` (Docusaurus site), `examples` (with-nextjs, with-script-in-browser), `excalidraw-app` (collab, components, data, share, app-language, tests), `firebase-project`, `packages` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public`, `scripts`.
Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx` (library), `packages/excalidraw/components/App.tsx` (editor class).

## Detected stacks
- `package.json`: node-typescript (TS 5.9.3, Node >=18, yarn@1.22.22). Frameworks: React 19, Vite (app), esbuild (packages), Vitest 3, Jotai, Radix UI, socket.io-client, Firebase. Docs use Docusaurus. `examples/with-nextjs` uses Next.js.
- No pre-authored adapter matches (shipped: generic, nest, python). **Tier 2b adaptive stack profile is recommended** (trigger 1). This step did not run it.

## 3. Test / build commands
- Proposed: `yarn test:app --watch=false`, from `package.json#scripts.test` (`yarn test:app` -> `vitest`). Gate 0 must confirm it.
- Related: `yarn test:typecheck` (tsc), `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier), `yarn test:update` (snapshots; CLAUDE.md says to run it before committing), `yarn test:all`.
- Targeted runs: `yarn vitest run <files>`. There is one root `vitest.config.mts` with path aliases for the internal packages.
- **Baseline signal (cheap check):** `restore.test.ts`, `reconcile.test.ts`, `appState.test.tsx` and `excalidraw-app/tests/collab.test.tsx` give 4 files and 76 tests, **all passing** (~4.4s). The full suite was not run.

## 4. Docs
README.md, CLAUDE.md (monorepo layout, commands), AGENTS.md (use `app.ownerDocument`/`app.ownerWindow` instead of globals; prefer `Merge<>` from `@excalidraw/common/utility-types` over `Omit & `), CONTRIBUTING.md, `.github/copilot-instructions.md` (TS/React style: immutable data, `?.`/`??`, performance-first).
API catalogues to update for new appState keys or props: `dev-docs/docs/@excalidraw/excalidraw/api/props/{props,initialdata,excalidraw-api,ui-options,render-props}.mdx`, `api/utils/{restore,export}.mdx`, `api/children-components/{footer,main-menu}.mdx`, `dev-docs/docs/codebase/json-schema.mdx` (file format).

## Detected AI/agent setup
- `.github/copilot-instructions.md` (copilot).
- None found: `.claude/`, `.mcp.json`, `.cursor*`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`, `gemini*.{yaml,json}`. (`.claude` is in `.gitignore`.)

## 5. Env keys (names only)
- `.env.development`: 20 keys. `.env.production`: 15 keys. `.env.test`: `VITE_DEBUG_DOM`. All are `VITE_APP_*` plus `MODE`/`FAST_REFRESH`. No secrets-style key names. Firebase config lives in `VITE_APP_FIREBASE_CONFIG`, WS server in `VITE_APP_WS_SERVER_URL`.
- Code references `import.meta.env.*`/`process.env.*`. The full list is in baseline.json.

## 6. Monorepo / submodules / LFS / infra
- Yarn workspaces: `excalidraw-app`, `packages/*`, `examples/*` (10 workspace packages). `dev-docs` is outside the workspaces.
- No submodules. No LFS (`.gitattributes` = `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/, 12 GitHub workflows (test.yml, lint.yml, size-limit.yml, locales-coverage.yml, ...). Husky + lint-staged pre-commit hooks.

## Regulated-repo signals
None found.

## Feature-relevant files (multi-page)

### Scene / element store
- `packages/element/src/Scene.ts`: Scene class (ordered elements, element maps, frames, selection cache). App creates a single instance (`App.tsx:894`, re-created at `:3938`).
- `packages/element/src/types.ts`: element types, `SceneElementsMap`, `OrderedExcalidrawElement`.
- `packages/element/src/fractionalIndex.ts`: fractional z-index ordering, which reconcile/collab depend on.
- `packages/element/src/index.ts`: barrel, `getSceneVersion` (versioning used by collab/firebase).
- `packages/excalidraw/scene/types.ts`, `scene/index.ts`: render/scene types.

### AppState
- `packages/excalidraw/types.ts`: `AppState` (L330), `ExcalidrawProps` (L843), `SceneData` (L1120, the updateScene payload), `ExcalidrawImperativeAPI` (L1390).
- `packages/excalidraw/appState.ts`: `getDefaultAppState` (L30), `APP_STATE_STORAGE_CONF` (L159). This is typed as a Record over every AppState key, so **any new AppState key must be added here with browser/export/server flags** or tsc fails. Also holds `clearAppStateForLocalStorage`, `cleanAppStateForExport`, `clearAppStateForDatabase`.

### Serialization / restore / format version
- `packages/excalidraw/data/json.ts`: `serializeAsJSON` / `saveAsJSON` / `loadFromJSON` (writes `{type, version, source, elements, appState, files}`).
- `packages/excalidraw/data/types.ts`: `ExportedDataState`, `ImportedDataState`, `LegacyAppState`.
- `packages/excalidraw/data/restore.ts`: `restore`, `restoreElements` (L960), `restoreAppState` (L1268). Migration happens here.
- `packages/excalidraw/data/blob.ts`: `loadFromBlob` / `loadSceneOrLibraryFromBlob` (file open, PNG/SVG-embedded scenes).
- `packages/excalidraw/scene/export.ts`, `data/index.ts`: export to canvas/SVG with embedded scene.
- `packages/common/src/constants.ts`: `EXPORT_DATA_TYPES` (L347), `VERSIONS = { excalidraw: 2, excalidrawLibrary: 2 }` (L419).

### History / undo
- `packages/element/src/store.ts`: `Store`, `StoreChange`, `StoreDelta`, `StoreSnapshot`, Durable/Ephemeral increments.
- `packages/element/src/delta.ts`: `AppStateDelta` (L527) and `ElementsDelta` (L1040).
- `packages/excalidraw/history.ts`: `History` (undo/redo stacks of StoreDelta). Created at App.tsx:902/910.

### Collaboration
- `excalidraw-app/collab/Collab.tsx`: room lifecycle, `syncElements`/`broadcastElements` (L971-983), `_reconcileElements` (L772), `handleRemoteSceneUpdate` (L821), `saveCollabRoomToFirebase` (L334), `loadFromFirebase` on join (L745).
- `excalidraw-app/collab/Portal.tsx`: socket wrapper. `broadcastScene` (L142) sends SCENE_INIT/SCENE_UPDATE carrying **elements only**, plus mouse/idle/visible-bounds events, all encrypted.
- `excalidraw-app/data/index.ts`: `SocketUpdateDataSource` payload types (L79), `getSyncableElements`, share-link `importFromBackend`/`exportToBackend`.
- `excalidraw-app/app_constants.ts`: `WS_EVENTS`, `WS_SUBTYPES`, `FIREBASE_STORAGE_PREFIXES`, `STORAGE_KEYS`.
- `packages/excalidraw/data/reconcile.ts`: `reconcileElements` (version-based merge).
- `excalidraw-app/data/firebase.ts`: `FirebaseStoredScene = {sceneVersion, ciphertext, iv}` (encrypted elements only), `saveToFirebase` (L190), `loadFromFirebase` (L252), `isSavedToFirebase` (L130).
- `excalidraw-app/data/FileManager.ts`: image file sync.

### Local persistence (app)
- `excalidraw-app/data/LocalData.ts`: debounced save of elements and appState to localStorage (`STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS` / `_APP_STATE`), files to IDB.
- `excalidraw-app/data/localStorage.ts`: `importFromLocalStorage`.
- `excalidraw-app/data/tabSync.ts`: cross-tab version sync.
- `excalidraw-app/App.tsx`: `initializeScene` (L217), `onChange` -> `LocalData.save` (L727), mounts Collab/AppFooter/AppMainMenu.

### UI mount points
- `packages/excalidraw/components/footer/Footer.tsx`: bottom bar (zoom + undo/redo left, `FooterCenterTunnel` centre, help right). This is the most natural host for a page tab bar. See also `footer/FooterCenter.tsx`, `FooterCenter.scss`.
- `packages/excalidraw/components/LayerUI.tsx` / `LayerUI.scss`: overall editor chrome layout and footer render.
- `packages/excalidraw/components/main-menu/MainMenu.tsx`, `DefaultItems.tsx`: menu entries (e.g. page actions).
- `packages/excalidraw/context/tunnels.ts`: UI tunnels.
- `packages/excalidraw/components/Sidebar/SidebarTabs.tsx` (+ SidebarTab, SidebarTabTrigger(s)): existing tab primitives to use as a style reference.
- `packages/excalidraw/actions/actionCanvas.tsx`, `actions/manager.tsx`: action pattern for new page actions (keyboard shortcuts, history capture).
- `packages/excalidraw/components/App.tsx` (11,493 lines): owns Scene/Store/History, `updateScene`, `resetScene` (L3553), onChange emission (L4504).
- `excalidraw-app/components/AppFooter.tsx`, `AppMainMenu.tsx`: app-level customisations.

### i18n
- `packages/excalidraw/locales/en.json`: Crowdin source (crowdin.yml). Add only English keys. The other locale files are Crowdin-managed.

### Public API
- `packages/excalidraw/index.tsx`: exports `restore*`, `serializeAsJSON`, `reconcileElements`, `loadFromBlob`, `getSceneVersion`, `Footer`, `MainMenu`, `CaptureUpdateAction`, etc.
- `packages/excalidraw/CHANGELOG.md`: package changelog.

### Tests nearby
`packages/excalidraw/tests/{appState,appStateHooks,history,export,clipboard,excalidraw,viewport}.test.tsx`, `tests/data/{restore,reconcile}.test.ts`, `tests/scene/export.test.ts`, `packages/element/tests/{delta.test.tsx,fractionalIndex.test.ts}`, `excalidraw-app/tests/{collab.test.tsx,firebase.test.ts}`. Helpers: `tests/helpers/{api,ui}.ts`, `tests/test-utils.ts`. Many of these are snapshot-heavy (`__snapshots__`). A new AppState key will likely change history/regression snapshots, so expect `yarn test:update`.

### Design observations for the architect (no decisions made)
- Element versions, collab, firebase and localStorage all assume one flat element array. Pages need either a per-element page id (single Scene, filtered rendering) or a page container in the file/appState with per-page element arrays. This affects reconcile, `getSyncableElements`, `FirebaseStoredScene`, history deltas, and restore migration.
- Per-page viewport (scrollX/scrollY/zoom) touches `APP_STATE_STORAGE_CONF` flags and `AppStateDelta`.
- The file format is at `VERSIONS.excalidraw = 2`. Decide whether this feature bumps it, and how restore handles older files that have no pages.

## Coexistence risks
- You have Copilot instructions at `.github/copilot-instructions.md`. The plugin will never touch them.
- Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. *Mitigation already present:* `.sdlc/` is in the shared `.git/info/exclude`, so the risk only applies to other clones. Adding it to `.gitignore` is optional.
- This is a git worktree with a shared stash stack. Do not use bare `git stash` for rollback.
- Husky pre-commit runs lint-staged (eslint/prettier) on commit.
- `.sdlc/pre-check-status.json` shows `ok: false`: discovery_smoke is pending and test_command_probe was skipped because the test command was unknown. The command is now proposed above.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.github/copilot-instructions.md`, `.claude/**`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated d.ts, gitignored), generated wasm wrappers `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` and `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `yarn.lock`, `.git/**`.
Advisory (not hard off-limits): non-English `packages/excalidraw/locales/*.json` (Crowdin), and `**/__snapshots__/**` (regenerate them with `yarn test:update`, don't hand-edit).

## Scan notes
- The scan took about 2 minutes, mostly the targeted test run and feature file location. Nothing was sampled.
- macOS has no `timeout(1)`. The first test attempt was a no-op and was re-run with `yarn vitest run`.
