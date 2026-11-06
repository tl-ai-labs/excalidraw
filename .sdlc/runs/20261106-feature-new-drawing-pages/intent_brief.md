# Intent Brief — feature-new — Pages in a drawing (tab bar)

## Context
An Excalidraw file holds one infinite canvas. People who work on several related diagrams either crowd
them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw" (excalidraw/excalidraw#1543)
has 86 votes since 2020.

Today rendering, hit-testing, selection, undo, frames, export, library insert and collaboration all assume
one flat element list (`packages/element/src/Scene.ts`). Elements carry no page id. `scrollX`/`scrollY`/`zoom`
are browser-only AppState (not exported). Collaboration (`excalidraw-app/collab/*`) syncs elements only, not
appState; Firebase stores encrypted elements only.

User's words (seed): "Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with
its own elements and viewport, saved in one file and shared in collaboration."

Before: the editor has a single canvas and no tab bar.
After: a tab bar shows pages such as "SDK flow" and "Data pipeline"; clicking a tab switches the canvas to that
page's own diagram and viewport.

## Goal
Add multi-page drawings:
- **Tab bar UI** (packages/excalidraw) to create, switch, rename, reorder and delete pages.
- **Data model** (packages/element): page membership — the architect must choose between a page id on every
  element and separate per-page element arrays, with ADR rationale, and implement scene filtering so only the
  active page's elements are rendered, hit-tested and selectable.
- **App state**: the active page id; a viewport (scroll + zoom) kept per page and restored on switch.
- **History**: undo/redo scoped correctly — undo stays on its page.
- **Export & serialization**: pages saved in one `.excalidraw` file; exporting a page contains only its elements.
- **Restore**: legacy files (no pages) restore onto one default page; file-format backward compatibility kept.
- **Search** works across pages.
- **excalidraw-app**: pages (list, names, order, per-page elements) persisted in local storage and shared in
  collaboration.

## Files in scope
Proposed (Gate 0 may adjust):
- `packages/element/src/**` (Scene, types, fractionalIndex, store/delta, frame, new page helpers)
- `packages/common/src/**` (constants, e.g. export data versions / defaults)
- `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`
- `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/LayerUI.tsx`,
  `packages/excalidraw/components/MobileMenu.tsx`, `packages/excalidraw/components/footer/**`
- `packages/excalidraw/components/PagesTabBar/**` (new)
- `packages/excalidraw/components/SearchMenu.tsx`
- `packages/excalidraw/actions/**` (new page actions + `types.ts` ActionName union, history action)
- `packages/excalidraw/history.ts`
- `packages/excalidraw/data/**` (json, types, restore, blob, library, reconcile)
- `packages/excalidraw/scene/**` (export, renderer filtering)
- `packages/excalidraw/renderer/**`
- `packages/excalidraw/index.tsx` (public exports)
- `packages/excalidraw/locales/en.json`
- `packages/excalidraw/css/**` and component `.scss` files
- `packages/excalidraw/tests/**` (new tests + snapshot updates under `__snapshots__`)
- `packages/element/tests/**`
- `excalidraw-app/collab/**`, `excalidraw-app/data/**`, `excalidraw-app/App.tsx`,
  `excalidraw-app/app_constants.ts`, `excalidraw-app/components/AppFooter.tsx`
- `excalidraw-app/tests/**`
- Companion docs: `dev-docs/docs/codebase/json-schema.mdx` (file format), `packages/excalidraw/CHANGELOG.md`

## Files off-limits
Project defaults (`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus:
- AI configs: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Generated: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- `packages/excalidraw/types/**`, `coverage/**`, `dev-dist/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`
- `package.json` files and `yarn.lock` (no new dependencies)

## Acceptance criteria
1. jsdom tests create, switch, rename and delete pages.
2. Tests assert only the active page's elements render and are selectable.
3. Tests assert undo stays on its page.
4. Tests assert exporting a page contains only its elements.
5. Tests assert a legacy (page-less) file restores onto one default page.
6. Reorder of pages works via the tab bar (covered by a test).
7. Pages and per-page viewport survive save → load in one file.
8. Page structure and per-page elements sync between collaborators (covered in `excalidraw-app/tests`).
9. `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

## Non-goals
- No new npm dependencies.
- No server/Firebase schema migration beyond what's needed to carry pages in the existing encrypted payload.
- No redesign of the existing footer, sidebar or toolbar beyond hosting the tab bar.
- No cross-page linking, page thumbnails or page templates.

## Gate 0 decisions (approved 2026-11-06)
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: estimated
- Policy: opus55-plus-flash38
- .gitignore `.sdlc/` entry: no (covered by .git/info/exclude)
- AI configs: all off-limits
- File scope: as proposed above, frozen in `.sdlc/local/write-contract.json` (28 allowlist, 26 off-limits patterns);
  off-limits additionally includes every `package.json` and `yarn.lock`.
