# Discovery — 20261105-105249-feature-new-pages

Mode: first-time (full Tier 1 scan), intent hint: `feature-new`. Built 2026-11-05T05:26:05Z, plugin 0.10.1.
Tier 2b adaptive stack profile: **triggered** (React/TypeScript has no pre-authored adapter). See `.sdlc/baseline/stack-profile.md`.

## 1. Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-NF-12/argon4-agsdk-only` (last commit 2026-10-27). Working tree **clean**.
- This checkout is a **git worktree**; the shared git dir is `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw/.git`. Don't use bare `git stash`: the stash is shared across worktrees.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git.
- 1327 tracked files. No submodules, no LFS, no symlinks.
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry. `.sdlc/` is still ignored in practice, through the shared `.git/info/exclude` (line 7: `.sdlc/`) of the main checkout.

## 2. Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus docs site, not a workspace), `examples/` (`with-nextjs`, `with-script-in-browser`), `excalidraw-app/` (`collab/`, `components/`, `data/`, `share/`, `app-language/`, `tests/`), `firebase-project/`, `packages/` (`common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math`, `utils`), `public/`, `scripts/`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, private) | node-typescript | yarn@1.22.22 workspaces, vite 5, vitest 3.0.6, TypeScript 5.9.3, React 19 types |
| `excalidraw-app/package.json` | node-typescript | react, vite, jotai, socket.io-client, firebase, idb-keyval |
| `packages/excalidraw/package.json` | node-typescript | react, jotai + jotai-scope, esbuild build, @excalidraw/mermaid-to-excalidraw |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `examples/with-script-in-browser/package.json` | node-typescript | react, vite |

No pre-authored adapter matches: `generic.md`, `nest.md` and `python.md` are the only ones shipped. The adaptive profile applies, and wins over `generic.md` where they conflict.

## 4. Test / build commands
- **Proposed test command: `yarn test:app --watch=false`**, from `package.json#scripts.test` (`test` maps to `yarn test:app`, which runs `vitest`). Without `--watch=false`, vitest runs in watch mode outside CI.
- Repo rule (CLAUDE.md): run `yarn test:update` (`vitest --update --watch=false`) before committing, and `yarn test:typecheck` (`tsc`, whole repo) for type safety. Lint is `yarn test:code` (eslint, max-warnings=0); formatting is `yarn test:other` (prettier).
- To run a single file: `yarn vitest run packages/excalidraw/tests/data/restore.test.ts`.
- One root `vitest.config.mts` covers every workspace: jsdom, globals, `setupFiles: ./setupTests.ts`, path aliases for `@excalidraw/*`, and coverage thresholds of lines 60 / branches 70 / functions 63 / statements 60. There are no per-package test scripts.
- Inventory: 149 test files, 23 `.snap` files, and 0 `it.skip`/`describe.skip`/`.todo` found.
- Pre-existing failure signal: no cached vitest results were found, so baseline pass/fail is **unknown**. The orchestrator should run the suite once on the clean HEAD before Phase 7. CI (`.github/workflows/test.yml`) runs `yarn test:app` on node 20.x for pushes to master. The local node is **v24.18.0**, which could cause environment-only differences.
- Husky `pre-commit` exists, but its `yarn lint-staged` line is commented out, so nothing auto-fixes on commit.

