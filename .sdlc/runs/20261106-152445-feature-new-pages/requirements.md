# Requirements — Pages in a Drawing (`20261106-152445-feature-new-pages`)

- **Mode:** brownfield
- **Intent:** `feature-new`
- **Run ID:** `20261106-152445-feature-new-pages`
- **Source Brief:** `.sdlc/runs/20261106-152445-feature-new-pages/intent_brief.md` (Gate 0 approved 2026-11-06)
- **Discovery & Baseline:** `.sdlc/runs/20261106-152445-feature-new-pages/discovery.md`, `.sdlc/baseline/stack-profile.md`

---

## In scope

1. **Ordered named pages per drawing:** Support an ordered list of named pages (`id`, `name`, and per-page viewport state `scrollX`, `scrollY`, `zoom`) in a drawing, initialized with a single default page having a fixed, deterministic constant ID.
2. **Page tab bar UI and actions:** Provide a tab bar component in the editor UI (`packages/excalidraw`) and corresponding editor actions allowing users to create a new page, switch the active page, rename any page, reorder pages, and delete a page (when more than one page exists).
3. **Per-page element isolation and scene filtering:** Scope rendering, hit-testing, selection, select-all/deselect, element dragging/transforming, arrow/text binding, grouping, framing, and library item insertion strictly to the active page's elements.
4. **Per-page viewport state preservation:** Preserve and restore each page's independent viewport (`scrollX`, `scrollY`, `zoom`) when switching between pages.
5. **Page-scoped undo/redo history:** Ensure undo and redo operations only affect the page where the change occurred and never inadvertently mutate, reveal, or corrupt elements belonging to other pages.
6. **Page-scoped scene export and multi-page file serialization:** Export only the active page's elements for single-page image/SVG/canvas exports, while serializing all pages (metadata, order, active page, and elements across all pages) when saving a `.excalidraw` JSON file (`serializeAsJSON` / `ExportedDataState`).
7. **Backward-compatible restore for legacy files:** Restore `.excalidraw` files or initial data payloads created before pages existed onto the single default page with zero data loss and without drawing from random ID/integer generators.
8. **Cross-page search:** Extend `SearchMenu` so text search locates matching elements across all pages and switching/selecting a match on another page activates that page and scrolls to the element.
9. **Live collaboration for pages and elements:** Synchronize page metadata (creation, rename, reorder, deletion) and page-scoped elements across peers via `WS_SUBTYPES`, `Portal`, `Collab`, `reconcileElements`, and Firebase/share links.
10. **Local storage persistence and tab sync:** Persist and restore the ordered page list, active page, per-page viewports, and all pages' elements in `excalidraw-app` local storage (`LocalData`, `localStorage`, `tabSync`).
11. **English locale and companion documentation updates:** Add all new UI translation keys exclusively to `packages/excalidraw/locales/en.json` and update the four in-scope documentation files under `dev-docs/docs/`.

---

## Out of scope

1. **Cross-page element relationships:** Binding arrows, grouping elements, or framing elements across different pages. Arrows, groups, and frames remain strictly within a single page.
2. **Dedicated "Move to page" command:** No special command or menu action to move elements between pages; standard copy on one page and paste on another is sufficient.
3. **Page thumbnails and per-page canvas styling:** No visual thumbnail previews in the tab bar, and no per-page background color or grid configuration.
4. **Multi-page batch export:** No exporting of all pages simultaneously (such as multi-page PDF or ZIP archives); image/SVG export remains scoped to the active page.
5. **Per-page libraries or collaboration permissions:** No separate element library per page and no per-page access control/permissions in collaboration sessions.
6. **Non-English translations:** No edits to `packages/excalidraw/locales/*.json` other than `en.json` (Crowdin manages all other locale files).
7. **External packages and off-limits files:** No changes to `package.json`, `yarn.lock`, `.gitignore`, `.env*`, build configs, or any file outside the Gate 0 allowlist.

---

## Functional requirements per module

### 1. `packages/element` (`packages/element/src/**`, `packages/element/tests/**`)

