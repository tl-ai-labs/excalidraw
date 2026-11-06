# Requirements — Pages in a Drawing (Tab Bar)

- **Run ID:** `20261106-120000-feature-new-drawing-pages`
- **Mode:** `brownfield`
- **Intent:** `feature-new`
- **Brief:** `.sdlc/runs/20261106-120000-feature-new-drawing-pages/intent_brief.md`

---

## 1. In Scope

1. **Multi-page data model and scene filtering (`packages/element`, `packages/common`):** Associate drawing elements with pages and filter scene queries so that rendering, hit-testing, selection, bounding boxes, and frame operations operate on the active page's elements while preserving access to all pages' elements for serialization, search, local persistence, and collaboration.
2. **Page state and per-page viewport management (`packages/excalidraw`):** Track the ordered page list (`id`, `name`), the active page identifier, and per-page viewport state (`scrollX`, `scrollY`, `zoom`) in `AppState` and editor state, initializing new drawings with one default page.
3. **Page tab bar UI (`packages/excalidraw`):** Provide a tab bar component in the editor chrome to switch the active page, create a new page, rename a page inline, reorder pages, and delete a page (with confirmation when appropriate, and preventing deletion of the last remaining page).
4. **Page-scoped undo/redo history (`packages/excalidraw`, `packages/element`):** Scope undo and redo operations to the active page so that undoing or redoing on one page only affects that page's elements and remains on that page.
5. **Single-file multi-page serialization and active-page visual export (`packages/excalidraw`, `dev-docs`):** Save all pages and their elements in one `.excalidraw` JSON file (and embedded scene data in PNG/SVG exports), document the schema update in `dev-docs/docs/codebase/json-schema.mdx`, and ensure visual exports (PNG, SVG, canvas/clipboard) render only the active page's elements.
6. **Backward-compatible restore (`packages/excalidraw`):** Restore multi-page `.excalidraw` files with all pages and elements intact, and automatically place legacy single-page `.excalidraw` files (without page metadata) onto a single default page.
7. **Cross-page search (`packages/excalidraw`):** Extend `SearchMenu` to find text and frame matches across all pages and switch to the target page when a match on another page is selected.
8. **English localization strings (`packages/excalidraw/locales/en.json`):** Add all required user-facing labels, tooltips, and confirmation dialog strings for page management to `locales/en.json` only.
9. **Multi-page collaboration and local storage (`excalidraw-app`):** Synchronize the page list and per-page elements across collaborators (while keeping active page and viewport per user) and persist all pages in browser local storage across reloads.

---

## 2. Out of Scope

