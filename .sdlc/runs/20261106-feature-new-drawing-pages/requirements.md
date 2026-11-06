# Requirements — feature-new — Pages in a drawing (tab bar)

Run: `20261106-feature-new-drawing-pages` · Job: feature-new · Source: `intent_brief.md`, `discovery.md`

A drawing holds one or more **pages**. Each page has its own elements and its own viewport (scroll + zoom).
A tab bar lets the person create, switch, rename, reorder and delete pages. All pages are saved in one
`.excalidraw` file, persisted locally by the app, and shared in collaboration.

## 1. In scope

1. A page model: an ordered list of pages, each with a stable id and a name, plus the active page id.
2. Page membership of elements, with scene filtering so only the active page's elements are rendered,
   hit-tested, selected, snapped to, and acted on by editor actions.
3. A viewport (scrollX, scrollY, zoom) kept per page, saved when leaving a page and restored when entering it.
4. Page actions: create, switch, rename, reorder (move left / move right, and drag in the tab bar), delete.
5. A tab bar UI in `packages/excalidraw` (desktop and mobile layouts) hosting those actions.
6. Undo/redo scoped to the page where the change happened.
7. Serialization of every page into one `.excalidraw` file; restore of that file; restore of legacy
   (page-less) files onto one default page.
8. Export (PNG/SVG/clipboard/"export to file" of the image) of the active page contains only that page's elements.
9. Search (the SearchMenu) finds text across all pages and switches to the page of a chosen result.
10. Library insert, paste and element creation land on the active page.
11. excalidraw-app: pages (list, names, order, per-page elements, per-page viewport where already
    persisted today) saved in local storage and restored on reload; pages shared with collaborators in
    real time and in the encrypted Firebase room payload.
12. Public API: the page types and the page-related `AppState` fields are typed and exported from the
    library; `updateScene` / `initialData` accept page data.
13. Docs: `dev-docs/docs/codebase/json-schema.mdx` documents the file format change;
    `packages/excalidraw/CHANGELOG.md` gets an entry.
14. Tests for every acceptance criterion below, in the project's existing Vitest + jsdom suites.

## 2. Out of scope

1. New npm dependencies, or any edit to a `package.json` or `yarn.lock`.
2. A Firebase / server schema migration beyond carrying pages in the existing encrypted payload.
3. A redesign of the footer, sidebar or toolbar beyond hosting the tab bar.
4. Cross-page links, page thumbnails, page templates, page duplication, per-page background colour.
5. Moving elements between pages (cut on one page, paste on another is enough).
6. Multi-page export in a single image (export is per active page).
7. Edits to `.env*`, AI config files, generated wasm files, `packages/excalidraw/types/**`.

## 3. Functional requirements

### Data model — `packages/element`, `packages/common`

- **FR-1** A page is `{ id: string, name: string }` with a stable, unique id. The drawing's pages are an
  ordered list; the order is the tab order. There is always at least one page.
- **FR-2** Every element belongs to exactly one page. The architect chooses the representation — a page id on
  every element, or separate per-page element arrays — and records the choice and its rationale as a decision
  (ADR) in the change spec, weighing: the Scene's single ordered list and fractional indices, the Store/delta
  history, collaboration reconciliation by element id/version, frames and bound elements (which must never
  span pages), and backward compatibility of the file format.
- **FR-3** The Scene (or a helper over it) exposes the active page's elements in z-order; rendering,
  hit-testing, selection (including select-all and box selection), snapping, frame membership and
  binding consider only the active page's elements.