- **FR-1 (Element / Scene Page Membership Representation):** Support associating elements with a specific page (either via an optional/defaulted `pageId` property on `ExcalidrawElement` in `packages/element/src/types.ts` or per-page element collections in `Scene.ts`, per the Gate 1/2 architectural decision) while defaulting any element without explicit page metadata to the constant default page ID.
- **FR-2 (Scene Active-Page Filtering):** Update `Scene` (`packages/element/src/Scene.ts`) so that scene queries used by the editor pipeline (`getNonDeletedElements`, `getElementsIncludingDeleted`, selection helpers, and element maps) return active-page elements for canvas operations while providing explicit accessors for full-drawing elements across all pages (needed for serialization, storage, reconciliation, and cross-page search).
- **FR-3 (Page-Scoped Scene Operations):** Ensure `binding.ts`, `dragElements.ts`, `linearElementEditor.ts`, `transform.ts`, `frame.ts`, `groups.ts`, and selection modules operate exclusively on elements belonging to the active page so no cross-page bindings, group memberships, or frame memberships can form.
- **FR-4 (Store and Delta Page Awareness):** Ensure `store.ts` and `delta.ts` track element and state mutations with page awareness so that deltas captured for undo/redo and collaboration preserve page membership and do not leak elements across pages.

### 2. `packages/excalidraw` (`packages/excalidraw/**`)

