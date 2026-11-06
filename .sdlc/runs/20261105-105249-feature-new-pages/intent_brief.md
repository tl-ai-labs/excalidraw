# Intent Brief — feature-new — Pages in a drawing (tab bar)

Run: `20261105-105249-feature-new-pages` · Status: **approved at Gate 0 (2026-11-05); write contract frozen**

## Context

The requester's words, verbatim:

> Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration.

> Problem: an Excalidraw file holds one infinite canvas, so people who work on several related diagrams either crowd them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw" (excalidraw/excalidraw#1543) has 86 votes since 2020.
>
> Before: the editor has a single canvas and no tab bar.
> After: a tab bar shows pages such as "SDK flow" and "Data pipeline", and clicking each tab switches the canvas to that page's own diagram and viewport.
>
> What it needs: packages/element (page membership on elements or per-page scenes, scene filtering), packages/excalidraw (app state for the active page, a tab bar UI, history scoped correctly, export and serialization, restore that puts legacy files on one default page, search across pages), and excalidraw-app collaboration and local storage. Rendering, hit-testing, selection, undo, frames, export, library insert and collaboration all assume one element list today. Choose between a page id on every element and separate element arrays, and keep file-format backward compatibility.

Interview answers:

- **Storage and API:** pages go through the library API: `initialData`, `updateScene`, `onChange` and the imperative API. They are also saved in the `.excalidraw` file, in excalidraw-app's local autosave, and in collaboration, including the collab room's Firebase save.
- **Embedders:** the tab bar is **opt-in**. It is off by default in `@excalidraw/excalidraw` and turned on in `excalidraw-app`, so current integrations look the same and their files keep loading as one page.
- **Tests:** vitest unit tests for the page model, serialization/restore and collab reconcile, plus jsdom tests that render `<Excalidraw>` and use the tab bar. There is no two-client collab test.

Discovery found no existing page concept: searching for `currentPage|activePage|pageId` returns nothing. Every surface assumes one element list: `Scene`, `Store`/`History`, rendering, hit-testing, selection, frames, export, library insert, `reconcileElements` and the collab `Portal`. The full orientation is in `.sdlc/runs/20261105-105249-feature-new-pages/discovery.md` under "Feature map for multi-page work".

## Goal

A drawing holds one or more **pages**. Each page has its own elements and its own viewport (scroll and zoom). When the tab bar is turned on, it shows the pages and lets the person create, rename, reorder and delete them. Clicking a tab switches the canvas to that page.

All pages are saved together in one `.excalidraw` file, in excalidraw-app's local autosave and in the collab room. In collaboration, every page and every page operation syncs between collaborators. A file without pages, written before this change, loads unchanged as one default page.

The architect chooses the representation, either a page id on every element or separate element arrays per page, and records the reasons in the change plan. The choice must keep the file format backward compatible. The architect must also make sure an embedder saving from `onChange` cannot silently lose pages it does not see.

## Files in scope

Proposed allowlist (Gate 0 may change it):

- **Element model and scene:** `packages/element/src/**`, `packages/element/tests/**`
- **Shared constants and types:** `packages/common/src/**`
- **Editor:**
  - `packages/excalidraw/components/**` (App, LayerUI, footer, new tab bar, search)
  - `packages/excalidraw/actions/**`
  - `packages/excalidraw/data/**` (json, restore, blob, reconcile, types)
  - `packages/excalidraw/scene/**`
  - `packages/excalidraw/renderer/**`
  - `packages/excalidraw/css/**`
  - `packages/excalidraw/lasso/**`, `packages/excalidraw/eraser/**`, `packages/excalidraw/hooks/**` (these read the scene directly, so they need the same page filtering as selection)
  - `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/history.ts`, `packages/excalidraw/index.tsx`
  - `packages/excalidraw/clipboard.ts`, `packages/excalidraw/snapping.ts`, `packages/excalidraw/viewport.ts`
  - `packages/excalidraw/locales/en.json` (only this locale)
  - `packages/excalidraw/tests/**`
