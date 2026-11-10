# Intent Brief — feature-new — Pages (tabbed canvases in one drawing)

> **Gate 0 approved 2026-11-09:**
> - auth mode `estimated`
> - policy `opus55-plus-flash38-agsdk`
> - test commands: `yarn test:typecheck`, `yarn test:code`, `yarn test:app --watch=false`
> - `.gitignore` not changed
>
> The scope below was frozen into the write contract as proposed (26 allowlist, 33 off-limits patterns).
> Snapshots are in scope, but they change only through `yarn test:update`. The derived acceptance criteria (3–8)
> were kept. The page-model choice is left to the architect, who records it as an ADR. The orchestrator
> proposed a page id on every element.

## Context

An Excalidraw file holds one infinite canvas. People who work on several related diagrams either crowd
them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw"
(excalidraw/excalidraw#1543) has 86 votes since 2020.

- **Before:** the editor has a single canvas and no tab bar.
- **After:** a tab bar shows pages such as "SDK flow" and "Data pipeline". Clicking a tab switches the canvas
  to that page's own diagram and viewport.

Every part of the editor assumes one element list today:
- `Scene` in `packages/element/src/Scene.ts` holds one ordered element array (`elements`, `nonDeletedElements`,
  frames, `elementsMap`).
- Rendering (`packages/excalidraw/renderer/*`, `scene/Renderer.ts`), hit-testing and selection
  (`components/App*.ts`), undo (`history.ts`, `packages/element/src/store.ts`, `delta.ts`), frames
  (`packages/element/src/frame.ts`), export (`scene/export.ts`, `exportScene`), library insert
  (`App.addElementsFromPasteOrLibrary`) and search (`components/SearchMenu.tsx`) all read that one list.

The file format is `{ type, version, source, elements, appState, files }`. It is written by `serializeAsJSON`
in `data/json.ts` and read by `restoreElements` / `restoreAppState` in `data/restore.ts`, with the shapes in
`data/types.ts`.

In the app (`excalidraw-app`):
- Autosave writes the elements and appState to localStorage (`data/LocalData.ts`, `data/localStorage.ts`).
- Collaboration sends `SCENE_INIT` / `SCENE_UPDATE` element arrays over the socket (`collab/Portal.tsx`,
  `collab/Collab.tsx`, `data/index.ts`) and reconciles them per element by id (`data/reconcile.ts`).
- The room is also persisted as one encrypted element array in Firestore (`data/firebase.ts`).
- The relay server forwards encrypted payloads it can't read, so a new message subtype needs no server
  change.

**Design decision the architect must make and record (ADR):** store a page id on every element, or keep a
separate element array per page. Both options must preserve file-format backward compatibility.

Observations to weigh, not a decision:
- A page id on every element keeps one `elements` array in the file, the socket messages, Firestore and
  per-element reconciliation, so collaboration and storage change least. In exchange, `Scene` and every
  consumer must filter to the active page.
- Separate arrays isolate rendering and hit-testing for free, but they change the file shape, the socket
  payloads, the Firestore document and reconciliation.

**Repo conventions:** the architect carries these into the spec. They come from `.sdlc/baseline/stack-profile.md`,
CLAUDE.md, AGENTS.md and the copilot instructions.
- Adding an AppState field takes four touches: `types.ts`, `getDefaultAppState`, `APP_STATE_STORAGE_CONF`
  and `restore.ts`.
- Actions are written and registered through `register()` and the `ActionName` union, and re-exported from
  `actions/index.ts`.
- jotai is used only through `editor-jotai` / `app-jotai`, never imported directly.
- Each component has a `.scss` file next to it.
- New UI strings go in `locales/en.json` only.
- Use `app.ownerDocument` / `app.ownerWindow`, never the `document` / `window` globals.
- Use the `Merge<>` utility type; prefer immutable data and keep performance in mind.
- Imports follow the eslint order rules, with `import type` on separate lines and no barrel imports.

## Goal

Add **pages** to a drawing:
- A tab bar to create, rename, reorder and delete pages.
- Each page has its own elements and its own viewport (scroll and zoom), restored when you switch back to it.
- All pages are saved in one `.excalidraw` file and in the app's browser autosave.
- The page list and every page's elements are shared live in a collaboration room.

The feature lives in the editor library (`packages/element`, `packages/excalidraw`), so every embedder and the
file format get it. `excalidraw-app` wires it into collaboration and local storage.

Within the editor:
- History is scoped so undo stays on its page.
- Exporting a page contains only that page's elements.
- Library insert and paste land on the active page.
- Frames and bindings stay within a page.
- Search covers all pages and switches to the page of a chosen result.
- A legacy file (no page data) restores onto one default page.

## Files in scope

Proposed allowlist (the write contract matches globs):

**packages/element** — page membership, scene filtering, store/delta
- `packages/element/src/**`
- `packages/element/tests/**`

**packages/excalidraw** — app state, tab bar, history, export, serialization, restore, search
- `packages/excalidraw/components/**` (App and its helpers, LayerUI, the new tab bar component and its `.scss`, SearchMenu)
- `packages/excalidraw/actions/**` (page actions: create, rename, reorder, delete, switch)
- `packages/excalidraw/data/**` (json, restore, types, reconcile, blob)
- `packages/excalidraw/scene/**` (export, Renderer)
- `packages/excalidraw/renderer/**`
- `packages/excalidraw/appState.ts`
- `packages/excalidraw/types.ts`
- `packages/excalidraw/history.ts`
- `packages/excalidraw/clipboard.ts`
- `packages/excalidraw/index.tsx` (public exports)
- `packages/excalidraw/locales/en.json`
- `packages/excalidraw/css/**`
- `packages/excalidraw/tests/**`
- `packages/excalidraw/CHANGELOG.md` (companion: Unreleased → Features entry)

**Shared constants / export utils**
- `packages/common/src/constants.ts` (default page id/name, export data types)
- `packages/utils/src/**` (if `exportScene` there needs the page filter)

**excalidraw-app** — collaboration and local storage
- `excalidraw-app/collab/**`
- `excalidraw-app/data/**`
- `excalidraw-app/app_constants.ts`
- `excalidraw-app/App.tsx`
- `excalidraw-app/tests/**`

**Companion docs**
- `dev-docs/docs/codebase/json-schema.mdx` (the file format gains pages)
- `dev-docs/docs/@excalidraw/excalidraw/api/**` (new props, `excalidrawAPI` methods, `initialData`)

**Test snapshots**
- `**/__snapshots__/**`, changed only by `yarn test:update`, never hand-edited. A new AppState field changes
  the snapshots in history, regression and context-menu tests.

## Files off-limits

**Project defaults:** `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

**AI configs found by discovery (default OFF-LIMITS):** `.claude/**`, `CLAUDE.md`, `AGENTS.md`,
`.github/copilot-instructions.md`

**Generated or build output:** `**/node_modules/**`, `**/dist/**`, `**/build/**`, `dev-dist/**`, `coverage/**`,
`packages/*/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`,
`packages/excalidraw/subset/woff2/woff2-wasm.ts`

**Dependencies, so nothing new is added:** `yarn.lock`, `**/package.json`

**Translations, which Crowdin manages:** `packages/excalidraw/locales/??-??.json`,
`packages/excalidraw/locales/kaa.json`, `packages/excalidraw/locales/kab-KAB.json`,
`packages/excalidraw/locales/percentages.json`

**Infra, rules and CI:** `.github/workflows/**`, `firebase-project/**`

## Acceptance criteria

From the spec:
1. jsdom tests create, switch, rename and delete pages, and assert that:
   - only the active page's elements render and are selectable;
   - undo stays on its page;
   - exporting a page contains only its elements;
   - a legacy file restores onto one page.
2. `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass. The pre-run baseline is green:
   typecheck exit 0, lint exit 0, 149 test files and 2632 tests passed (47 skipped, 1 todo).

Derived from the job description (strike any at Gate 0):

3. Reordering pages from the tab bar changes their order, and the order survives save and load.
4. Each page keeps its own viewport: switching away and back restores that page's scroll and zoom.
5. A multi-page drawing round-trips through `serializeAsJSON` → `loadFromBlob`/restore with every page, its name,
   its order and its elements intact.
6. The app's localStorage autosave restores every page after a reload.
7. In collaboration, creating, renaming, reordering or deleting a page, and editing an element on a non-active
   page, reaches a peer.
   - A test in `excalidraw-app/tests/` covers the page list and elements reaching the peer.
   - A peer joining late (`SCENE_INIT`) receives all pages.
8. Deleting the last remaining page is not possible. Deleting the active page switches to a neighbour.

## Non-goals

- No change to the collaboration relay server, Firestore security rules or CI workflows.
- No new npm dependencies.
- No moving or copying elements between pages, and no cross-page arrows, bindings or frames.
- No multi-page export (one PDF or image of all pages). Export stays per page.
- No translation of the new strings beyond `en.json`.
- No per-page background colour or grid settings. Those stay drawing-wide unless the architect finds they must
  be per page.
- No change to Excalidraw+ export (`ExcalidrawPlusIframeExport.tsx`) or the share-link backend format, beyond
  what falls out of `serializeAsJSON` carrying pages.
