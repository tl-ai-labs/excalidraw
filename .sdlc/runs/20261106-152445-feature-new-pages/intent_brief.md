# Intent Brief — feature-new — Pages in a drawing

Gate 0 approved by the user on 2026-11-06. The write contract is frozen for run `20261106-152445-feature-new-pages` with the allowlist and off-limits below (15 allowlist patterns, 25 off-limits patterns). Auth mode `vendor`; policy `argon4-plus-flash38`.

## Context

Source, verbatim from the user.

Command text:

> Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration.

Brief:

> Problem: an Excalidraw file holds one infinite canvas, so people who work on several related diagrams either crowd them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw" (excalidraw/excalidraw#1543) has 86 votes since 2020.
>
> Before: the editor has a single canvas and no tab bar.
> After: a tab bar shows pages such as "SDK flow" and "Data pipeline", and clicking each tab switches the canvas to that page's own diagram and viewport.
>
> What it needs: packages/element (page membership on elements or per-page scenes, scene filtering), packages/excalidraw (app state for the active page, a tab bar UI, history scoped correctly, export and serialization, restore that puts legacy files on one default page, search across pages), and excalidraw-app collaboration and local storage. Rendering, hit-testing, selection, undo, frames, export, library insert and collaboration all assume one element list today. Choose between a page id on every element and separate element arrays, and keep file-format backward compatibility.
>
> Acceptance criteria: jsdom tests create, switch, rename and delete pages and assert that only the active page's elements render and are selectable, undo stays on its page, export of a page contains only its elements, and a legacy file restores onto one page; yarn test:typecheck, yarn test:code and yarn test:app pass.

Constraints from discovery (`.sdlc/runs/20261106-152445-feature-new-pages/discovery.md`, `.sdlc/baseline/stack-profile.md`):

- Every reader of the whole element list has to become page-aware or receive only the active page's elements. About 30 modules call `scene.getNonDeletedElements()` or `getElementsIncludingDeleted()` today, among them `Scene.ts`, `binding.ts`, `dragElements.ts`, `linearElementEditor.ts`, `transform.ts`, `Renderer.ts`, `lasso/index.ts`, `SearchMenu.tsx`, `CommandPalette.tsx`, `Stats/*`, `App.*.ts` and the frame, select-all, deselect and finalize actions.
- Any new `AppState` key needs an entry in `APP_STATE_STORAGE_CONF` (in `appState.ts`); otherwise `tsc` fails. That entry also decides whether the key goes into exported files, local storage and the server.
- File format: `ExportedDataState`, `ImportedDataState`, `serializeAsJSON` and `restore*` must keep loading files written before pages existed, putting all of their elements on one default page.
- Collaboration: `WS_SUBTYPES`, `Portal`, `Collab` and `reconcileElements`. Page metadata (names and order) has to reach peers, and the plan must say what an older peer, one without pages, sees.
- History: `store.ts`, `delta.ts` and `history.ts`. Undo and redo must not change or reveal another page's elements.
- Large files: `App.tsx` (11,493 lines), `types.ts` (1,671), `restore.ts` (1,429) and `Collab.tsx` (1,106). Plan small, anchored edits.
- `.gitignore` ignores unanchored `build`, `dist`, `firebase`, `html`, `coverage`, `logs` and `meta*.json` at any depth. No new file or folder may use those names, or it will silently go untracked.
- Baseline before this run, at HEAD `14bb42ede`: `yarn test:typecheck` passes, `yarn test:code` passes, and `yarn test:app --watch=false` passes (149 files, 2,632 tests passed, 47 skipped).
- Test command, fixed by the study and used word for word: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: `vendor`. The policy `argon4-plus-flash38` has no Claude model: both Gemini models run as Antigravity SDK workers on Vertex ADC.

## Goal

A drawing holds an ordered list of named pages. Each page has its own elements and its own viewport (scroll and zoom). A tab bar in the editor creates, renames, reorders and deletes pages, and switches between them. Every editor behavior that works on "the scene" (rendering, hit-testing, selection, undo and redo, frames, export, library insert and search) works on the active page only, except that search also finds matches on other pages. All pages are saved in one `.excalidraw` file and in the app's local storage, and they are shared live in collaboration. Files from before pages load onto a single default page with no data lost.