- **App (collab, local storage, Firebase, share link):** `excalidraw-app/App.tsx`, `excalidraw-app/app_constants.ts`, `excalidraw-app/collab/**`, `excalidraw-app/data/**`, `excalidraw-app/tests/**`
- **Snapshots** (new AppState and file keys will change them): `**/__snapshots__/**`
- **Companion docs:**
  - `packages/excalidraw/CHANGELOG.md`
  - `dev-docs/docs/codebase/json-schema.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/initialdata.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/ui-options.mdx`

`.gitignore` is **not** in scope: Gate 0 declined adding a `.sdlc/` entry.

## Files off-limits

- **Project defaults:** `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- **AI setup found in the repo** (default off-limits): `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- **Generated or build output:**
  - `**/node_modules/**`, `**/dist/**`, `**/build/**`, `dev-dist/**`, `coverage/**`
  - `packages/excalidraw/types/**`
  - `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- **Others:** `CLAUDE.local.md`, `.cursor/**`, `.env.local`
- **Outside the allowlist, so refused as well:**
  - `firebase-project/firestore.rules`
  - every locale except `en.json` (Crowdin manages them)
  - `examples/**`, `packages/utils/**`, `packages/math/**`, `excalidraw-app/share/**`

## Acceptance criteria

The requester's words, verbatim:

> jsdom tests create, switch, rename and delete pages and assert that only the active page's elements render and are selectable, undo stays on its page, export of a page contains only its elements, and a legacy file restores onto one page; yarn test:typecheck, yarn test:code and yarn test:app pass.

From the interview:

1. The tab bar is off by default in `@excalidraw/excalidraw` and on in `excalidraw-app`. With it off, an existing integration renders and behaves as before.
2. Reordering pages is covered by a test as well as create, switch, rename and delete, since the tab bar offers all five.
3. Each page keeps its own viewport. Switching away and back restores that page's scroll and zoom (jsdom test).
4. A `.excalidraw` file with several pages survives save → load with every page, its order, name, elements and viewport intact (unit test). A legacy file with no pages restores onto one default page (requester's criterion).
5. Library API: `initialData` and `updateScene` accept pages, and `onChange` and the imperative API expose them (unit or jsdom test).
6. excalidraw-app local autosave keeps every page and the active page across a reload (unit test of the LocalData save/import path).
7. Collab reconcile keeps page membership and page operations (create, rename, reorder, delete) consistent when local and remote updates merge (unit test on reconcile and the app's reconcile path; no two-client test).
8. Snapshot changes are limited to the new page-related keys. The run regenerates them with `yarn test:update`, as CLAUDE.md requires, and review checks the snapshot diff.

## Non-goals

- Translating the new strings into locales other than `en.json`
- Changing Firestore security rules (`firebase-project/firestore.rules`)
- A two-client end-to-end collab test
- Per-page permissions, page templates, page thumbnails, or linking between pages
- Changes to `examples/**` or `packages/utils/**`
- Exporting several pages into one image or PDF (exporting a page exports only that page)

## Gate 0 decisions

1. **Share links (`#json=`) carry every page.** The share-link export and import in `excalidraw-app/data/index.ts` round-trips all pages, their order and the active page.
2. **Embedders with the tab bar off:** loading a file with several pages shows the active page. The other pages stay intact in the data, and `onChange`, save and export keep them, so an embedder that saves never drops a page it cannot see. A unit or jsdom test covers this.
3. **Auth mode:** `vendor`. **Policy:** `argon4-agsdk-only`. **Test command:** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`, with snapshots regenerated through `yarn test:update`.
4. **No `.gitignore` change.** `.sdlc/` is ignored only through this checkout's `.git/info/exclude`. The final report should mention that a fresh clone won't ignore it.
5. **Baseline first:** run the suite once on the clean HEAD before codegen, so any failure that already exists isn't blamed on this change.
