# Requirements — feature-new — Pages in a drawing

Run: `20261106-113849-feature-new-pages` · Intent: `feature-new` · Policy: `opus55-only` · Auth: `estimated`
Source: `intent_brief.md` (user brief, verbatim acceptance), `discovery.md`. Carries forward the requirements approved at Gate 1 of the aborted runs 20261105-095607-feature-new-pages and 20261105-150653-feature-new-pages, unchanged in substance.

## Summary

A drawing holds one or more **pages**. Each page has an id, a name, its own elements and its own viewport
(scrollX, scrollY, zoom). A tab bar in the editor footer lets the user create, rename, reorder, delete and
switch pages. Only the active page's elements are rendered, hit-tested, selectable, exported, searched
in-place and affected by undo/redo. All pages are saved in one `.excalidraw` file, in the app's
localStorage, in the live-collaboration socket stream and in the Firebase-saved room. Files written before
this change load onto a single default page.

## In scope

1. A page model: an ordered list of pages, each `{ id, name }` plus a per-page viewport, and the active page
   id, carried in the editor state and in the saved file.
2. Element-to-page membership. The architect chooses between (a) a page id on every element with one Scene
   filtered by the active page, and (b) separate element arrays per page, and records the rationale as a
   decision in the change spec (versioning, fractional indices, reconcile, history and file-format
   compatibility are the deciding factors).
3. A tab bar UI in the editor (footer or equivalent mount point) with create, rename (inline), reorder
   (drag or move actions), delete (with confirmation when the page has elements) and switch.
4. Per-page rendering, hit-testing, selection, frames, bound text/arrows and binding (no cross-page
   binding), and library insert into the active page.
5. Undo/redo scoped so an undo on page A never changes page B's elements; switching pages does not create
   an undoable element change on either page.
6. Export (PNG/SVG/clipboard/`.excalidraw` "export selection/page" flows) of the active page contains only
   that page's elements. Saving the file (`serializeAsJSON` / `saveAsJSON`) includes all pages.
7. Restore/migration: a file without page data restores onto exactly one default page with every element
   intact; a file with pages restores all pages, their order, names, viewports and active page; invalid or
   dangling page references are repaired deterministically.
8. Search (the existing search sidebar) finds text matches on every page, labels the page of each match,
   and selecting a match on another page switches to that page and focuses the match.
9. excalidraw-app: localStorage persists all pages across reload; collaboration broadcasts page
   create/rename/reorder/delete and per-page element changes to other clients via the existing
   reconcile/broadcast path; the Firebase-saved room stores and restores every page.
10. Public API additions documented: new AppState keys / `initialData` / `updateScene` fields / imperative API
    methods, `restore*` behaviour, and the file format (`dev-docs/docs/codebase/json-schema.mdx`). English
    strings in `packages/excalidraw/locales/en.json` only. A CHANGELOG entry in
    `packages/excalidraw/CHANGELOG.md`.
11. Tests: jsdom integration tests that drive the editor, unit tests for the data model, serialization,
    restore and reconcile, and app tests in `excalidraw-app/tests/` for collaboration and localStorage.

## Out of scope

1. Translating new UI strings into non-English locales (Crowdin-managed).
2. Per-page library, per-page theme, per-page collaborator permissions.
3. Links between pages (element links targeting another page).
4. Exporting several pages into one PNG/SVG/PDF.
5. Backend / storage-service changes beyond the existing client-side Firebase and socket code.
6. Version bumps, a release, or npm publishing.
7. Hand-edited snapshots (snapshots are regenerated with `yarn test:update`).
8. Any edit to off-limits paths (`.env*`, `yarn.lock`, generated `packages/excalidraw/types/**`, non-English
   locales, `.github/copilot-instructions.md`, etc. per the frozen write contract).

## Functional requirements

### Data model — `packages/element`, `packages/common`

- **FR-1** A page is identified by a stable string id and carries a user-visible name. The drawing has an
  ordered, non-empty list of pages and exactly one active page id that refers to a page in that list.
- **FR-2** Every element belongs to exactly one page. The membership representation (page id on elements vs.
  per-page arrays) is the architect's decision; whichever is chosen, element ids remain globally unique
  across pages, and fractional indices remain valid for the elements of each page.
- **FR-3** Each page keeps its own viewport: `scrollX`, `scrollY` and `zoom`. Switching away from a page and
  back restores that page's viewport exactly.