## 5. Docs present
`README.md`, `CLAUDE.md` (monorepo layout, yarn commands), `AGENTS.md` (use `app.ownerDocument`/`app.ownerWindow` instead of globals for new DOM APIs; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & …`), `CONTRIBUTING.md` (links to docs site), `.github/copilot-instructions.md` (TS/React performance-minded standards), `dev-docs/docs/codebase/json-schema.mdx` (the `.excalidraw` file schema, relevant to the pages format), `dev-docs/docs/codebase/frames.mdx`, `dev-docs/docs/@excalidraw/*`. There are no ADR directories.

## Detected AI/agent setup
- `.claude/` (dir), with only `.claude/settings.local.json` (gitignored via `.claude` in `.gitignore`)
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`

Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `CLAUDE.local.md`, any `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## 7. Env keys (names only)
- `.env.development` (20 keys), `.env.production` (15), `.env.test` (1: `VITE_DEBUG_DOM`). All three are **tracked in git**: they hold public Vite build config such as backend URLs and `VITE_APP_FIREBASE_CONFIG`, not local secrets. Local overrides (`.env.*.local`) are gitignored, and none exist.
- Collab and persistence keys used in code: `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`.
- The full list is in `baseline.json#env_keys_referenced_in_code`. Code reads env through `import.meta.env.*` (Vite) and `process.env.*` (scripts/CI only).

## 8. Monorepo / submodules / LFS / infra
- Monorepo: **yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`). There is no nx, turbo, lerna, pnpm or rush. All tests run from the root vitest config.
- Submodules: none. LFS: none (`.gitattributes` is just `* text=auto eol=lf`).
- Entry points: `excalidraw-app/index.tsx` and `App.tsx` (app), `packages/excalidraw/index.tsx` (library public API), `packages/*/src/index.ts`.
- Infra: `Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/` (`firestore.rules`, `storage.rules`), and 12 GitHub workflows (test, lint, size-limit, stats, docker, autorelease, …).
- Generated files: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts` and `packages/excalidraw/subset/woff2/woff2-wasm.ts`.

## Feature map for multi-page work (orientation only, no design)
- **Scene model / undo:** `packages/element/src/Scene.ts` (`class Scene`, `replaceAllElements`, `getElementsIncludingDeleted`), `packages/element/src/store.ts` (`Store`, `CaptureUpdateAction`, `StoreSnapshot`/`StoreDelta`), `packages/excalidraw/history.ts` (`History`, `HistoryDelta`). The editor host is `packages/excalidraw/components/App.tsx` (11.5k lines; `public updateScene` at about line 4974). The imperative API type is `ExcalidrawImperativeAPI` in `packages/excalidraw/types.ts` (line 1390), next to `ExcalidrawProps` (843) and `interface AppState` (330).
- **AppState persistence rules:** `packages/excalidraw/appState.ts`, where `APP_STATE_STORAGE_CONF` (line 159) gives each key a `{browser, export, server}` flag and drives `cleanAppStateForExport`, `clearAppStateForLocalStorage` and `clearAppStateForDatabase`. The viewport (scrollX/scrollY/zoom) lives in AppState.
- **Serialization (.excalidraw JSON):** `packages/excalidraw/data/json.ts` (`serializeAsJSON(elements, appState, files, "local"|"database")`, `saveAsJSON`, `loadFromJSON`, `isValidExcalidrawData`), `packages/excalidraw/data/types.ts` (`ExportedDataState`, `ImportedDataState`), `packages/excalidraw/data/restore.ts` (`restoreElements`, `restoreAppState`, `bumpElementVersions`, legacy migration, 1.4k lines), `packages/excalidraw/data/blob.ts` (`loadFromBlob`, `loadSceneOrLibraryFromBlob`), `packages/excalidraw/data/index.ts` (export paths). The public re-exports are in `packages/excalidraw/index.tsx` (around lines 418-463). The schema doc is `dev-docs/docs/codebase/json-schema.mdx`.
- **localStorage (app):** `excalidraw-app/data/LocalData.ts` (`saveDataStateToLocalStorage`, debounced `LocalData.save`/`flushSave`/`pauseSave`), `excalidraw-app/data/localStorage.ts` (`importFromLocalStorage`), `excalidraw-app/data/tabSync.ts` (cross-tab version stamps), and `excalidraw-app/app_constants.ts` (`STORAGE_KEYS`: `excalidraw` = elements, `excalidraw-state` = appState, plus version keys). Files go to IndexedDB through `idb-keyval` in LocalData. The library side is `packages/excalidraw/data/EditorLocalStorage.ts`. The app wiring is in `excalidraw-app/App.tsx` (`importFromLocalStorage` at lines 233 and 607, `LocalData.save` at 727).
- **Firebase:** `excalidraw-app/data/firebase.ts` (`saveToFirebase`, `loadFromFirebase`, with Firestore doc `scenes/<roomId>` holding encrypted elements, and the file helpers), and `excalidraw-app/data/index.ts` (`isSyncableElement`, `getSyncableElements`, `SocketUpdateData*` types, `exportToBackend`/`importFromBackend` for share links). Rules are in `firebase-project/firestore.rules`.
- **Collab sync:** `excalidraw-app/collab/Collab.tsx` (`startCollaboration`, `initializeRoom`, `_reconcileElements` → `restoreElements` + `reconcileElements` + `bumpElementVersions`, `handleRemoteSceneUpdate` → `updateScene({captureUpdate: NEVER})`, `syncElements`/`broadcastElements`, `saveCollabRoomToFirebase`), `excalidraw-app/collab/Portal.tsx` (`broadcastScene(WS_SUBTYPES.INIT|UPDATE, elements, syncAll)` tracking per-element `broadcastedElementVersions`, and `_broadcastSocketData` with encryption), `packages/excalidraw/data/reconcile.ts` (`reconcileElements`, `shouldDiscardRemoteElement`), and `excalidraw-app/app_constants.ts` (`WS_EVENTS`, `WS_SUBTYPES`: `SCENE_INIT`, `SCENE_UPDATE`, `MOUSE_LOCATION`, `IDLE_STATUS`, `USER_VISIBLE_SCENE_BOUNDS`).
- **UI shell for a tab bar:** `packages/excalidraw/components/LayerUI.tsx`, `packages/excalidraw/components/footer/Footer.tsx` and `FooterCenter.tsx`, actions under `packages/excalidraw/actions/` (`register({...})` pattern), and strings in `packages/excalidraw/locales/en.json` (59 locale files; edit only `en.json`).
- **Relevant existing tests:** `packages/excalidraw/tests/data/restore.test.ts`, `tests/data/reconcile.test.ts`, `tests/scene/export.test.ts`, `tests/history.test.tsx`, `excalidraw-app/tests/collab.test.tsx`, `excalidraw-app/tests/firebase.test.ts`. Snapshot tests exist, so new AppState keys will probably change snapshots, and `yarn test:update` is the expected workflow.
- There is **no existing "page" concept**: a grep for `currentPage|activePage|pageId` found no matches.

## Regulated-repo signals
None detected. `.github/` has no `SECURITY.md` (only `FUNDING.yml`), no compliance directories, and no CODEOWNERS with security, compliance or legal teams. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored.** "Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run." Note: today `.sdlc/` *is* ignored through the shared `.git/info/exclude` of the main checkout (`git status --ignored` shows `!! .sdlc/`), so the practical risk is low. It is fragile, though, because a fresh clone or another machine won't have that exclude.
- **Repo-level agent instructions** (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`) are read-only. The architect should carry their rules into the change spec: ownerDocument/ownerWindow, `Merge<>`, immutable/perf-minded TS, and running `yarn test:update`/`yarn test:typecheck`.
- **Claude Code local settings** (`.claude/settings.local.json`) stay untouched.
- **Worktree with a shared stash.** Use temp WIP commits or tagged stashes only.
- **Node version mismatch.** Local v24.18.0 vs CI 20.x.
- No Cursor, Aider, custom MCP or repo-local routing-policy, so there are no tool-coexistence conflicts.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `.sdlc/**`, `node_modules/**` (+ nested), `dist/**`, `build/**` (+ nested), `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**` (generated, gitignored), `.git/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`.
Not off-limits, but worth reviewing at Gate 0: `firebase-project/firestore.rules` (security rules; change only if the per-page Firestore layout requires it) and `packages/excalidraw/locales/*.json` other than `en.json` (Crowdin-managed).

## Timing / bounds
The full scan finished well inside the timebox. No sampling was needed: 1327 tracked files and 11 top-level dirs.

## User decisions (recorded after discovery)
- Add `.sdlc/` to `.gitignore`: **declined (n)**. `.gitignore` stays out of the allowlist; `.sdlc/` stays ignored only through the shared `.git/info/exclude`.
- Auth mode: **vendor** (not estimated).
- Everything else, both decisions included: accepted as proposed.