1. **Translations beyond `en.json`:** Modifying or translating any locale file in `packages/excalidraw/locales/*.json` other than `packages/excalidraw/locales/en.json` (all other locale files are managed by Crowdin and are off-limits).
2. **Multi-page batch visual export (PDF / slides):** Exporting an entire multi-page file at once to multi-page PDF or presentation slide decks.
3. **Page thumbnails and previews:** Rendering miniature canvas thumbnail previews inside page tabs or a page overview grid.
4. **Cross-page element hyperlinks:** Special UI or protocol for linking an element on one page to jump directly to another page (`cross-page links`).
5. **Backend storage architecture changes:** Changing the backend storage format or server infrastructure beyond the fields required in the serialized drawing/room payload to carry pages.
6. **Off-limits files and directories:** Modifying `.env*`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.gitignore`, `packages/*/dist/**`, `packages/excalidraw/types/**`, or any path outside the Gate 0 approved allowlist.

---

## 3. Functional Requirements per Module

> **Note on Open Design Decision:** The concrete page-membership representation (`pageId` field on each element vs. separate per-page element arrays / scenes) is reserved for the architecture phase (ADR). All functional requirements below are stated so that they hold under either representation.

### 3.1 `packages/element` (and shared types/constants in `packages/common`)

- **FR-1 (Page membership and active-page scene filtering):**
  `Scene` (`packages/element/src/Scene.ts`) and element types (`packages/element/src/types.ts`) SHALL associate every element with a page and expose active-page queries (`getNonDeletedElements`, `getNonDeletedElementsMap`, `getElementsIncludingDeleted`, frame lookup helpers, and bounding-box/hit-test queries) that return only elements belonging to the active page, while also providing methods to read and update the complete collection of elements across all pages.
  *Covered by: AC-1, AC-5, AC-8.*

- **FR-2 (Element creation, mutation, and intra-page ordering):**
  All element creation, duplication, clipboard paste, and library insertion operations SHALL associate the resulting elements with the currently active page. Fractional indexing (`syncInvalidIndices`, `syncMovedIndices`), z-order actions, group selection, and frame membership (`frameId`) SHALL operate consistently within a page without corrupting element ordering on other pages.
  *Covered by: AC-1, AC-4.*

### 3.2 `packages/excalidraw`

#### State (`appState.ts`, `types.ts`, `viewport.ts`, `actions/**`, `components/App.tsx`)

- **FR-3 (Page list and active page in `AppState`):**
  `AppState` SHALL include an ordered list of pages (each having a unique `id: string` and `name: string`) and the current `activePageId: string` (plus per-page viewport state), initialized in `getDefaultAppState()` with a single default page (e.g., `"Page 1"`).
  *Covered by: AC-1, AC-6.*

- **FR-4 (Per-page independent viewport state and selection reset on switch):**
  Each page SHALL retain its own viewport parameters (`scrollX`, `scrollY`, `zoom`). Switching from one page to another SHALL persist the outgoing page's `scrollX`, `scrollY`, and `zoom`, apply the incoming page's saved `scrollX`, `scrollY`, and `zoom` (or default `scrollX: 0, scrollY: 0, zoom: { value: 1 }` if not yet visited), and clear page-specific transient interaction state (`selectedElementIds`, `hoveredElementIds`, `selectedGroupIds`, `editingTextElement`, `editingGroupId`, `editingFrame`, `activeEmbeddable`, `selectionElement`, `multiElement`).
  *Covered by: AC-1, AC-2.*

- **FR-5 (Page management actions — create, switch, rename, reorder, delete):**
  The editor SHALL provide actions and imperative/state methods to:
  1. **Create a page:** Add a new page with a generated unique `id` and default sequential name (e.g., `"Page 2"`), and switch `activePageId` to the new page.
  2. **Switch page:** Change `activePageId` to a target existing page ID, updating the active scene elements and viewport.
  3. **Rename a page:** Update a target page's `name` (trimming whitespace and falling back to a non-empty default name if blank).
  4. **Reorder pages:** Move a page to a new index in the ordered page list without changing `activePageId` or page contents.
  5. **Delete a page:** When more than one page exists, remove the target page from the page list, remove/mark deleted all elements belonging to that page, and if the deleted page was active, transition `activePageId` to an adjacent remaining page. When only one page exists, deletion SHALL be disallowed.
  *Covered by: AC-1, AC-2, AC-3.*

#### Tab Bar UI (`components/LayerUI.tsx`, `components/footer/**`, `components/PageTabs*`)

- **FR-6 (Page tab bar display and switching):**
  `LayerUI` / `Footer` SHALL render a `PageTabs` component displaying the ordered list of pages, highlighting the active page tab (`aria-selected="true"` or equivalent accessible state), and switching to the clicked page tab.
  *Covered by: AC-1, AC-2, AC-3.*

- **FR-7 (Tab bar interactive controls and view-mode behavior):**
  The `PageTabs` UI SHALL allow the user to:
  1. Click an "Add page" button to create and switch to a new page;
  2. Trigger inline rename on a page tab (via double-click or rename control), commit on `Enter` or blur, and cancel on `Escape`;
  3. Reorder page tabs (via drag-and-drop or move controls/actions);
  4. Delete a page tab, showing a confirmation dialog when deleting a page (or when the page has elements) and disabling/hiding delete when only one page remains;
  5. When `appState.viewModeEnabled` is `true`, allow switching between existing page tabs while hiding or disabling page creation, renaming, reordering, and deletion controls.
  *Covered by: AC-1, AC-3.*

#### History (`history.ts`, `packages/element/src/store.ts`, `packages/element/src/delta.ts`)

- **FR-8 (Page-scoped undo and redo):**
  Undo and redo history stacks SHALL be isolated per page (or filtered/indexed by page) so that invoking Undo or Redo on the active page only undoes or redoes element changes recorded on that active page, keeps the user on the active page, and leaves elements and history stacks of other pages untouched. Deleting a page SHALL clean up or discard that page's undo/redo history.
  *Covered by: AC-4.*

#### Export and Serialization (`data/json.ts`, `data/types.ts`, `scene/export.ts`, `dev-docs/docs/codebase/json-schema.mdx`)

- **FR-9 (Multi-page `.excalidraw` JSON serialization):**
  `serializeAsJSON` (for both `"local"` and `"database"` targets, as well as embedded scene metadata in PNG/SVG exports) SHALL serialize the full multi-page drawing—including the ordered page list, per-page viewports / active page state (for local exports), and all pages' non-deleted elements (plus referenced binary `files`)—into a single `.excalidraw` JSON structure. `dev-docs/docs/codebase/json-schema.mdx` and `packages/excalidraw/CHANGELOG.md` SHALL be updated to reflect the multi-page format.
  *Covered by: AC-5, AC-6.*

- **FR-10 (Active-page visual export):**
  Visual export functions (`exportToCanvas`, `exportToSvg`, `exportToBlob`, `exportToClipboard` for image/SVG, and the Export Dialog preview) SHALL export only the non-deleted elements belonging to the currently active page (or the currently selected elements on the active page).
  *Covered by: AC-5.*

#### Restore (`data/restore.ts`, `data/blob.ts`)

- **FR-11 (Restore for multi-page and legacy single-page files):**
  `restore` (`restoreAppState`, `restoreElements`, `restoreDataState`) SHALL validate and restore the page list, `activePageId`, per-page viewports, and page-associated elements from imported data. If an imported `.excalidraw` payload does not contain page metadata (a legacy single-page file), `restore` SHALL create a single default page, assign all restored elements to that default page, and set `activePageId` to that default page's ID. If `activePageId` in imported data does not match any page in the restored page list, `restore` SHALL fall back to the first page in the list.
  *Covered by: AC-6.*

#### Search (`components/SearchMenu.tsx`)

- **FR-12 (Cross-page search and match navigation):**
  `SearchMenu` SHALL search across non-deleted text elements and frame names across all pages in the drawing. Search results SHALL include matches from all pages (displaying the page name or context when multiple pages exist), and focusing/selecting a match that resides on an inactive page SHALL switch `activePageId` to that element's page before scrolling and zooming the viewport to highlight the matched element.
  *Covered by: AC-7.*

#### i18n (`locales/en.json`)

- **FR-13 (English localization strings):**
  All user-facing text introduced for page tabs (such as default page name template, add page, rename page, delete page, move/reorder page, and delete confirmation dialog title/body) SHALL be added to `packages/excalidraw/locales/en.json` and accessed through `t(...)` from `packages/excalidraw/i18n.ts`.
  *Covered by: AC-3, AC-9.*

### 3.3 `excalidraw-app`

#### Collaboration (`excalidraw-app/collab/**`, `excalidraw-app/data/**`, `packages/excalidraw/data/reconcile.ts`)

- **FR-14 (Multi-page collaboration sync and per-user viewport isolation):**
  In live collaboration (`Collab.tsx`, `Portal.tsx`, `reconcile.ts`, `firebase.ts`, `excalidraw-app/data/index.ts`), the shared room state SHALL synchronize and reconcile the page list (page creation, rename, reorder, deletion) and elements across all pages among connected collaborators and Firebase/backend storage. Each collaborator's `activePageId` and viewport (`scrollX`, `scrollY`, `zoom`) SHALL remain local to that user (unless actively following another collaborator). If a remote update deletes the page a local user is currently viewing, the local user's editor SHALL gracefully switch to a remaining valid page.
  *Covered by: AC-8.*

#### Local Storage (`excalidraw-app/data/LocalData.ts`, `excalidraw-app/data/localStorage.ts`, `excalidraw-app/data/tabSync.ts`, `excalidraw-app/App.tsx`)

- **FR-15 (Multi-page local storage persistence):**
  `excalidraw-app` local persistence (`LocalData`, `saveDataStateToLocalStorage`, `importFromLocalStorage`, and `tabSync`) SHALL save and restore all pages, their elements, `activePageId`, and per-page viewports so that reloading the browser tab preserves the complete multi-page drawing and active page state.
  *Covered by: AC-8.*

---

## 4. Non-Functional Requirements

- **NFR-1 (Backward compatibility of `.excalidraw` file format):**
  The `.excalidraw` JSON format MUST remain backward compatible. All new page-related properties on elements, `appState`, or top-level `ImportedDataState` / `ExportedDataState` MUST be optional on import and given safe defaults in `packages/excalidraw/data/restore.ts`. Legacy single-page `.excalidraw` files and embedded PNG/SVG scenes MUST load without errors.
  *Covered by: AC-6, AC-9.*

- **NFR-2 (Strict package dependency boundary):**
  Library packages (`packages/excalidraw`, `packages/element`, `packages/common`) MUST NEVER import from `excalidraw-app`. The dependency graph MUST strictly follow `excalidraw-app` -> `@excalidraw/excalidraw` -> `@excalidraw/element` -> `@excalidraw/common` / `@excalidraw/math`.
  *Covered by: AC-9.*

- **NFR-3 (Element immutability and version bumping):**
  All element modifications MUST go through `newElementWith`, `mutateElement`, or `scene.mutateElement` so that `version` and `versionNonce` are incremented for history deltas and collaboration reconciliation. Elements and `AppState` MUST NEVER be mutated in place.
  *Covered by: AC-4, AC-8, AC-9.*

- **NFR-4 (AppState field wiring completeness):**
  Every new field added to `AppState` MUST be wired consistently across:
  1. `interface AppState` (and `UIAppState` in `packages/excalidraw/types.ts` if consumed by UI components);
  2. `getDefaultAppState()` in `packages/excalidraw/appState.ts`;
  3. `APP_STATE_STORAGE_CONF` (`{ browser, export, server }`) in `packages/excalidraw/appState.ts`;
  4. `restoreAppState()` in `packages/excalidraw/data/restore.ts`.
  *Covered by: AC-6, AC-8, AC-9.*

- **NFR-5 (`AGENTS.md` code conventions):**
  1. Editor and component code MUST use `app.ownerDocument` and `app.ownerWindow` instead of global `document` and `window` wherever `app` is accessible.
  2. TypeScript utility types MUST prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, ...> & Overrides`.
  3. Imports MUST follow the enforced ESLint import ordering (external/`@excalidraw/*` packages, relative imports, then `import type` declarations).
  *Covered by: AC-9.*

- **NFR-6 (Scope and i18n file restrictions):**
  Only `packages/excalidraw/locales/en.json` may be edited for localization; all other `packages/excalidraw/locales/*.json` files and all Gate 0 off-limits paths MUST remain untouched.
  *Covered by: AC-9.*

- **NFR-7 (Verification gates):**
  The repository MUST pass `yarn test:typecheck` (0 errors), `yarn test:code` (ESLint, 0 warnings), and `yarn test:app --watch=false` (Vitest jsdom test suite).
  *Covered by: AC-9.*

---

## 5. PII Inventory

Excalidraw is a client-side drawing tool and collaborative whiteboard. The pages feature introduces user-authored page names alongside existing user-authored canvas content:

| Field | Location / Module | Sensitivity | Protection & Handling |
| :--- | :--- | :--- | :--- |
| `page.name` (Page title) | `AppState` (`packages/excalidraw`), `.excalidraw` JSON export, `localStorage` (`excalidraw-state`), Collab / Firebase payload (`excalidraw-app`) | **Low / User Content** (May contain project names or user-entered labels) | Stored locally in browser `localStorage` or user-exported `.excalidraw` files; in collaboration rooms, encrypted client-side (E2EE via room key) before Firebase/WebSocket transmission just like scene elements; rendered as escaped React text nodes (no `dangerouslySetInnerHTML`) to prevent XSS. |
| `element.text` / `element.name` (Canvas text & frame titles per page) | `Scene` (`packages/element`), `.excalidraw` JSON export, `localStorage` (`excalidraw`), Collab / Firebase (`excalidraw-app`) | **Low–Medium / User Content** (Free-form diagram content) | Protected by existing client-side storage and E2EE collaboration transport; never logged to telemetry or error trackers. |
| `page.id` / `activePageId` | `AppState`, `.excalidraw` JSON, `localStorage`, Collab payload | **None** (Random / opaque identifier) | Non-sensitive random string identifier (`randomId()`). |
| Per-page viewport (`scrollX`, `scrollY`, `zoom`) | `AppState`, `localStorage`, `.excalidraw` JSON | **None** (Numeric canvas coordinates) | Kept local per browser / file; not broadcast as persistent room state to other collaborators. |

---

## 6. Role Matrix

| Role | Resource | Action | Permission & Expected Behavior |
| :--- | :--- | :--- | :--- |
| **Local User (Edit Mode)** | Page List (`PageTabs`) | Create, Rename, Reorder, Delete Page | **Allowed** (Delete requires `pages.length > 1`; confirms when page is non-empty / via confirm dialog). |
| **Local User (Edit Mode)** | Active Page & Viewport | Switch Page, Pan, Zoom | **Allowed** (Saves outgoing page's viewport and restores target page's viewport). |
| **Local User (Edit Mode)** | Active Page Elements | Create, Select, Edit, Delete, Undo/Redo | **Allowed** (Scoped strictly to the active page; inactive pages' elements are not rendered or mutated). |
| **Local User (Edit Mode)** | Search (`SearchMenu`) | Search text/frames across all pages & jump to match | **Allowed** (Finds matches on all pages; clicking a match on another page switches to that page and centers viewport). |
| **Local User (Edit Mode)** | Export / Save | Export image (PNG/SVG) or Save `.excalidraw` JSON | **Allowed** (Image export includes only active page's elements; `.excalidraw` JSON saves all pages and elements). |
| **Local User (View Mode / `viewModeEnabled: true`)** | Page List (`PageTabs`) | Switch Page, Pan, Zoom, Search, Export | **Allowed** (Can navigate between all pages in the drawing and inspect/search/export each page). |
| **Local User (View Mode / `viewModeEnabled: true`)** | Page List & Elements | Create, Rename, Reorder, Delete Page; Edit Elements | **Denied** (Mutating controls in `PageTabs` and element editing actions are disabled/hidden). |
| **Collaborator (Remote Peer in Collab Room)** | Shared Page List & All Pages' Elements | Create, Rename, Reorder, Delete Page; Edit Elements | **Allowed & Synced** (Propagated via WebSocket/Firebase and reconciled across peers; if a peer deletes the page another user is viewing, that user falls back to a remaining valid page). |
| **Collaborator (Remote Peer in Collab Room)** | Local User's Active Page & Viewport | Switch Page, Pan, Zoom | **Isolated per user** (A collaborator switching pages or panning/zooming does not change another collaborator's active page or viewport unless explicitly being followed). |

---

## 7. Acceptance Criteria

Each acceptance criterion is executable via Vitest (jsdom) or repository verification scripts, and maps directly to the Functional (`FR-*`) and Non-Functional (`NFR-*`) requirements:

- **AC-1 (Page creation, switching, active-page rendering, and selection isolation — covers FR-1, FR-2, FR-3, FR-5, FR-6):**
  A Vitest jsdom test renders Excalidraw, creates elements on the initial default page (Page 1), creates a second page (Page 2), adds distinct elements on Page 2, and switches between Page 1 and Page 2. The test asserts that:
  1. Only the active page's elements are returned by active scene queries (`scene.getNonDeletedElements()`) and rendered on the canvas;
  2. Selection actions (e.g., Select All / pointer hit-testing) select only elements on the active page and never select elements on inactive pages.

- **AC-2 (Per-page independent viewport state and selection reset — covers FR-4, FR-5, FR-6):**
  A Vitest jsdom test sets a non-default viewport (`scrollX`, `scrollY`, `zoom`) and selects an element on Page 1, switches to Page 2, sets a different viewport on Page 2, and switches back to Page 1. The test asserts that:
  1. Page 1's `scrollX`, `scrollY`, and `zoom` are restored when switching back to Page 1;
  2. Page 2's `scrollX`, `scrollY`, and `zoom` are restored when switching to Page 2;
  3. `selectedElementIds` is cleared upon switching pages.

- **AC-3 (Page rename, reorder, delete, and single-page delete guard — covers FR-5, FR-6, FR-7, FR-13):**
  A Vitest jsdom test exercises the page tab bar and page actions to:
  1. Rename a page (e.g., to `"SDK flow"`) and assert the page name updates in `h.state` and the rendered tab bar;
  2. Reorder pages and assert the page order in `h.state` and the DOM tab order reflects the change;
  3. Delete a page when multiple pages exist (confirming via the confirmation dialog when applicable) and assert the page and its elements are removed and `activePageId` switches to a remaining page;
  4. Verify that when only one page remains, deleting that last page is prevented/disabled.

- **AC-4 (Page-scoped undo and redo isolation — covers FR-2, FR-8, NFR-3):**
  A Vitest jsdom test creates an element `rect1` on Page 1, switches to Page 2, creates an element `rect2` on Page 2, and executes Undo while on Page 2. The test asserts that:
  1. `rect2` on Page 2 is undone while `activePageId` remains Page 2;
  2. `rect1` on Page 1 remains intact and untouched;
  3. Switching to Page 1 and executing Undo undoes `rect1` on Page 1 without affecting Page 2.

- **AC-5 (Active-page visual export vs. whole-file JSON serialization — covers FR-1, FR-9, FR-10):**
  A Vitest jsdom test creates elements on Page 1 and Page 2 and asserts that:
  1. Exporting the active page (via `exportToSvg` / `exportToCanvas` or scene export helpers) contains only the active page's elements and excludes elements from inactive pages;
  2. Serializing the drawing via `serializeAsJSON` includes the page list and the elements of both Page 1 and Page 2 in one JSON payload.

- **AC-6 (Legacy single-page restore and multi-page restore — covers FR-3, FR-9, FR-11, NFR-1, NFR-4):**
  A Vitest jsdom test verifies `restore` / `loadFromJSON`:
  1. Restoring a legacy single-page `.excalidraw` file (with `elements` and `appState` but no page fields) creates exactly one default page, sets it as the active page, and assigns all restored elements to that page;
  2. Restoring a multi-page `.excalidraw` JSON payload restores all pages in order, their names, per-page viewports, and each page's elements.

- **AC-7 (Cross-page search and match navigation — covers FR-12):**
  A Vitest jsdom test creates a text element on Page 1 and a text element `"PipelineNode"` on Page 2, opens `SearchMenu` while Page 1 is active, searches for `"PipelineNode"`, and selects the match. The test asserts that `SearchMenu` finds the match on Page 2 and selecting it switches `activePageId` to Page 2 and scrolls/focuses the matched element.

- **AC-8 (Collaboration reconciliation and local storage persistence — covers FR-1, FR-14, FR-15, NFR-3, NFR-4):**
  Vitest jsdom tests verify that:
  1. Saving to and importing from local storage (`LocalData` / `importFromLocalStorage`) preserves all pages, their elements, `activePageId`, and per-page viewports across a reload;
  2. Collaboration reconciliation (`reconcileElements` / collab sync) merges elements and page list updates across multiple pages from remote peers while preserving the local user's independent viewport (`scrollX`, `scrollY`, `zoom`).

- **AC-9 (Typecheck, lint, architectural constraints, and full test suite — covers FR-13, NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7):**
  Running `yarn test:typecheck`, `yarn test:code`, and `yarn test:app --watch=false` completes with exit code `0` (zero TypeScript errors, zero ESLint warnings, all tests passing), with no imports from `excalidraw-app` inside `packages/*` and no edits to off-limits files.

---

## 8. Open Questions for HITL / Architect (ADR)

1. **OPEN DESIGN DECISION (Reserved for Phase 2 Architect ADR) — Page-Membership Representation:**
   Should page membership be represented by:
   - **Option A — Element-level `pageId` property:** Every `ExcalidrawElement` carries a `pageId: string` field in a single flat element array in `Scene`, and `Scene` caches/filters active-page slices (`getNonDeletedElements()`, `elementsMap`, etc.) by `activePageId`; **or**
   - **Option B — Separate per-page element arrays / per-page `Scene` instances:** Each page owns a dedicated element array or `Scene` instance, composed into a multi-page container for file serialization and collaboration sync?
   *Architectural trade-offs to evaluate in the ADR:*
   - Collaboration reconciliation (`reconcileElements` and `getSyncableElements` currently operate on a flat element array with version bumps);
   - Fractional indexing (`syncInvalidIndices` / `syncMovedIndices` invariants across vs. within pages);
   - Frame membership (`frameId` and frame child lookups in `Scene`);
   - History deltas (`StoreDelta` / `HistoryDelta` calculation and per-page undo/redo isolation);
   - `.excalidraw` file-format backward and forward compatibility.
   *(All requirements in Sections 1–7 are specified to hold under either architectural choice.)*