- **FR-4** Helpers to read the pages, the active page, a page's elements, and to create/rename/reorder/delete
  pages are exported from the package that owns the model, typed with the repo's strict TS settings.
- **FR-5** Scene-level queries that the editor uses for rendering, hit-testing, selection, frames and
  bindings operate on the active page's elements only; cross-page binding (arrow to element on another page,
  bound text, frame membership across pages) is impossible and is repaired on restore.

### Editor — `packages/excalidraw`

- **FR-6** App state carries the page list, per-page viewports and the active page id. Every new AppState key
  is registered in `APP_STATE_STORAGE_CONF` with correct browser/export/server flags, and has a default in
  `getDefaultAppState` (one default page).
- **FR-7** A tab bar in the editor shows one tab per page in order, highlights the active page, and provides:
  a "new page" control (creates a page with a default name such as "Page N", makes it active, empty
  viewport); switching by clicking a tab; inline rename (double-click or menu; empty names rejected); reorder
  (drag-and-drop and/or move-left/move-right actions); delete (disabled when only one page remains;
  confirmation when the page has elements). Actions are registered through the existing action manager.
- **FR-8** Switching pages: shows only the target page's elements, restores its viewport, clears selection
  and any in-progress editing/tool state that references elements of the previous page.
- **FR-9** Deleting a page removes its elements (as deleted, so collaboration and history stay consistent) and
  activates an adjacent page.
