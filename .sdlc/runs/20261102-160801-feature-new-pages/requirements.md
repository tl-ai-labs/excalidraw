# Requirements: Multi-page drawings

Run: `20261102-160801-feature-new-pages`. Job: `feature-new`. Base: `14bb42ed`.
Source: `intent_brief.md`. The brief's scope, off-limits list and non-goals hold unchanged.
"Default" marks a product choice the brief left open; each one is listed under Open questions.

## In scope

1. A page model: a drawing holds one or more ordered, named pages, and every element belongs to exactly one page.
2. A tab bar that creates, renames, reorders, deletes and switches pages.
3. Per-page elements and per-page viewport.
4. Rendering, hit-testing, selection, frames, paste and library insert scoped to the active page.
5. Undo and redo scoped to the page.
6. Export scoped to the page; save and load of all pages in one file.
7. Restore that puts legacy files and legacy local data on one default page.
8. Local storage that keeps all pages across reloads.
9. Collaboration that shares all pages.
10. Search across pages.
11. Host API for pages, with the matching docs and changelog.
12. Tests for all of the above, using the existing Vitest and jsdom setup.

## Out of scope

1. A browser E2E runner or any new test dependency (brief, non-goal).
2. Translating strings into other locales (brief, non-goal).
3. Changes to the fonts or subsetting code (brief, non-goal).
4. Multi-page image or PDF export: one export contains one page. Default.
5. Page thumbnails, page templates, nested pages and links between pages.
6. Per-page permissions or locking a page.
7. Moving elements between pages other than by cut and paste. Default.
8. Undo of page structure changes (create, rename, reorder, delete). Default.
9. Per-page settings other than the viewport: theme, grid and background stay drawing-wide. Default.

## Functional requirements

### Page model (`packages/element`, `packages/common`)

- **FR-1** A drawing holds one or more pages in a defined order. Each page has a stable id, a name and an order that survives save, load and collaboration.
- **FR-2** Every element belongs to exactly one page. Elements on other pages stay in memory and are kept by save, local storage and collaboration.
- **FR-3** Exactly one page is active in each editor instance. The active page is local to that instance and is not sent to collaborators.
- **FR-4** The scene gives the editor the active page's elements for rendering, hit-testing and selection, and still gives save, collaboration and search access to the elements of all pages.
- **FR-5** A new page gets the default name `Page N`, where N is one more than the highest number in use among the `Page N` names. Names are trimmed and limited to 100 characters. An empty name keeps the previous name. Duplicate names are allowed.

### Tab bar (`packages/excalidraw`)

- **FR-6** A tab bar shows every page in order, marks the active page, and scrolls when the tabs do not fit.
- **FR-7** Create: a control adds a page after the last page and switches to it.
- **FR-8** Rename: double-clicking a tab, or its menu, opens an inline editor. Enter or blur commits, Escape cancels.
- **FR-9** Reorder: a tab can be dragged to a new position, and its menu offers move left and move right for keyboard users.
- **FR-10** Delete: a tab's menu deletes the page. A page with elements asks for confirmation first (Default). The last remaining page cannot be deleted. After a delete, the neighbouring page becomes active.
- **FR-11** Switch: clicking a tab makes that page active. A text edit or linear-element edit in progress is committed first, the selection is cleared (Default), and the target page's viewport is restored.
- **FR-12** In view mode a person can switch pages but cannot create, rename, reorder or delete them. A host can hide the tab bar through `UIOptions`. Zen mode hides it like the rest of the editor chrome (Default).

### Per-page viewport

- **FR-13** Each page keeps its own scroll position and zoom. Returning to a page restores them, and a new page opens at the default viewport. Viewports are saved with the page in the file and in local storage. They are not shared with collaborators.

### Scoping to the active page