- **FR-5 (AppState Page Model & Storage Configuration):** Define page types (`ExcalidrawPage` with `id`, `name`, `scrollX`, `scrollY`, `zoom` or equivalent viewport map) and add `pages` and `activePageId` to `AppState` in `packages/excalidraw/types.ts`, `getDefaultAppState()` in `packages/excalidraw/appState.ts`, and `APP_STATE_STORAGE_CONF` (with appropriate `browser`, `export`, and `server` persistence flags so `tsc` passes and state persists across targets).
- **FR-6 (Deterministic Default Page Initialization):** Initialize the default page in `getDefaultAppState()` and `restore` using a fixed constant ID (e.g., `DEFAULT_PAGE_ID`) and static default name without invoking `randomId()`, `randomInteger()`, or `Math.random()` during component mount, `restore`, legacy file load, or element creation.
- **FR-7 (Page Management Actions):** Register and export editor actions (`packages/excalidraw/actions/`) for creating a page, switching the active page, renaming a page, reordering pages, and deleting a page (preventing deletion of the last remaining page, or resetting cleanly, and cleaning up/marking deleted the removed page's elements). Creating a new page via user action may draw a new `randomId()`.
- **FR-8 (Page Tab Bar UI Component):** Implement a tab bar UI component and companion stylesheet (`packages/excalidraw/components/`) rendered in the editor layout (`LayerUI.tsx` / footer area) that displays the ordered list of page tabs, highlights the active page, switches pages on click, supports inline or modal page renaming, reorders tabs, adds a new page via a button, and deletes pages.
- **FR-9 (Per-Page Viewport Switching):** In `App.tsx` / `App.viewport.ts`, save the outgoing page's `scrollX`, `scrollY`, and `zoom` when switching away from a page, and restore the incoming page's `scrollX`, `scrollY`, and `zoom` (and clear active selection/editing state from the previous page) when activating a page.
- **FR-10 (Renderer and Hit-Testing Scoping):** Ensure `Renderer.ts`, `lasso/index.ts`, `Stats/*`, `CommandPalette.tsx`, and `App.*.ts` interaction handlers render, hit-test, and select only the active page's non-deleted elements.
- **FR-11 (Page-Scoped History / Undo & Redo):** Scope `history.ts` undo/redo stacks or entries so that executing undo or redo while on a page only reverts/reapplies changes belonging to that page and never modifies or exposes elements on other pages.
- **FR-12 (Export & Serialization):**
  - Single-page visual export (PNG, SVG, clipboard canvas export in `scene/export.ts` and `data/`) must export only the active page's elements.
  - Full-drawing JSON serialization (`serializeAsJSON` in `packages/excalidraw/data/json.ts`, `ExportedDataState` / `ImportedDataState` in `packages/excalidraw/data/types.ts`) must save all pages, their order, the active page, and all pages' elements in a single `.excalidraw` payload.
- **FR-13 (Backward-Compatible Restore):** Update `restoreElements` and `restoreAppState` in `packages/excalidraw/data/restore.ts` so that:
  - Legacy payloads without page metadata restore all elements onto the single constant default page.
  - Multi-page payloads restore the full ordered page list, validate `activePageId` (falling back to the first page if missing/invalid), and preserve every element's page assignment.
- **FR-14 (Cross-Page Search):** Update `SearchMenu.tsx` to search text across non-deleted elements on all pages, display page context for matches on inactive pages, and switch `activePageId` to the target element's page when the user selects a match from another page.
- **FR-15 (English Locale Strings):** Add all user-facing strings for the page tab bar and page actions to `packages/excalidraw/locales/en.json` only.

### 3. `packages/common` (`packages/common/src/**`)

- **FR-16 (Shared Constants):** Define shared page constants (such as the constant `DEFAULT_PAGE_ID` and default page naming prefix, plus any required version or event constants) in `packages/common/src/constants.ts` and export them from `@excalidraw/common`.

### 4. `excalidraw-app` Collaboration and Local Storage (`excalidraw-app/**`)

- **FR-17 (Live Collaboration Sync for Pages and Elements):** Update `excalidraw-app/collab/Collab.tsx`, `excalidraw-app/collab/Portal.tsx`, `excalidraw-app/app_constants.ts` (`WS_SUBTYPES`), `excalidraw-app/data/firebase.ts`, and `packages/excalidraw/data/reconcile.ts` so that:
  - Page list changes (create, rename, reorder, delete) are broadcast to room peers and persisted in Firebase/share snapshots.
  - Element broadcasts and `reconcileElements` preserve each element's page assignment so an element drawn by a peer on page B arrives on page B without disturbing page A.
  - Each collaborator can view and navigate pages independently (local `activePageId` per user unless following a peer).
- **FR-18 (Local Storage & Cross-Tab Persistence):** Update `excalidraw-app/data/LocalData.ts`, `excalidraw-app/data/localStorage.ts`, `excalidraw-app/data/tabSync.ts`, and `excalidraw-app/App.tsx` so that all pages, their order, their elements, and the active page are saved to and restored from `localStorage` across page reloads and browser tab synchronization.

### 5. Companion Documentation (`dev-docs/docs/**`)

- **FR-19 (Developer Documentation Updates):** Document the multi-page JSON schema, initialData properties, imperative API additions (if any), and restore behavior in:
  - `dev-docs/docs/codebase/json-schema.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/initialdata.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx`

---

## Non-functional requirements

- **NFR-1 (Mandatory Verification Gate Command):** Every verification run must execute and pass the exact command word for word:
  `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- **NFR-2 (Snapshot Preservation & Deterministic Randomness):**
  - Under test, `randomId()` (`packages/common/src/random.ts`) is sequential (`id0`, `id1`, ...) and `randomInteger()` uses a seeded generator. The default page must use a fixed constant ID, and editor mount, `restore`, legacy-file loading, and element creation must make zero additional `randomId()`, `randomInteger()`, or `Math.random()` draws.
  - Existing snapshots may change **only** by gaining the new page-related fields; no other value (such as element IDs, version seeds, or unrelated fields) may shift.
  - Never run a blanket `yarn test:update`. Update only the specific snapshot files that require the new page fields, one test file at a time via `yarn test:app --watch=false --update <test file>`.
  - Never hand-edit any file under `__snapshots__/`.
  - The final report must list each updated snapshot file and the exact fields it gained.
- **NFR-3 (Gitignore, File Naming & Write Contract Compliance):**
  - Do not modify `.gitignore`.
  - Do not create any file or directory named `build`, `dist`, `firebase`, `html`, `coverage`, `logs`, or `meta*.json` at any depth (to avoid matching unanchored `.gitignore` rules).
  - Modify only files matching the 15 allowlist patterns in the Gate 0 brief and touch none of the 25 off-limits patterns.
  - Add new translation strings to `packages/excalidraw/locales/en.json` only.
- **NFR-4 (Codebase & Architectural Conventions):**
  - Follow `AGENTS.md` and stack conventions: use `app.ownerDocument` / `app.ownerWindow` rather than global `document` / `window` for new DOM API calls; prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`; use named `export const` arrow functions for React components with sibling `.scss` files; maintain eslint `import/order` groupings; make small, anchored edits in large hotspot files (`App.tsx`, `types.ts`, `restore.ts`, `Collab.tsx`).
- **NFR-5 (Backward Compatibility):**
  - All existing `.excalidraw` files, library items, and `initialData` payloads without `pages` or `pageId` fields must load without error or data loss onto the default page.

---

## PII inventory

Excalidraw is a client-side / end-to-end encrypted whiteboard. The pages feature introduces no user account PII, telemetry identifiers, or server-side identity fields. Page names are user-authored content and are treated with the same confidentiality and encryption protections as element text.

| Field | Sensitivity | Protection |
|---|---|---|
| `page.name` (Page title in `AppState.pages` / serialized file / collab payload) | Low / User-authored content (may contain project or diagram names chosen by the user; shared in collaboration) | Stored locally in browser `localStorage` and `.excalidraw` files; encrypted client-side with the room key (`encryptData` in `Portal.tsx` / `firebase.ts`) before transmission over WebSocket or storage in Firebase during collaboration, identical to element text content. |
| `page.id` / `activePageId` / `element.pageId` | None (Internal structural identifier; constant for default page or random opaque ID) | Treated as part of the scene payload; encrypted alongside scene data in collaboration rooms and Firebase storage. |
| `page.scrollX`, `page.scrollY`, `page.zoom` | None (Viewport coordinates) | Local per-page state stored in browser `localStorage` and `.excalidraw` export; not linked to any personal identity. |

---

## Role matrix

Excalidraw has no per-page access control (explicitly out of scope per Gate 0 non-goals). The relevant actors across a drawing lifecycle are the **Local Editor**, a **Collaborator (page-aware peer)** in a live room, and an **Older Peer without pages** in a mixed-version collaboration session or loading a saved file.

| Role | Resource | Action | Expected Behavior |
|---|---|---|---|
| **Local Editor** (View mode disabled) | Pages list (`AppState.pages`) | Create, rename, reorder, delete, switch page | Full access via tab bar UI and actions. Deleting is disabled/blocked when only 1 page remains. Switching updates `activePageId` and restores that page's viewport. |
| **Local Editor** (View mode enabled: `viewModeEnabled: true`) | Pages list (`AppState.pages`) | Switch active page | Can switch between existing tabs to view each page's diagram and viewport, and search across pages; cannot create, rename, reorder, or delete pages. |
| **Local Editor** | Active page elements & history | Draw, edit, select, undo/redo, export image/SVG, save `.excalidraw` | Edits, selection, hit-testing, undo/redo, and image/SVG export apply only to the active page. Saving a `.excalidraw` file or writing to `localStorage` persists all pages and all elements. |
| **Collaborator (Page-aware peer)** | Shared pages list & per-page elements | Receive/broadcast page create, rename, reorder, delete, and element updates | Receives remote page metadata updates and reconciles remote elements into their respective pages. Keeps own local `activePageId` and viewport when not following another user; switches to followed user's active page when following. |
| **Older Peer without pages** | Shared room scene / exported `.excalidraw` file | Join collab room or load `.excalidraw` JSON file | Ignores unknown page metadata fields (`pages`, `activePageId`, `pageId`); see Open Questions (OQ-2) for whether elements across pages or only default-page elements are visible in legacy single-canvas peers. |

---

## Acceptance criteria

All nine acceptance criteria from the Gate 0 brief plus the three Gate 0 binding rules are specified below as executable criteria:

- **AC-1 (Page CRUD & Switching in jsdom):** Automated jsdom tests in `packages/excalidraw` create new pages, switch between pages, rename pages, and delete pages via the editor UI/actions, verifying `h.state.pages` and `h.state.activePageId` update accurately.
- **AC-2 (Active-Page Rendering & Selection Isolation):** Automated jsdom tests assert that when multiple pages contain elements, only the active page's elements are rendered and returned as selectable/hit-testable on the canvas (`getNonDeletedElements` / selection actions ignore elements on inactive pages).
- **AC-3 (Page-Scoped Undo/Redo):** Automated jsdom tests verify that performing undo (and redo) on page A reverts only changes made on page A, leaves page B's elements untouched, and does not switch or leak elements across pages.
- **AC-4 (Page-Scoped Export):** Automated tests verify that exporting a page (e.g., canvas/SVG/image export or single-page export helpers) includes only the active page's elements and excludes elements from inactive pages.
- **AC-5 (Legacy File Restore Compatibility):** Automated tests verify that restoring a legacy `.excalidraw` file or `initialData` payload with no page data (`pages` / `pageId` absent) places all restored elements onto a single default page with the constant default page ID and no lost elements.
- **AC-6 (Exact Verification Command Passes):** Running the exact command word for word:
  `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
  exits with code 0 with zero TypeScript errors, zero ESLint warnings/errors, and all test suites passing.
- **AC-7 (Page Reorder & Serialization Round-Trip):** An automated test reorders pages, serializes the scene to JSON (`serializeAsJSON`), restores it (`restore` / `loadFromBlob`), and asserts that the reordered page sequence, page names, active page, and per-page elements survive the save-and-restore round trip.
- **AC-8 (Collaboration Sync for Pages & Per-Page Elements):** An `excalidraw-app` collaboration test verifies that a remote peer's page create, rename, and delete operations arrive and update local state, and that an element drawn by a peer on page B arrives on page B without appearing on page A.
- **AC-9 (Local Storage Reload Persistence):** An `excalidraw-app` test verifies that reloading from local storage preserves all pages, their order, their elements, and the active page (`activePageId`).
- **AC-10 (Snapshot Integrity & Deterministic IDs):** No existing test snapshot changes any element ID, random seed, or unrelated field; any updated snapshot file gains only the new page-related fields, is updated individually via `yarn test:app --watch=false --update <test file>` (never hand-edited or blanket-updated), and is itemized with its added fields in the final report.
- **AC-11 (Repo Hygiene & Write Boundaries):** `git status` and `git diff` confirm `.gitignore` is untouched, no file or folder is named `build`, `dist`, `firebase`, `html`, `coverage`, `logs`, or `meta*.json`, only `packages/excalidraw/locales/en.json` is modified among locale files, and all touched files fall strictly within the Gate 0 allowlist.

---

## Open questions for HITL

1. **OQ-1 — Architectural Trade-off: `pageId` on every element vs. separate element arrays per page (Gate 1/2 Architect Decision):**
   - **Option A (`pageId?: string` on `ExcalidrawElement`, single master element array in `Scene` with active-page filtering):**
     - *Pros:* Preserves the single `elements: readonly ExcalidrawElement[]` contract across `serializeAsJSON`, `ExportedDataState`, `reconcileElements`, `Store`/`Delta`, Firebase encryption, and `LOCAL_STORAGE_ELEMENTS`. Legacy files and older peers naturally read `elements` as an array. `Scene.getNonDeletedElements()` returns active-page elements by default while `Scene.getAllElementsIncludingDeleted()` (or similar) serves persistence and collab reconciliation.
     - *Cons:* Requires filtering by `activePageId` in `Scene` and ensuring `pageId` is stamped when creating or restoring elements (defaulting `undefined` to `DEFAULT_PAGE_ID` so existing element snapshots don't even need `pageId` unless explicitly serialized, or stamped consistently).
   - **Option B (Separate element arrays per page, e.g., `pages: Array<{ id, name, elements }>`):**
     - *Pros:* Active-page element list is physically isolated in memory without filtering.
     - *Cons:* Breaks or duplicates the top-level `elements` array contract in `ExportedDataState`, `reconcileElements`, `Store`, `History`, and `LOCAL_STORAGE_ELEMENTS`, complicating collaboration reconciliation and backward compatibility.
   - *Recommendation for Gate 1/2:* Favor **Option A** (`pageId` on elements with `DEFAULT_PAGE_ID` fallback and `Scene` active-page filtering) to keep serialization, collaboration reconciliation (`reconcileElements`), and snapshot impact minimal.

2. **OQ-2 — Behavior for an older peer without pages in live collaboration and shared files:**
   - Because `WS_SUBTYPES.INIT` and `WS_SUBTYPES.UPDATE` broadcast the `elements` array and older clients ignore unrecognized `pageId` properties on elements (as well as any new page metadata fields or subtype messages), an older peer without page support will receive the flat `elements` array and render all non-deleted elements from all pages superimposed on its single canvas (while any edits the older peer makes to an existing element preserve or omit `pageId`, and new elements created by the older peer have `pageId: undefined`, which page-aware peers map to the default page `DEFAULT_PAGE_ID`).
   - Confirm at Gate 1/2 that this graceful fallback (older peers see all elements on their single canvas and their newly drawn elements land on the default page for page-aware peers) is the expected behavior.