- **FR-10** Undo/redo is scoped per page: an element change made on page A is undone only while on page A (or
  the history is otherwise guaranteed never to mutate another page's elements); page switches and viewport
  changes are not recorded as undoable element changes. Page create/rename/reorder/delete history behaviour
  is defined by the architect and tested.
- **FR-11** Export of the active page (PNG, SVG, clipboard, export dialog) includes only that page's elements.
  `serializeAsJSON`/`saveAsJSON` write every page, its elements, names, order, viewports and the active page.
- **FR-12** `restore` / `restoreElements` / `restoreAppState`: data without pages restores onto exactly one
  default page with every element intact and the original viewport; data with pages restores all of them;
  elements referencing a missing page are moved to the active (or first) page; an active page id that does
  not exist falls back to the first page; duplicate page ids are de-duplicated deterministically. The file
  format stays loadable by the previous reader where possible (the architect decides whether `VERSIONS` is
  bumped and records why).
- **FR-13** Library insert, paste and duplicate add elements to the active page.
- **FR-14** Search finds text matches across all pages, shows which page each match is on, and selecting a
  match on another page switches to that page and focuses the match.
- **FR-15** Public API: `initialData`, `updateScene`, `ExcalidrawImperativeAPI` and `onChange` expose the page
  data needed by hosts (at minimum enough for excalidraw-app persistence and collaboration). New exports are
  added to `packages/excalidraw/index.tsx` where hosts need them.
- **FR-16** New English UI strings are added to `packages/excalidraw/locales/en.json` only.

### Application — `excalidraw-app`

- **FR-17** localStorage (`LocalData` / `importFromLocalStorage`) persists all pages, their elements, names,
  order, viewports and active page across a reload; legacy stored data loads onto one default page.
- **FR-18** Live collaboration: page create/rename/reorder/delete and per-page element changes reach other
  clients through the existing encrypted socket broadcast and `reconcileElements` path; concurrent edits on
  different pages do not clobber each other; a joining client receives every page.
- **FR-19** The Firebase-saved room (`saveToFirebase` / `loadFromFirebase`) stores and restores every page;
  rooms saved before this change load onto one default page.
- **FR-20** Each collaborator's active page and viewport are local (not forced on others); collaborator
  cursors/pointers are shown only to users on the same page (or are otherwise not misplaced on another page).

### Documentation

- **FR-21** `dev-docs/docs/codebase/json-schema.mdx` documents the page fields of the file format;
  the relevant `dev-docs/docs/@excalidraw/excalidraw/api/**` pages document new props/appState keys/API
  methods and restore behaviour; `packages/excalidraw/CHANGELOG.md` gets an "Unreleased" feature entry.

## Non-functional requirements

- **NFR-1** Backward compatibility: every existing `.excalidraw` file, localStorage payload, share link and
  Firebase room loads without data loss.
- **NFR-2** Performance: rendering and hit-testing cost scales with the active page's element count, not the
  whole drawing's; no extra full-scene copies per frame.
- **NFR-3** Type safety: `yarn test:typecheck` passes with the repo's strict configuration; no `any` added to
  public types.
- **NFR-4** Lint/format: `yarn test:code` passes with zero warnings; code follows AGENTS.md (use
  `app.ownerDocument`/`app.ownerWindow`; prefer `Merge<>` over `Omit & `).
- **NFR-5** Accessibility: tabs are keyboard-reachable buttons with accessible names; the active tab exposes
  `aria-selected` (or equivalent); rename is a labelled input.
- **NFR-6** Existing tests continue to pass; snapshots that change because of the new AppState keys are
  regenerated with `yarn test:update`, never hand-edited.
- **NFR-7** Collaboration payloads remain end-to-end encrypted exactly as today; no page data is sent
  unencrypted.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Page name (user-entered text) | Low — user content, may contain arbitrary text | Treated like element text: stored in the file/localStorage, sent only inside the existing encrypted collab payloads and encrypted Firebase ciphertext; rendered as text (React-escaped), never as HTML |
| Element content on pages | Unchanged from today (user content) | Same encryption path as existing elements |

No new personal data, credentials or identifiers are introduced.

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Local editor user | Pages of own drawing | create, rename, reorder, delete, switch, export, save |
| Collaborator in a room | Pages of the shared room | create, rename, reorder, delete, switch (local), edit elements on any page |
| Viewer (view-mode / read-only embed) | Pages | switch and view only; no create/rename/reorder/delete |
| Host app (library consumer) | Page API | read pages, set pages via `initialData`/`updateScene`, observe via `onChange` |

## Acceptance criteria

- **AC-1** jsdom: creating a page from the tab bar adds a tab, makes it active and shows an empty canvas.
- **AC-2** jsdom: switching tabs renders only the active page's elements (renderer receives only them) and
  only they are hit-testable/selectable (select-all and clicking where another page's element sits select
  nothing from that page).
- **AC-3** jsdom: renaming a page from the tab bar updates its tab label and the saved data; an empty name is
  rejected.
- **AC-4** jsdom: reordering pages from the tab bar changes the tab order and the saved page order.
- **AC-5** jsdom: deleting a page removes its tab and its elements, activates an adjacent page; the last
  remaining page cannot be deleted.
- **AC-6** jsdom: undo after editing page A, then switching to page B and back, affects only page A's
  elements; undo on page B never changes page A.
- **AC-7** jsdom: each page keeps its own viewport — scroll/zoom set on page A survive a switch to page B and
  back.
- **AC-8** Export of the active page (export-to-canvas/SVG/clipboard path) contains only its elements.
- **AC-9** Unit: `serializeAsJSON` + `restore` round-trips all pages (ids, names, order, viewports, active
  page, elements).
- **AC-10** Unit: a legacy file (no page data) restores onto exactly one default page with every element
  intact; dangling page references and missing active page are repaired.
- **AC-11** jsdom: search finds text on another page and selecting the result switches to that page.
- **AC-12** `excalidraw-app/tests/`: page changes and per-page element changes reach a second client through
  the reconcile/broadcast path; the Firebase-saved room keeps every page; legacy rooms load onto one page.
- **AC-13** `excalidraw-app/tests/`: localStorage keeps all pages across a reload.
- **AC-14** Library insert / paste adds elements to the active page only.
- **AC-15** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass (snapshots
  regenerated with `yarn test:update`).
- **AC-16** Docs and CHANGELOG updated for the new file-format fields and public API (FR-21).

## Open questions for HITL

1. **Membership model.** The brief leaves the choice to the architect. Default assumption: a page id on every
   element (single Scene, filtered by active page), because it keeps one flat array for versioning,
   `reconcileElements`, fractional indices, Firebase and localStorage, and lets legacy files migrate by
   stamping the default page id. Say so now if you prefer per-page arrays.
2. **Undo across pages.** Default assumption: one history, with page switches not recorded and undo/redo
   operating only on entries made on the active page (or the architect's equivalent that satisfies FR-10).
3. **Tab bar placement.** Default assumption: in the footer (bottom bar), as discovery suggests, hidden in
   zen mode / view mode shows switching only.
4. **File-format version.** Default assumption: keep `VERSIONS.excalidraw = 2` with additive, optional fields
   so older readers still open the file (showing all elements on one canvas); the architect may bump it if
   the chosen model requires it, with rationale.