- **FR-14** Only the active page's elements render on the static and interactive canvases, and only they can be hit-tested, selected, box-selected or selected with select-all.
- **FR-15** Frames, frame membership and element bindings stay within one page.
- **FR-16** Anything that adds elements (drawing, paste, duplicate, library insert, image insert, Mermaid and text-to-diagram insert, and the host's `updateScene`) puts them on the active page. A cut followed by paste on another page moves content there.
- **FR-17** Undo and redo act only on the active page. Switching pages is not an undo step, and a page's undo stack survives switching away and back within the session. Deleting a page discards its stack.

### Export and serialization (`packages/excalidraw/data`, `packages/excalidraw/scene`)

- **FR-18** Image export (PNG, SVG, clipboard) contains only the active page's elements. "Only selected" and frame export work within that page. A scene embedded in an exported image contains only that page (Default).
- **FR-19** Saving a `.excalidraw` file writes all pages, their order, each element's page and each page's viewport into one file. Loading it restores all of them and the active page.
- **FR-20** Restoring a file, or any scene data, with no pages puts all its elements on one default page, with no visible change to the drawing beyond a single-tab bar.
- **FR-21** Restore repairs damaged page data: an empty or malformed list becomes one default page, duplicate page ids are removed, an element naming an unknown page moves to the first page, and an unknown active page falls back to the first page.

### Search

- **FR-22** Search finds text and frame names on all pages and shows each match's page name. Activating a match on another page switches to that page and brings the match into view.

### Local storage (`excalidraw-app/data`)

- **FR-23** Local storage keeps all pages, their order, the active page and the viewports across a reload. Legacy local data loads onto one default page. Sync between browser tabs keeps working, including for page changes.

### Collaboration (`excalidraw-app/collab`, `excalidraw-app/data`, `excalidraw-app/share`)

- **FR-24** Elements on every page sync between collaborators, whichever page each collaborator is on. Creating, renaming, reordering and deleting pages also sync, and all collaborators converge on the same page list.
- **FR-25** A person joining a room receives all pages, and all pages persist through Firebase.
- **FR-26** Each collaborator chooses their own active page and viewport. Remote cursors and selections show only for collaborators on the same page. Following a user moves the follower to that user's page.
- **FR-27** When one collaborator deletes a page another is viewing, the viewer moves to a neighbouring page. When a page delete and an edit to one of its elements arrive concurrently, the delete wins and all clients converge (Default).
- **FR-28** Share links and export to Excalidraw+ carry all pages.

### Host API and docs

- **FR-29** Hosts can supply pages through `initialData`, read the page list and active page, change the active page and update pages through the imperative API, and receive enough through `onChange` to persist all pages. A host that ignores pages keeps today's behaviour on one default page.
- **FR-30** `packages/excalidraw/CHANGELOG.md` and the four in-scope `dev-docs` API pages describe the new behaviour and API.

## Non-functional requirements

- **NFR-1** Backward compatibility: every file, local-storage record and collaboration payload that parses today still loads. Page data is additive.
- **NFR-2** Performance: a drawing with one page has no added per-render work beyond a constant-time check. Filtering by page happens when the scene changes or the page switches, not on every render.
- **NFR-3** No new dependencies in any package manifest.
- **NFR-4** New user-facing strings go in `packages/excalidraw/locales/en.json` only.
- **NFR-5** Accessibility: the tab bar is keyboard-reachable, uses tab semantics, and every action has a keyboard path.
- **NFR-6** Encryption: page names and page structure travel only inside the existing end-to-end encrypted payloads. The server and Firebase never see them in plaintext.
- **NFR-7** Package layering follows the existing dependency direction: no lower package imports a higher one.
- **NFR-8** Fractional indices stay valid: the page model must not break index validation or reconciliation.
- **NFR-9** Snapshot files change only as a result of the new app state or page data.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Page name | User content, may be sensitive | Same as element text: encrypted in collaboration and share links, local to the browser in local storage |
| Page viewport | Low | Local and in the saved file; never sent to collaborators |
| Active page id | Low | Local to the editor instance; a collaborator's follow target goes through the existing encrypted channel |

No new personal data is collected and nothing is added to analytics.

## Role matrix

| Role | Switch page | Create, rename, reorder, delete | Edit elements |
|---|---|---|---|
| Solo user | Yes | Yes | Yes |
| Collaborator in a room | Yes, independently | Yes | Yes |
| View mode user | Yes | No | No |
| Host application | Through the API | Through the API | Through the API |

## Acceptance criteria

Each is a Vitest test under the in-scope test folders unless it says otherwise.

- **AC-1** jsdom tests create, switch, rename and delete pages through the tab bar, including the refusal to delete the last page.
- **AC-2** Those tests assert that only the active page's elements render and can be selected, including select-all.
- **AC-3** After edits on two pages, undo and redo on one page change only that page, and that page's stack survives a switch away and back.
- **AC-4** Exporting a page yields only that page's elements, for both image export and an embedded scene.
- **AC-5** A legacy file with no pages restores onto one default page holding all its elements, with the same order and indices.
- **AC-6** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.
- **AC-7** Reordering pages, by drag and by the move actions, changes the tab order and the saved order.
- **AC-8** Each page keeps its own scroll and zoom across switches.
- **AC-9** A multi-page file round-trips through serialize and restore with pages, order, names, membership, viewports and active page intact.
- **AC-10** A multi-page drawing written to local storage is read back intact after a simulated reload, and legacy local data loads on one page.
- **AC-11** Two simulated collaborators on different pages converge on elements and page list after create, rename, reorder and delete, and a late joiner receives all pages.
- **AC-12** Search returns matches from every page with their page names, and activating a match on another page switches to it.
- **AC-13** A host supplies pages through `initialData`, and reads and changes them through the API; a host that ignores pages sees one default page.
- **AC-14** Restore repairs the damaged page data listed in FR-21.

## Decision the architect must make and record

A page id on every element, or separate element arrays per page. Weigh it against element-level collaboration reconciliation, fractional z-indices, the library's `Scene`, `Store` and history, and file-format backward compatibility. Record the choice and its consequences in the change spec's decisions, including what an older client or older library version does with a multi-page file or room.

The stack profile did not read `App.tsx`, `Collab.tsx`, `restore.ts` or `types.ts` in full. The architect reads them directly.

## Open questions for HITL

Each has a default that this document already uses. Approving Gate 1 accepts them all; say otherwise for any you want changed.

1. **Undo of page changes.** Default: creating, renaming, reordering and deleting a page are not undoable, so deleting a page with elements asks for confirmation.
2. **Selection on switch.** Default: cleared, not remembered per page.
3. **Embedded scene in an exported image.** Default: only the exported page, which follows AC-4 strictly. A PNG reopened later therefore holds one page, not the whole drawing.
4. **Delete versus concurrent edit in collaboration.** Default: the delete wins.
5. **Zen mode.** Default: the tab bar hides, so switching pages needs leaving Zen mode.
6. **Moving elements between pages.** Default: cut and paste only.
7. **Per-page settings.** Default: only elements and viewport are per page. Theme, grid and background stay drawing-wide.
