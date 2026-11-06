# Requirements — Pages in a Drawing (Tab Bar)

Run ID: `20261105-105249-feature-new-pages`  
Mode: `brownfield` · Intent: `feature-new` · Policy: `argon4-agsdk-only` · Auth mode: `vendor`

---

## In scope

1. **Multi-page data model and active-page scene filtering** (`packages/element/src/**`, `packages/common/src/**`, `packages/excalidraw/scene/**`): Support one or more ordered, named pages in a drawing, each with its own elements and independent viewport (`scrollX`, `scrollY`, `zoom`). Filter active-page elements for rendering, hit-testing, selection, lasso, eraser, snapping, frames, clipboard, and library insertion while preserving all pages in the underlying scene/data model.
2. **Opt-in tab bar UI and page actions** (`packages/excalidraw/components/**`, `packages/excalidraw/actions/**`, `packages/excalidraw/css/**`, `packages/excalidraw/locales/en.json`): Provide a tab bar component and registered editor actions to create, switch, rename, reorder, and delete pages. The tab bar is off by default in `@excalidraw/excalidraw` (configured via `UIOptions` / props) and enabled in `excalidraw-app` (`excalidraw-app/App.tsx`).
3. **Per-page viewport persistence** (`packages/excalidraw/appState.ts`, `packages/excalidraw/viewport.ts`, `packages/excalidraw/components/App.tsx`): Save and restore each page's viewport (`scrollX`, `scrollY`, `zoom`) when switching between pages and across serialization/restore boundaries.
4. **Page-scoped undo/redo history** (`packages/excalidraw/history.ts`, `packages/element/src/store.ts`): Scope undo and redo operations so that element edits undo/redo on their respective page without corrupting or unexpectedly mutating inactive pages.
5. **Cross-page canvas search** (`packages/excalidraw/components/**`): Allow canvas search to find matching text elements across pages and switch to the target page when navigating to a match on another page.
6. **Library API support and embedder page preservation** (`packages/excalidraw/types.ts`, `packages/excalidraw/index.tsx`, `packages/excalidraw/components/App.tsx`): Accept page data and active page selection via `initialData` and `updateScene`, and expose all pages and active page state via `onChange` and `ExcalidrawImperativeAPI`. When the tab bar is off in an embedder, render the active page while keeping all other pages intact through `onChange`, save, and JSON export (Gate 0 decision #2).
7. **Serialization, restore, backward compatibility, and single-page visual export** (`packages/excalidraw/data/**`, `packages/excalidraw/scene/export.ts`): Round-trip all pages (order, names, elements, per-page viewports, and active page) in `.excalidraw` JSON files (`serializeAsJSON`, `saveAsJSON`, `loadFromJSON`, `loadFromBlob`, `restore`, `restoreAppState`, `restoreElements`). Restore legacy single-page `.excalidraw` files (without page metadata) onto a single default page. Export only the active page's elements when exporting a page to PNG, SVG, or canvas/clipboard image.
8. **App local storage, share links (`#json=`), collaboration, and Firebase persistence** (`excalidraw-app/App.tsx`, `excalidraw-app/app_constants.ts`, `excalidraw-app/data/**`, `excalidraw-app/collab/**`):
   - Persist and restore all pages and the active page in `excalidraw-app` local autosave (`LocalData.ts`, `localStorage.ts`).
   - Round-trip all pages, their order, and the active page in share links (`#json=` via `exportToBackend` and `importFromBackend` in `excalidraw-app/data/index.ts`, Gate 0 decision #1).
   - Synchronize and reconcile page membership and page operations (create, rename, reorder, delete) across collaborators via `Portal.tsx`, `Collab.tsx`, `reconcile.ts`, and Firebase scene storage (`firebase.ts`).
9. **Automated tests, snapshots, and companion documentation** (`packages/element/tests/**`, `packages/excalidraw/tests/**`, `excalidraw-app/tests/**`, `**/__snapshots__/**`, `packages/excalidraw/CHANGELOG.md`, `dev-docs/docs/**` in allowlist): Add unit and jsdom integration tests covering every acceptance criterion, update affected test snapshots via `yarn test:update`, and document the schema and API changes in the allowed documentation files.

---

## Out of scope

1. **Modifying `.gitignore`** (Gate 0 decision #4: declined adding `.sdlc/` to `.gitignore`; `.sdlc/` remains ignored only via the local checkout's `.git/info/exclude`).
2. **Locale translations other than English** (`packages/excalidraw/locales/*.json` except `packages/excalidraw/locales/en.json` are managed by Crowdin and off-limits).
3. **Firestore security rules** (`firebase-project/firestore.rules` is off-limits).
4. **Two-client end-to-end WebSocket collaboration test** (collaboration is verified via unit/integration tests on reconciliation and app sync payloads rather than a multi-browser E2E harness).
5. **Per-page access permissions, page templates, page preview thumbnails, or cross-page element hyperlinks**.
6. **Multi-page image or PDF batch export** (visual export of a page exports only that single active page).
7. **Changes to off-limits packages and directories**, including `examples/**`, `packages/utils/**`, `packages/math/**`, `excalidraw-app/share/**`, generated files (`packages/excalidraw/types/**`, wasm bundles), and repo AI configuration files (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/**`).

---

## Functional requirements per module

### Module 1: Element Model & Scene (`packages/element/src/**`, `packages/common/src/**`)

- **FR-1 (Page representation and membership):** Define shared page types and constants in `packages/common/src/**` and/or `packages/element/src/**` (such as page descriptor `{ id, name, viewport? }` and element-to-page association or per-page element structures, as selected in Phase 2 architecture). Every page must have a stable unique ID and display name, and a drawing must always have at least one page.
- **FR-2 (Active-page scene queries vs. full-document access):** `Scene` (`packages/element/src/Scene.ts`) must distinguish between active-page elements (used by canvas rendering, hit-testing, bounding boxes, frames, snapping, and interactive tools) and full-document elements across all pages (used by serialization, persistence, collaboration sync, and `onChange` preservation).
- **FR-3 (Default page fallback):** Elements or scenes loaded without page metadata must automatically associate with the drawing's default page without mutating element geometry or losing elements.

### Module 2: Editor State, Viewport & History (`packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/viewport.ts`, `packages/excalidraw/history.ts`, `packages/element/src/store.ts`)

- **FR-4 (AppState page state and storage config):** Extend `AppState` in `packages/excalidraw/types.ts` and `getDefaultAppState()` / `APP_STATE_STORAGE_CONF` in `packages/excalidraw/appState.ts` to hold the ordered list of pages, the active page ID, and per-page viewports (`scrollX`, `scrollY`, `zoom`). Configure `APP_STATE_STORAGE_CONF` so that page metadata is retained for `browser`, `export`, and `server` storage targets.
- **FR-5 (Per-page viewport isolation):** When switching from page A to page B, capture page A's current viewport (`scrollX`, `scrollY`, `zoom`), update the active page to page B, restore page B's saved viewport (or default initial viewport for a newly created page), and clear transient active-page interaction state (selection, active text editing, hovered/suggested bindings, editing group/frame).
- **FR-6 (Page-scoped undo/redo):** Ensure `History` (`packages/excalidraw/history.ts`) and `Store` (`packages/element/src/store.ts`) scope undo/redo operations so that undo/redo stays on its page: undoing or redoing on a page applies only to that page's history and never switches the active page or mutates other pages, keeping each page's element history isolated.

### Module 3: Tab Bar UI, Editor Surface Filtering & Search (`packages/excalidraw/components/**`, `packages/excalidraw/actions/**`, `packages/excalidraw/lasso/**`, `packages/excalidraw/eraser/**`, `packages/excalidraw/hooks/**`, `packages/excalidraw/renderer/**`, `packages/excalidraw/scene/**`, `packages/excalidraw/clipboard.ts`, `packages/excalidraw/snapping.ts`, `packages/excalidraw/css/**`, `packages/excalidraw/locales/en.json`)

- **FR-7 (Opt-in tab bar configuration):** Add a UI option (e.g., under `UIOptions` in `packages/excalidraw/types.ts`) that defaults to `false` in `@excalidraw/excalidraw` and is enabled (`true`) in `excalidraw-app/App.tsx`. When disabled, the tab bar is not rendered and existing single-page integrations look and behave identically to before.
- **FR-8 (Tab bar page operations):** When the tab bar is enabled, render tabs in page order and support:
  1. **Create page:** Add a new page with a default sequential name (e.g., `"Page 2"`), switch to it, and initialize its default viewport.
  2. **Switch page:** Click a tab to make that page active and restore its elements and viewport on the canvas.
  3. **Rename page:** Edit a page's name inline or via action, trimming empty input to a non-empty fallback name.
  4. **Reorder pages:** Move a page earlier or later in the tab bar order, preserving the active page and all elements.
  5. **Delete page:** Delete a page (preventing deletion when only one page remains, or resetting to a single page), removing or tombstoning its elements and switching to an adjacent remaining page.
- **FR-9 (Active-page isolation in tools and rendering):** Ensure rendering (`packages/excalidraw/renderer/**`), selection, hit-testing, lasso (`packages/excalidraw/lasso/**`), eraser (`packages/excalidraw/eraser/**`), snapping (`packages/excalidraw/snapping.ts`), frames, clipboard copy/cut/paste (`packages/excalidraw/clipboard.ts`), and library item insertion operate strictly on the active page's elements. Elements pasted or inserted from the library are placed onto the currently active page.
- **FR-10 (Search across pages):** Update canvas search (`packages/excalidraw/components/**`) so text queries search elements across all pages, display matches, and automatically switch the active page when the user selects a search result located on another page.
- **FR-11 (English locale strings):** Add all user-facing labels, tooltips, and accessibility strings for the tab bar and page actions to `packages/excalidraw/locales/en.json` only.

### Module 4: Library Public API & Embedder Safety (`packages/excalidraw/index.tsx`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/types.ts`)

- **FR-12 (Library API page support):** Support initializing and updating pages and the active page via `initialData` and `updateScene`, and expose page state and all pages' elements through `onChange(elements, appState, files)` and `ExcalidrawImperativeAPI` (`getAppState`, `getSceneElements`, `getSceneElementsIncludingDeleted`, `updateScene`).
- **FR-13 (Non-destructive embedder round-trip with tab bar off — Gate 0 decision #2):** When an embedder mounts `<Excalidraw>` with the tab bar off (the default) and loads multi-page data, the canvas displays the active page, while all inactive pages and their elements remain intact in memory and are preserved through `onChange`, `serializeAsJSON` / file save, and backend export. An embedder saving data from `onChange` must never silently drop inactive pages.

### Module 5: Serialization, Restore & Export (`packages/excalidraw/data/**`, `packages/excalidraw/scene/export.ts`)

- **FR-14 (`.excalidraw` JSON serialization and restore):** `serializeAsJSON`, `saveAsJSON`, `loadFromJSON`, `loadFromBlob`, `restore`, `restoreAppState`, and `restoreElements` (`packages/excalidraw/data/json.ts`, `restore.ts`, `blob.ts`, `types.ts`) must serialize and restore all pages, their order, names, per-page viewports, active page ID, and elements across all pages.
- **FR-15 (Backward compatibility for legacy files):** Loading a legacy `.excalidraw` file or `initialData` payload that has no page fields must restore all elements onto a single default page with the file's `scrollX`, `scrollY`, and `zoom` preserved.
- **FR-16 (Single-page visual export):** Exporting a drawing to an image or vector graphic (`exportScene` and `exportToClipboard` in `packages/excalidraw/scene/export.ts` and `packages/excalidraw/data/**`) must render and export only the elements belonging to the active page.

### Module 6: App Persistence, Share Links & Collaboration (`excalidraw-app/App.tsx`, `excalidraw-app/app_constants.ts`, `excalidraw-app/data/**`, `excalidraw-app/collab/**`)

- **FR-17 (Local autosave persistence):** `LocalData` and `importFromLocalStorage` (`excalidraw-app/data/LocalData.ts`, `excalidraw-app/data/localStorage.ts`, `excalidraw-app/App.tsx`) must persist and restore all pages, per-page viewports, all pages' elements, and the active page across browser reloads.
- **FR-18 (Share links `#json=` carry every page — Gate 0 decision #1):** `exportToBackend` and `importFromBackend` in `excalidraw-app/data/index.ts` must serialize and deserialize all pages, their order, their elements, per-page viewports, and the active page so share links (`#json=`) round-trip the complete multi-page drawing. Including image files referenced by elements on any page in the share link upload.
- **FR-19 (Collaboration sync and reconciliation):** `Collab.tsx`, `Portal.tsx`, `firebase.ts`, and `reconcileElements` (`packages/excalidraw/data/reconcile.ts`) must broadcast, encrypt/save to Firebase (`scenes/<roomId>`), and reconcile both element page membership and page list operations (create, rename, reorder, delete) so concurrent local and remote updates converge consistently without losing pages or orphaning elements.

### Module 7: Companion Documentation (`packages/excalidraw/CHANGELOG.md`, `dev-docs/docs/**`)

- **FR-20 (Documentation updates):** Update `packages/excalidraw/CHANGELOG.md`, `dev-docs/docs/codebase/json-schema.mdx`, `dev-docs/docs/@excalidraw/excalidraw/api/props/initialdata.mdx`, `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx`, `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`, and `dev-docs/docs/@excalidraw/excalidraw/api/props/ui-options.mdx` to document the multi-page JSON schema fields, `UIOptions` tab bar toggle, `initialData` / `onChange`, and imperative API support.

---

## Non-functional requirements

- **NFR-1 (Backward & forward file compatibility):** The `.excalidraw` JSON format must remain backward compatible with legacy single-page files and structured so that existing embedders consuming `(elements, appState, files)` via `onChange` and `serializeAsJSON` preserve multi-page drawings without data loss.
- **NFR-2 (DOM & TypeScript codebase conventions):** Follow `AGENTS.md` and `.github/copilot-instructions.md` rules: use `app.ownerDocument` / `app.ownerWindow` instead of global `document` / `window` for any new DOM API usage in `packages/excalidraw`, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & ...`, and maintain strict TypeScript type safety (`yarn test:typecheck` passes with 0 errors and `yarn test:code` passes with 0 warnings).
- **NFR-3 (Performance & render caching):** Active-page element filtering must avoid unnecessary per-frame array allocations when the scene and active page have not changed, preserving existing scene version / memoization semantics.
- **NFR-4 (End-to-end encryption in collaboration and share links):** Page metadata and multi-page elements transmitted through WebSocket collaboration (`Portal.tsx`), Firebase (`firebase.ts`), and backend share links (`excalidraw-app/data/index.ts`) must use the existing client-side AES-GCM encryption pipeline without exposing plaintext page names or element contents to backend servers.
- **NFR-5 (Snapshot discipline):** Snapshot updates (`**/__snapshots__/**`) regenerated via `yarn test:update` must be strictly limited to the new page-related `AppState` and serialization keys.

---

## PII inventory

Excalidraw is a client-side drawing library and web application with end-to-end encrypted sharing and collaboration. This feature introduces no user account, identity, or telemetry fields. User-authored content within page names and elements is inventoried below:

| Field | Sensitivity | Protection |
|---|---|---|
| `page.id` (generated identifier) | None (random/opaque client ID) | Stored in client memory, `localStorage`, `.excalidraw` JSON, and E2E-encrypted payloads |
| `page.name` (user-authored tab title) | Low / User-authored content (may contain project or diagram names entered by user) | Stored locally in browser `localStorage` / file export; encrypted client-side with AES-GCM before transmission to share-link backend (`exportToBackend`) or Firebase/WebSocket collab rooms |
| `page.viewport` (`scrollX`, `scrollY`, `zoom`) | None (numeric canvas coordinates) | Stored locally and inside E2E-encrypted share/collab payloads |
| Collaborator `username` / `socketId` (existing collab metadata) | Low (ephemeral display handle) | Unchanged by this feature; transmitted over encrypted room channel per existing `Collab.tsx` / `Portal.tsx` design |

---

## Role matrix

Per Gate 0 non-goals, there are no per-page access control permissions. Access is governed by editor mode (`viewModeEnabled`, `interaction`, `UIOptions`) and collaboration room participation:

| Role | Resource | Action | Permitted Behavior |
|---|---|---|---|
| **Interactive Editor User (tab bar enabled, e.g. `excalidraw-app`)** | Pages & Tab Bar | Create, switch, rename, reorder, delete pages | Full access via tab bar UI, context controls, keyboard/actions, and canvas search |
| **Interactive Editor User (tab bar enabled)** | Active Page Elements & Viewport | View, draw, edit, select, undo/redo, pan/zoom, export image/JSON | Edits and visual exports apply to the active page; JSON save exports all pages |
| **View-Mode User (`viewModeEnabled: true` or `interaction: false`, tab bar enabled)** | Pages & Tab Bar | Switch pages and pan/zoom per-page viewport | Can switch tabs to view any page; cannot create, rename, reorder, or delete pages or mutate elements |
| **Embedder / Host App User (tab bar disabled — default in `@excalidraw/excalidraw`)** | Active Page & Hidden Pages | View/edit active page; programmatic access via `initialData`, `updateScene`, `onChange`, `ExcalidrawImperativeAPI` | Tab bar UI is hidden; user sees and edits the active page; inactive pages remain intact in state and survive `onChange`, save, and export |
| **Collaborator (in `#room=` session)** | Shared Multi-Page Scene | Create, switch, rename, reorder, delete pages; edit elements on any page | Page list and element membership sync and reconcile across all room participants; each collaborator controls their own active page and local viewport |
| **Share-Link Recipient (`#json=`)** | Imported Multi-Page Drawing | Load and view/edit all shared pages | Receives all pages, their order, elements, viewports, and initial active page from the decrypted share payload |

---

## Acceptance criteria

Every acceptance criterion below is verifiable via the confirmed test command:
```bash
yarn test:typecheck && yarn test:code && yarn test:app --watch=false
```
or by running `yarn vitest run <test-file>`.

- **AC-1 (Opt-in tab bar default off in library, on in app):** By default in `<Excalidraw />` (`@excalidraw/excalidraw`), the page tab bar is not rendered and existing single-page integrations behave unchanged; when opted in via `UIOptions` (and by default in `excalidraw-app`), the tab bar renders. *(Executable in `packages/excalidraw/tests/pages.test.tsx` and `excalidraw-app/tests/collab.test.tsx` via `yarn test:app --watch=false`)*
- **AC-2 (Tab bar CRUD and reorder operations):** In jsdom tests rendering `<Excalidraw>` with the tab bar enabled, a user can create a page, switch between pages, rename a page, reorder pages, and delete a page (with deletion prevented or guarded when only one page remains). *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-3 (Active-page isolation for rendering, selection, and tools):** In jsdom tests, elements created on Page 1 are rendered and selectable on Page 1, and are neither rendered nor selectable (by click, box selection, lasso, or eraser) when switched to Page 2, and vice versa. *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-4 (Per-page independent viewport):** Each page retains its own `scrollX`, `scrollY`, and `zoom`; panning/zooming on Page 1, switching to Page 2 (with a different pan/zoom), and switching back to Page 1 restores Page 1's exact `scrollX`, `scrollY`, and `zoom`. *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-5 (Page-scoped undo/redo):** Drawing or modifying elements on Page 1, switching to Page 2, and triggering undo/redo stays on its page: undo/redo on a page applies only to that page's history and never switches pages or mutates other pages. *(Executable in `packages/excalidraw/tests/pages.test.tsx` and `packages/excalidraw/tests/history.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-6 (Single-page visual export):** Exporting a page (via `exportScene` and `exportToClipboard` in `packages/excalidraw/scene/export.ts`) includes only the active page's elements and excludes elements belonging to other pages. *(Executable in `packages/excalidraw/tests/scene/export.test.ts` and `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/scene/export.test.ts`)*
- **AC-7 (Multi-page `.excalidraw` JSON round-trip and legacy restore):** Saving a multi-page drawing via `serializeAsJSON` and restoring it via `loadFromJSON` / `restore` preserves every page, page order, page name, element-to-page membership, per-page viewport, and active page. Restoring a legacy `.excalidraw` file without page fields places all elements onto one default page. *(Executable in `packages/excalidraw/tests/data/restore.test.ts` and `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/data/restore.test.ts`)*
- **AC-8 (Library API `initialData`, `updateScene`, `onChange`, and imperative API):** `initialData` and `api.updateScene` accept multi-page state and active page selection, and `onChange` and `ExcalidrawImperativeAPI` (`getAppState`, `getSceneElements`, `getSceneElementsIncludingDeleted`) expose all pages and the active page state. *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-9 (Embedder with tab bar off preserves hidden pages — Gate 0 decision #2):** Mounting `<Excalidraw>` with the tab bar off and loading a multi-page drawing displays the active page, while editing the active page keeps all other pages and their elements intact in `onChange`, `serializeAsJSON`, and save/export outputs. *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-10 (Share links `#json=` round-trip every page — Gate 0 decision #1):** `exportToBackend` and `importFromBackend` in `excalidraw-app/data/index.ts` round-trip all pages, their order, names, viewports, elements, and the active page. *(Executable in `excalidraw-app/tests/collab.test.tsx` or `packages/excalidraw/tests/pages.test.tsx` via `yarn test:app --watch=false`)*
- **AC-11 (`excalidraw-app` local autosave round-trip):** Saving state via `LocalData` (`saveDataStateToLocalStorage`) and restoring via `importFromLocalStorage` preserves all pages, their elements, viewports, and the active page across a reload. *(Executable in `excalidraw-app/tests/collab.test.tsx` or `packages/excalidraw/tests/pages.test.tsx` via `yarn test:app --watch=false`)*
- **AC-12 (Collaboration reconciliation of pages and elements):** `reconcileElements` and the app collaboration sync/reconcile path (`Collab.tsx` / `firebase.ts`) keep element page membership and page operations (create, rename, reorder, delete) consistent when local and remote updates merge. *(Executable in `packages/excalidraw/tests/data/reconcile.test.ts` and `excalidraw-app/tests/collab.test.tsx` via `yarn vitest run packages/excalidraw/tests/data/reconcile.test.ts`)*
- **AC-13 (Cross-page search):** Searching for text matches elements across all pages and selecting a match on an inactive page switches the active page to that element's page. *(Executable in `packages/excalidraw/tests/pages.test.tsx` via `yarn vitest run packages/excalidraw/tests/pages.test.tsx`)*
- **AC-14 (Full verification suite and snapshots pass):** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` passes with zero errors, and any snapshot diffs updated via `yarn test:update` contain only the expected page-related keys.

---

## Open questions for HITL

None. All product, scope, embedder, share-link, test, and `.gitignore` questions were resolved and frozen at Gate 0 (2026-11-05). The internal representation choice (page ID property on elements vs. per-page element arrays) is explicitly delegated by the approved brief to Phase 2 (`architecture_design`) under the constraints that file format backward compatibility is preserved and embedders saving from `onChange` cannot silently lose unseen pages.