The architect decides between storing a page id on every element and keeping separate element arrays per page, and records the trade-off at Gate 1/2.

## Files in scope

The allowlist is broad by design, because the change cuts across all three packages:

- `packages/element/src/**`: Scene, element types, frame, selection, store, delta and the other scene-wide modules.
- `packages/element/tests/**`
- `packages/excalidraw/**`: app state, `App.tsx`, actions, the tab-bar component and its scss, `LayerUI`, `SearchMenu`, history, `data/*` (json, restore, reconcile), scene export, renderer, `locales/en.json`, `CHANGELOG.md`, tests and fixtures. Crowdin locales, generated types and `package.json` are excluded under off-limits.
- `packages/common/src/**`: constants such as the export data version and any new event names.
- `excalidraw-app/App.tsx`, `excalidraw-app/app_constants.ts`
- `excalidraw-app/collab/**`, `excalidraw-app/data/**`, `excalidraw-app/share/**`
- `excalidraw-app/tests/**`
- `packages/utils/tests/__snapshots__/**`: only a snapshot can move here.
- Companion docs:
  - `dev-docs/docs/codebase/json-schema.mdx` (the file format gains pages)
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/initialdata.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`
  - `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx`

Snapshot rule, set by the user at Gate 0:

- An existing snapshot may change only by gaining the new page-related fields. No other value in it may change.
- Never run a blanket `yarn test:update`. Update only the snapshot files that need the new fields, one test file at a time (`yarn test:app --watch=false --update <test file>`). This overrides CLAUDE.md's "Always run `yarn test:update` before committing" for this run.
- Files under `__snapshots__/` are never hand-edited.
- The final report lists each updated snapshot file and the fields it gained.

What the snapshot rule means for the design: in tests, `randomId()` (`packages/common/src/random.ts`) returns sequential ids (`id0`, `id1`, …) and `randomInteger()` draws from a seeded generator. Any extra draw on a path existing tests already take would shift every later element id and seed in their snapshots. That covers mount, `restore`, loading a legacy file and creating an element. Any shifted value breaks the rule. So:

- The default page has a fixed, constant id. Creating it, and restoring a legacy file onto it, makes no `randomId()`, `randomInteger()` or `Math.random()` call.
- Only user actions that create a page draw a new id, and only new tests take those paths.

No `.gitignore` change in this run.

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- Existing AI setup: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Generated or vendored: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `packages/excalidraw/types/**`
- Crowdin-managed translations: `packages/excalidraw/locales/*-*.json`, `packages/excalidraw/locales/kaa.json`, `packages/excalidraw/locales/percentages.json`
- Dependencies: `package.json`, `**/package.json`, `yarn.lock`. The feature adds no packages.
- Everything outside the allowlist, including `examples/**`, `packages/math/**`, `packages/utils/src/**`, `.github/workflows/**`, `Dockerfile`, `docker-compose.yml`, `vercel.json`, `firebase-project/**` and `excalidraw-app/vite.config.mts`.

## Acceptance criteria

From the user's brief:

1. jsdom tests create, switch, rename and delete pages.
2. Those tests assert that only the active page's elements render and are selectable.
3. Undo stays on its page.
4. Export of a page contains only its elements.
5. A legacy file, with no page data, restores onto one page.
6. The study's fixed test command passes, word for word: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.

Added at Gate 0, accepted by the user:

7. A test reorders pages and checks that the order survives a save and restore round trip.
8. An `excalidraw-app` collaboration test checks that a peer's page create, rename and delete arrive, and that an element drawn on page B arrives on page B.
9. Reloading from local storage keeps the pages, their order and the active page.

## Non-goals

Accepted by the user at Gate 0:

- Binding, grouping or framing elements across pages. Arrows, groups and frames stay within one page.
- A dedicated "move to page" command. Copy on one page and paste on another is enough.
- Page thumbnails, or a background color or grid setting per page.
- Exporting every page at once, such as a multi-page PDF or a zip. Export stays per page.
- A library per page, or permissions per page in collaboration.
- Translating new strings beyond `en.json`. Crowdin handles the other locales.
