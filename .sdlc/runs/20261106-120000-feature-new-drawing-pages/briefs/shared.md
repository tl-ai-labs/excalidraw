## Conventions

- Follow strict package dependency direction: excalidraw-app -> @excalidraw/excalidraw -> @excalidraw/element -> @excalidraw/common / @excalidraw/math; packages/* must never import from excalidraw-app.
- Never mutate ExcalidrawElement or AppState in place; always use newElementWith or mutateElement so version and versionNonce increment for history deltas and collaboration reconciliation.
- Use app.ownerDocument and app.ownerWindow instead of global document and window wherever app is accessible.
- Prefer Merge<Base, Overrides> from @excalidraw/common/utility-types over Omit<Base, ...> & Overrides.
- Follow ESLint import order: external and @excalidraw/* packages first, then relative imports, then import type declarations.
- Add user-facing strings only to packages/excalidraw/locales/en.json and read them via t() from packages/excalidraw/i18n.ts; never edit other locale files.
- Every new AppState field must be wired in types.ts (AppState and UIAppState if used by UI), getDefaultAppState() and APP_STATE_STORAGE_CONF in appState.ts, and restoreAppState() in data/restore.ts.

## Decisions

- Page-membership representation (ADR: pageId on elements vs separate per-page element arrays): Element-level optional pageId?: string on _ExcalidrawElementBase (normalized via getElementPageId(el) -> el.pageId || DEFAULT_PAGE_ID where DEFAULT_PAGE_ID = 'page-1', and omitted as an own property when equal to DEFAULT_PAGE_ID) stored in a master allElements collection in Scene with cached active-page slices for getNonDeletedElements/getElementsIncludingDeleted/frames/maps and full-collection accessors getAllElementsIncludingDeleted/getAllNonDeletedElements (not Separate per-page element arrays or multiple Scene instances per page) — Collab reconciliation (reconcileElements, BroadcastedExcalidrawElement, Firebase sync) natively merges flat element arrays by id and version without changing wire containers; fractional indices are validated and synced per pageId group so z-order operations on one page never invalidate indices on other pages; frames are automatically scoped to the active page because Scene.frames and nonDeletedFramesLikes derive from the active-page slice; history deltas (History with per-page undo/redo stacks and StoreSnapshot preserving inactive pages' elements) isolate undo/redo per page; and .excalidraw JSON files keep a single top-level elements array for backward compatibility with single-page loaders
- Default page constants and deterministic PRNG / snapshot compatibility: Use deterministic constants DEFAULT_PAGE_ID = 'page-1' and DEFAULT_PAGE_NAME = 'Page 1' in getDefaultAppState(), omit pageId as an own property on elements when pageId === DEFAULT_PAGE_ID, omit default single-page fields in cleanAppStateForExport when untouched, and strip pages/activePageId/pageViewports in test-utils AppState snapshot serializer (not Calling randomId() inside getDefaultAppState() and always setting own property pageId: 'page-1' on every created element) — Existing test suites call reseed(7) in beforeEach and assert exact element snapshots and AppState/SVG export snapshots; deterministic DEFAULT_PAGE_ID and omitting default-page property noise keeps all 149 existing test files and snapshot suites passing without modifying .snap files
- AppState page fields and APP_STATE_STORAGE_CONF wiring: Add pages: readonly ExcalidrawPage[], activePageId: string, and pageViewports: Record<string, PageViewport> to AppState with APP_STATE_STORAGE_CONF entries pages: { browser: true, export: true, server: true }, activePageId: { browser: true, export: true, server: false }, pageViewports: { browser: true, export: true, server: false } (not Setting server: true for activePageId and pageViewports) — The ordered page list is shared across local storage, .excalidraw file exports, and collaboration servers, whereas each collaborator keeps their own activePageId and per-page viewport state locally unless following another user
- Per-page undo/redo history isolation: History maintains per-page undo and redo stacks keyed by activePageId (with setActivePageId and deletePageHistory helpers) while Scene/Store preserves inactive pages' elements when applying active-page history deltas (not Single global undo/redo stack shared across all pages) — Ensures Undo and Redo on the active page only revert or reapply element mutations on that page, keep the user on the active page, and never alter elements or history stacks of inactive pages
- Collaboration page list synchronization: Encrypt the optional pages array together with all pages' syncable elements inside Firebase StoredScene ciphertext using roomKey (with backward-compatible decryption when the decrypted JSON is either { elements, pages } or a legacy elements array) and include pages in encrypted WebSocket SCENE_INIT / SCENE_UPDATE payloads, falling back to a remaining valid page locally if a remote update deletes the local user's activePageId (not Storing pages in plaintext on FirebaseStoredScene beside ciphertext and iv or adding a separate room document/custom socket event) — Encrypting pages inside ciphertext and SCENE_INIT/SCENE_UPDATE payloads ensures page names are end-to-end encrypted with roomKey before reaching Firebase or the relay server while remaining backward-compatible with legacy single-page documents

## Files of this change

- `packages/common/src/constants.ts` (U01, edit) — import: `import { DEFAULT_PAGE_ID, DEFAULT_PAGE_NAME } from "@excalidraw/common";`
  - `const DEFAULT_PAGE_ID(): string`
  - `const DEFAULT_PAGE_NAME(): string`
- `packages/element/src/types.ts` (U02, edit) — import: `import type { ExcalidrawElement } from "@excalidraw/element/types";`
- `packages/element/src/newElement.ts` (U03, edit) — import: `import { newElement } from "@excalidraw/element";`
- `packages/element/src/fractionalIndex.ts` (U04, edit) — import: `import { syncInvalidIndices, syncMovedIndices, validateFractionalIndices, orderByFractionalIndex } from "@excalidraw/element";`
- `packages/element/src/Scene.ts` (U05, edit) — import: `import { Scene, getElementPageId, withElementPageId } from "@excalidraw/element";`
  - `function getElementPageId(element: Pick<ExcalidrawElement, "pageId">, fallbackPageId: string): string`
  - `function withElementPageId(element: T, pageId: string): T`
  - `class Scene(): Scene`
- `packages/excalidraw/locales/en.json` (U06, edit)
- `packages/excalidraw/types.ts` (U07, edit) — import: `import type { AppState, ExcalidrawPage, PageViewport } from "./types";`
  - `type ExcalidrawPage(): { id: string; name: string }`
  - `type PageViewport(): { scrollX: number; scrollY: number; zoom: Zoom }`
- `packages/excalidraw/appState.ts` (U08, edit) — import: `import { getDefaultAppState, cleanAppStateForExport, clearAppStateForDatabase, clearAppStateForLocalStorage } from "./appState";`
- `packages/excalidraw/history.ts` (U09, edit) — import: `import { History, HistoryDelta, HistoryChangedEvent } from "./history";`
  - `class History(store: Store): History`
- `packages/excalidraw/data/restore.ts` (U10, edit) — import: `import { restore, restoreAppState, restoreElement, restoreElements, restoreLibraryItems } from "./data/restore";`
  - `function restore(data: ImportedDataState | null, localAppState: Partial<AppState> | null | undefined, localElements: readonly ExcalidrawElement[] | null | undefined): RestoredDataState`
- `packages/excalidraw/data/json.ts` (U11, edit) — import: `import { serializeAsJSON, saveAsJSON, loadFromJSON } from "./data/json";`
- `packages/excalidraw/scene/export.ts` (U12, edit) — import: `import { exportScene, exportToClipboard } from "./scene/export";`
- `packages/excalidraw/data/reconcile.ts` (U13, edit) — import: `import { reconcileElements } from "./data/reconcile";`
- `packages/excalidraw/actions/actionCanvas.tsx` (U14, edit) — import: `import { actionClearCanvas } from "./actions/actionCanvas";`
- `packages/excalidraw/actions/actionExport.tsx` (U15, edit) — import: `import { actionSaveToActiveFile, actionSaveFileToDisk } from "./actions/actionExport";`
- `packages/excalidraw/components/PageTabs.scss` (U16, create) — import: `import "./PageTabs.scss";`
- `packages/excalidraw/components/PageTabs.tsx` (U17, create) — import: `import { PageTabs } from "../PageTabs";`
  - `function PageTabs(props: { appState: UIAppState }): JSX.Element`
- `packages/excalidraw/components/footer/Footer.tsx` (U18, edit) — import: `import Footer from "./footer/Footer";`
- `packages/excalidraw/components/SearchMenu.tsx` (U19, edit) — import: `import { SearchMenu } from "./SearchMenu";`
- `packages/excalidraw/components/App.tsx` (U20, edit) — import: `import App, { useApp } from "./components/App";`
- `excalidraw-app/data/index.ts` (U21, edit) — import: `import type { SocketUpdateDataSource } from "../data";`
- `excalidraw-app/data/firebase.ts` (U22, edit) — import: `import { saveToFirebase, loadFromFirebase, isSavedToFirebase } from "../data/firebase";`
- `excalidraw-app/collab/Portal.tsx` (U23, edit) — import: `import Portal from "./Portal";`
- `excalidraw-app/collab/Collab.tsx` (U24, edit) — import: `import Collab from "./collab/Collab";`
- `excalidraw-app/App.tsx` (U25, edit)
- `packages/excalidraw/tests/test-utils.ts` (U26, edit) — import: `import { render, fireEvent, waitFor } from "./test-utils";`
- `packages/excalidraw/tests/pages.test.tsx` (U27, create)
- `excalidraw-app/tests/pagesCollabAndStorage.test.tsx` (U28, create)
- `dev-docs/docs/codebase/json-schema.mdx` (U29, edit)
- `packages/excalidraw/CHANGELOG.md` (U30, edit)
