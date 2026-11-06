# Discovery: 20261106-120000-feature-new-drawing-pages

Mode: first-time. Built 2026-11-06T04:52:39Z at HEAD `14bb42ed` on branch `EX-NF-12/argon4-plus-sonnet55` (clean). The scan was Tier 1, plus Tier 2b because no matching stack adapter exists. The profile is at `.sdlc/baseline/stack-profile.md`.

Intent: feature-new. Add pages to a drawing: a tab bar to create, rename, reorder and delete pages. Each page has its own elements and viewport. All pages are saved in one file and shared in collaboration.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79`, branch `EX-NF-12/argon4-plus-sonnet55`, working tree clean.
- Remote: `origin` -> https://github.com/tl-ai-labs/excalidraw.git
- This checkout is a **git worktree** (`.git` is a file). The stash stack is shared with other worktrees.
- 1327 tracked files.
- `.gitignore` does **not** cover `.sdlc/`. It is excluded locally by `/Users/apple/Documents/GitHub/excalidraw/.git/info/exclude` (line 7), so `git status` hides it today. That exclusion is not committed.

## Topology
Top level: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`.
- `packages/` contains common, element, excalidraw, fractional-indexing, laser-pointer, math and utils.
- `excalidraw-app/` contains app-language, collab, components, data, share and tests.
- Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx` and `packages/excalidraw/index.tsx` (the library's public API).

## Detected stacks
- Root `package.json`: node-typescript. Yarn 1 workspaces (`excalidraw-app`, `packages/*`, `examples/*`), React 19, TypeScript 5.9 strict, Vite 5, Vitest 3.
- `excalidraw-app`: React, jotai, socket.io-client, firebase and idb-keyval.
- `packages/excalidraw`: React, jotai/jotai-scope, radix-ui, tunnel-rat and sass. Built with esbuild.
- `examples/with-nextjs`: Next.js. `dev-docs`: Docusaurus.
- No pre-authored adapter matches (only generic, nest and python ship), so the Tier 2b adaptive profile was built.

## Test / build commands
- Proposed: `yarn test:app --watch=false`. Source: `package.json#scripts.test` = `yarn test:app` = `vitest`, and `yarn.lock` is present. The flag forces a single run.
- Also available: `yarn test:typecheck` (tsc), `yarn test:code` (eslint, max-warnings 0), `yarn test:other` (prettier) and `yarn fix`.
- CLAUDE.md says to run `yarn test:update` before committing. That command **rewrites snapshots**, so it can hide regressions. Use it only after a non-updating run has passed.
- The Vitest setup is jsdom with globals, `setupTests.ts` and vitest-canvas-mock. Coverage thresholds: lines 60, branches 70, functions 63.
- Pre-existing test failures: **unknown**. Tier 1 does not run tests, so a baseline run should be recorded before Phase 7.

## Docs
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md (points to the docs site), `.github/copilot-instructions.md`, `dev-docs/README.md`, `dev-docs/docs/codebase/json-schema.mdx` (documents the file format) and the package READMEs. There is no ARCHITECTURE.md or ADR directory.
- AGENTS.md rule: use `app.ownerDocument` / `app.ownerWindow` instead of the DOM globals.
- AGENTS.md rule: prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & Overrides`.

## Detected AI/agent setup
- `.claude/` and `.claude/settings.local.json` (env vars only; the folder is gitignored)
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`

Not found: `.mcp.json`, `.cursor`, `.cursorrules`, Aider config, `.continue`, `.roo`, `routing-policy.yaml` and gemini configs.

## Env keys
- Env files present and tracked: `.env.development`, `.env.production`, `.env.test`.
- **They were not read.** The permission classifier denied reading them, even for key names only. `env_keys_by_file` is empty.
- Keys referenced in code (names only): `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`, `VITE_APP_LIBRARY_URL`, `VITE_APP_LIBRARY_BACKEND`, `VITE_APP_AI_BACKEND`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_LP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`, `VITE_APP_DISABLE_SENTRY`, `VITE_APP_ENABLE_TRACKING`, `VITE_APP_GIT_SHA`, `VITE_APP_DISABLE_PREVENT_UNLOAD`, `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX`, `VITE_DEBUG_DOM`, `VITE_WORKER_ID`, `OSS_STATS_API_URL`, `OSS_STATS_TOKEN`, `PKG_NAME`, `PKG_VERSION`, `IS_PREACT` and the CI `GITHUB_*` / `RUNNER_NAME` keys.

## Monorepo / submodules / LFS / infra
- Monorepo: Yarn workspaces with 10 workspace packages. One root Vitest config covers everything.
- `@excalidraw/*` resolves to `packages/*/src` through `vitest.config.mts` and `tsconfig.json` paths, so tests need no build. To run part of the suite, filter by path.
- Submodules: none. LFS: none (`.gitattributes` only sets `* text=auto eol=lf`).
- Infra: Dockerfile, docker-compose.yml, vercel.json, firebase-project/ and 12 GitHub workflows (test, lint, size-limit, stats, and others).
- Husky pre-commit exists, but its lint-staged line is commented out.

## Regulated-repo signals
None found.

## Coexistence risks
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. Mitigation: `.git/info/exclude` in the shared repo already hides `.sdlc/` locally, so this is low risk on this machine.
- **Repo instruction files.** CLAUDE.md, AGENTS.md and copilot-instructions.md hold conventions. They are inputs and are never edited.
- **Shared stash in a worktree.** Never use a bare `git stash` here.
- **Aggressive `.gitignore`.** These unanchored patterns silently ignore any new file or folder with that name at any depth: `build`, `dist`, `html`, `firebase`, `logs`, `coverage`, `dev-dist`, `meta*.json` and `*.log`. `packages/excalidraw/types` (generated `.d.ts`) and `.claude` are ignored too. For example, a new `meta.json` or a folder named `html` would not be tracked.
- **Snapshot tests.** There are 23 snapshot files in 10 `__snapshots__` dirs. Changes to the AppState shape (for example, new page fields in `getDefaultAppState`) will change snapshots in `packages/excalidraw/tests/__snapshots__/*`.

## Proposed off-limits
`.env`, `.env.*` (including `.env.development`, `.env.production`, `.env.test`), `.claude/**`, `.github/copilot-instructions.md`, `.mcp.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `coverage/**`, `dev-dist/**`, `packages/*/dist/**`, `packages/excalidraw/types/**`, `.husky/_/**`, `.git/**`, `.sdlc/**`.

## Intent map: pages feature
- **Scene / element storage**
  - `packages/element/src/Scene.ts`: `class Scene` with `elements` / `elementsMap` / `nonDeletedElementsMap`, `replaceAllElements`, `mapElements`, `insertElementsAtIndex` and `onUpdate`/`triggerUpdate`.
  - Store and undo: `packages/element/src/store.ts` (Store, `CaptureUpdateAction`), `packages/element/src/delta.ts` and `packages/excalidraw/history.ts`.
  - `packages/element/src/types.ts`: the element base has `frameId`, `index` (fractional), `version`/`versionNonce`, `isDeleted` and `customData`. There is no page field today.
  - `packages/element/src/types.ts` also defines the `SceneElementsMap` brand.
- **AppState viewport**
  - `packages/excalidraw/appState.ts`: defaults `scrollX`/`scrollY`/`zoom`, plus the storage-config table. scrollX, scrollY and zoom are `browser: true, export: false, server: false`.
  - Also in `appState.ts`: `cleanAppStateForExport`, `clearAppStateForDatabase` and `clearAppStateForLocalStorage`.
  - `packages/excalidraw/types.ts`: `interface AppState` (line 330), `UIAppState`, `ExcalidrawProps`, `SceneData` and `ExcalidrawImperativeAPI`.
  - Viewport helpers: `packages/excalidraw/viewport.ts`.
- **Serialization**
  - `packages/excalidraw/data/json.ts`: `serializeAsJSON` writes `{type, version, source, elements, appState, files}`. Also has `loadFromJSON` and `isValidExcalidrawData`.
  - `packages/excalidraw/data/types.ts`: `ExportedDataState` and `ImportedDataState`.
  - `packages/excalidraw/data/restore.ts`: `restoreElements`, `restoreAppState` and `RestoredDataState`.
  - `packages/excalidraw/data/blob.ts`: `loadFromBlob` and `loadSceneOrLibraryFromBlob`.
  - Also: `packages/excalidraw/data/index.ts`, `packages/excalidraw/data/filesystem.ts` and the format doc `dev-docs/docs/codebase/json-schema.mdx`.
  - PNG/SVG embedded scenes go through `serializeAsJSON` via `packages/excalidraw/data/index.ts` / `image.ts`.
- **Collaboration**
  - `excalidraw-app/collab/Collab.tsx`: `syncElements`, `_reconcileElements`, `handleRemoteSceneUpdate`, `saveCollabRoomToFirebase`, and the `WS_SUBTYPES` INIT and UPDATE handlers.
  - `excalidraw-app/collab/Portal.tsx`: `broadcastScene`, `_broadcastSocketData` and `broadcastVisibleSceneBounds`.
  - `excalidraw-app/app_constants.ts`: `WS_SUBTYPES` and `WS_EVENTS`.
  - `packages/excalidraw/data/reconcile.ts`: `reconcileElements` and `shouldDiscardRemoteElement`.
  - `excalidraw-app/data/index.ts`: `getSyncableElements`, `exportToBackend` and `importFromBackend`.
  - `excalidraw-app/data/firebase.ts`: `saveToFirebase` and `loadFromFirebase`.
  - Today only elements are synced. AppState is not sent.
- **Local persistence**
  - `excalidraw-app/data/LocalData.ts`: `LocalData.save` (debounced), `saveDataStateToLocalStorage` and `LocalFileManager`.
  - `excalidraw-app/data/localStorage.ts`: `importFromLocalStorage`.
  - `excalidraw-app/data/tabSync.ts`: cross-tab version stamps.
  - `excalidraw-app/app_constants.ts`: `STORAGE_KEYS` (`excalidraw`, `excalidraw-state`, ...).
  - `excalidraw-app/App.tsx`: `onChange`, `initialData` and `<AppFooter>`.
- **UI layout**
  - `packages/excalidraw/components/LayerUI.tsx` mounts `<Footer>` around line 657, inside `.layer-ui__wrapper`.
  - `packages/excalidraw/components/footer/Footer.tsx` has left (zoom/undo), `<FooterCenterTunnel.Out/>` and right (help).
  - Also: `footer/FooterCenter.tsx`, `packages/excalidraw/context/tunnels.ts` and `LayerUI.scss`.
  - The app injects content through `excalidraw-app/components/AppFooter.tsx` (`<Footer>` -> FooterCenterTunnel).
  - Existing tab UI to borrow from: `packages/excalidraw/components/Sidebar/SidebarTabs.tsx`, `SidebarTab*.tsx`.
- **i18n**
  - `packages/excalidraw/locales/en.json`: top-level groups include `labels` (186), `buttons`, `alerts`, `errors`, `toast` and `confirmDialog`.
  - `t()` is in `packages/excalidraw/i18n.ts`.
  - There are 58 JSON files in `locales/` (en.json plus other languages and percentages.json), synced by Crowdin. Edit only en.json.
- **Tests near each area**
  - Data: `packages/excalidraw/tests/data/{restore,reconcile}.test.ts`, `tests/export.test.tsx`, `tests/scene/export.test.ts`.
  - AppState and viewport: `tests/appState.test.tsx`, `tests/viewport.test.ts`, `tests/scroll.test.tsx`.
  - History and App: `tests/history.test.tsx`, `tests/App.test.tsx`.
  - Element: `packages/element/tests/{delta,zindex}.test.tsx`.
  - App: `excalidraw-app/tests/collab.test.tsx`, `excalidraw-app/tests/firebase.test.ts`.
  - UI: `packages/excalidraw/components/Sidebar/Sidebar.test.tsx`.
  - Helpers: `packages/excalidraw/tests/helpers/{api,ui}.ts`, `tests/test-utils.ts`.