- **FR-4** Elements created, pasted, duplicated or inserted from the library are assigned to the active page.
- **FR-5** Bound text, arrow bindings, groups and frame children always share their container's page.
- **FR-6** Page helpers (create a page with a default name such as "Page N", rename, reorder, delete,
  find a page's elements, the default page for legacy data) live in a new module under
  `packages/element/src/` and are unit-tested.

### App state & viewport — `packages/excalidraw/appState.ts`, `types.ts`

- **FR-7** `AppState` holds the active page id and the page list (or the architect's equivalent), with
  defaults in `getDefaultAppState` and storage flags in `APP_STATE_STORAGE_CONF` such that the page list and
  active page are saved to the browser and exported to file.
- **FR-8** Each page keeps its own viewport (scrollX, scrollY, zoom). Switching away saves the current
  viewport to the page being left; switching to a page restores its saved viewport (a never-visited page
  starts at the default viewport). The per-page viewport is saved in the file (AC-7).
- **FR-9** Switching page clears the selection, any in-progress editing (text editing, linear element
  editing, cropping) and hovered/bound state that refers to the previous page's elements.

### Page actions — `packages/excalidraw/actions/**`

- **FR-10** Actions (registered in the action manager, names added to the `ActionName` union): add page,
  switch page, rename page, move page left/right (or reorder to index), delete page.
- **FR-11** Add page appends a page after the active one (or at the end; the architect decides) with a
  unique default name and switches to it.
- **FR-12** Rename page sets a non-empty trimmed name; an empty name is rejected (keeps the old name).
- **FR-13** Delete page removes the page and all its elements (marked deleted, as element deletion does
  today, so collaboration and undo see it), and switches to an adjacent page. Deleting the last remaining
  page is not possible (the action is disabled or a no-op).
- **FR-14** Page actions that change the document (add, rename, reorder, delete) are recorded so they sync
  and persist; whether page-structure changes are undoable is the architect's decision, recorded in the spec.

### Tab bar UI — `packages/excalidraw/components/PagesTabBar/**`, `LayerUI.tsx`, `MobileMenu.tsx`, `footer/**`

- **FR-15** A tab bar shows one tab per page in order, highlights the active page, and switches page on click.
- **FR-16** A "+" button adds a page. Double-clicking a tab (or a context/menu entry) renames it inline;
  Enter commits, Escape cancels.
- **FR-17** Tabs can be reordered by drag and drop, and by move-left / move-right menu entries.
- **FR-18** A tab menu (or context menu) offers rename, move left, move right and delete; delete is disabled
  when only one page exists.
- **FR-19** The tab bar is hidden in view mode only if the architect so decides; it is hidden in zen mode and
  when the host app opts out via a prop (e.g. `UIOptions` or an `ExcalidrawProps` flag), and rendered in the
  mobile layout too.
- **FR-20** All new UI strings are in `packages/excalidraw/locales/en.json`; styles follow the existing SCSS
  conventions and theme variables (light and dark).

### History — `packages/excalidraw/history.ts`, `packages/element/src/store.ts`, `delta.ts`

- **FR-21** Undo and redo apply only to changes made on the active page: with changes on page A and then on
  page B, undo while on page A reverts page A's last change and leaves page B untouched (and vice versa).
- **FR-22** Switching page is not itself an undoable step, and undo never silently switches the active page.

### Serialization, restore, export — `packages/excalidraw/data/**`, `scene/**`, `packages/common/src/constants.ts`

- **FR-23** `serializeAsJSON` writes all pages, their names, order, per-page viewport and every page's
  elements into one `.excalidraw` file; `loadFromJSON` / `restore` read it back identically (round trip).
- **FR-24** A file with no page data (legacy) restores onto one default page that holds all its elements;
  elements with no page (or an unknown page) restore onto the default/first page. Existing files keep
  loading unchanged apart from gaining the default page.
- **FR-25** Older readers stay safe: the format change is additive (unknown fields are ignored by today's
  `restore`). Whether `VERSIONS.excalidraw` changes is the architect's decision, recorded in the spec.
- **FR-26** Image export (PNG, SVG, clipboard, embedded scene in PNG/SVG) of the drawing exports only the
  active page's elements; the embedded scene data carries the whole file (all pages) only if the architect
  so decides and records it.
- **FR-27** Library items and the clipboard never carry page ids that would place pasted elements on a
  page other than the active one.

### Search — `packages/excalidraw/components/SearchMenu.tsx`

- **FR-28** Search matches text elements on every page; results show which page they are on; choosing a
  result on another page switches to that page and focuses the match.

### excalidraw-app — `excalidraw-app/**`

- **FR-29** Local persistence (`LocalData`, `localStorage.ts`) saves and restores the page list, active page
  and every page's elements; a reload restores the same pages.
- **FR-30** Collaboration: creating, renaming, reordering or deleting a page, and editing elements on any
  page, reaches every collaborator; a collaborator's active page and viewport are their own (not synced).
- **FR-31** The Firebase room save/load carries the page structure inside the existing encrypted payload;
  a room saved before this change loads onto one default page.
- **FR-32** Tab-sync between browser tabs (`tabSync.ts`) keeps working with pages.

### Public API & docs

- **FR-33** Page types and helpers needed by hosts are exported from `packages/excalidraw/index.tsx`;
  `ExcalidrawImperativeAPI.updateScene` and `initialData` accept page data.
- **FR-34** `dev-docs/docs/codebase/json-schema.mdx` describes the page fields; `packages/excalidraw/CHANGELOG.md`
  lists the feature under the unreleased section.

## 4. Non-functional requirements

- **NFR-1** TypeScript strict passes (`yarn test:typecheck`); ESLint passes with zero warnings (`yarn test:code`).
- **NFR-2** No new dependencies; no edit to any `package.json` or `yarn.lock`.
- **NFR-3** Performance: filtering by page must not add an O(n) pass per pointer move beyond what the
  renderer already does; the active page's element list is cached and invalidated with the scene nonce.
- **NFR-4** Backward compatibility: every existing test keeps passing. Snapshot files that change only
  because `AppState` gains the page fields are regenerated with the project's own snapshot update command
  (`vitest --update` on the affected test files, a tooling step), never typed by hand.
- **NFR-5** Follow AGENTS.md: DOM APIs through `app.ownerDocument` / `app.ownerWindow`; prefer
  `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`.
- **NFR-6** Accessibility: tabs are keyboard reachable, use `role="tablist"` / `role="tab"` with
  `aria-selected`, and the rename input has an accessible label.

## 5. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Page name | Low — user-authored text, may contain project names | Stored with the drawing; end-to-end encrypted in collaboration and Firebase exactly like element text; never logged or sent to analytics |
| Page elements | As today's element data | Unchanged: encrypted payload in collab/Firebase |

No new personal data, credentials or tracking is introduced.

## 6. Role matrix

| Role | Resource | Actions |
|---|---|---|
| Editor (local) | pages, elements | create, switch, rename, reorder, delete pages; edit elements on the active page |
| Viewer (view mode) | pages | switch pages; no create/rename/reorder/delete |
| Collaborator (room member) | pages, elements | same as editor; page structure and elements sync; own active page and viewport |
| Host app (library consumer) | API | read/write pages through `initialData`, `updateScene`, `AppState`; hide the tab bar |

## 7. Acceptance criteria

- **AC-1** jsdom tests create, switch, rename and delete pages through the actions and the tab bar.
- **AC-2** Tests assert that only the active page's elements are rendered (visible elements passed to the
  renderer) and selectable (select-all and click selection ignore other pages).
- **AC-3** Tests assert undo/redo stays on its page (FR-21, FR-22).
- **AC-4** Tests assert exporting the active page (export-to-canvas/SVG input) contains only its elements.
- **AC-5** Tests assert a legacy (page-less) file restores onto exactly one default page holding all its elements.
- **AC-6** A test reorders pages via the tab bar (drag or move-left/right) and asserts the new order.
- **AC-7** A test asserts pages, names, order, per-page elements and per-page viewport survive
  `serializeAsJSON` → `loadFromJSON`/`restore` in one file.
- **AC-8** A test in `excalidraw-app/tests` asserts page structure and per-page elements sync between
  collaborators (remote update applies pages and elements).
- **AC-9** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass (failures already
  present before the run are reported, not fixed).
- **AC-10** A test asserts search finds a text element on another page and switching to that result
  activates its page.
- **AC-11** A unit test covers the page helpers of FR-6 (default name uniqueness, reorder, delete keeps at
  least one page, legacy default page).
- **AC-12** A test asserts switching pages restores each page's own viewport (FR-8).

## 8. Open questions for HITL

1. **Element membership representation** (FR-2) — left to the architect's ADR, as the brief asks. The
   requirements prefer whichever keeps collaboration reconciliation by element id/version unchanged.
2. **Page-structure undo** (FR-14) — assumption: page add/rename/reorder/delete are *not* undoable in v1
   (they sync and persist, but undo history covers element changes only); the architect may decide otherwise.
3. **Tab bar placement** — assumption: in the footer's centre area on desktop (above the canvas bottom
   edge, without redesigning the footer) and above the bottom toolbar on mobile.
4. **Embedded scene in exported PNG/SVG** (FR-26) — assumption: carries the active page's elements only,
   matching the visible export.
5. **Snapshot churn** (NFR-4) — adding page fields to `AppState` changes many existing `__snapshots__`;
   assumption: a tooling step regenerates them after the code lands, and the reviewers check the diff is
   only the new fields.
