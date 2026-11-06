# Intent Brief — feature-new — Pages in a drawing (tab bar)

## Context
An Excalidraw file holds one infinite canvas, so people who work on several related diagrams either
crowd them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw"
(excalidraw/excalidraw#1543) has 86 votes since 2020.

Before: the editor has a single canvas and no tab bar.

Today rendering, hit-testing, selection, undo, frames, export, library insert and collaboration all
assume one element list (`Scene` in `packages/element/src/Scene.ts`). Elements carry `frameId`,
fractional `index`, `version`/`versionNonce`, `isDeleted`, `customData`; there is no page field.
`scrollX`/`scrollY`/`zoom` are browser-only AppState today. Collab syncs elements only, not AppState.

Seed (user's words): "Add pages to a drawing: a tab bar to create, rename, reorder and delete pages,
each with its own elements and viewport, saved in one file and shared in collaboration."

## Goal
A tab bar shows pages such as "SDK flow" and "Data pipeline"; clicking a tab switches the canvas to
that page's own diagram and viewport. Users can create, rename, reorder and delete pages. All pages
are saved in one `.excalidraw` file and shared in collaboration.

What it needs:
- `packages/element`: page membership (a page id on every element, or per-page scenes / separate
  element arrays) and scene filtering. **Open design decision for the architect** — choose one with
  ADR rationale, weighing collab reconciliation, fractional indices, frames, history deltas and
  file-format backward compatibility.
- `packages/excalidraw`: app state for the page list and active page; a tab bar UI (create, rename,
  reorder, delete with confirm); history scoped to the page; export and serialization; restore that
  puts legacy files on one default page; search across pages; i18n strings in `locales/en.json` only.
- `excalidraw-app`: collaboration (page list + per-page elements; viewport stays per user) and local
  storage (all pages survive reload).

Constraints from the stack profile: library never imports from `excalidraw-app`; element edits go
through `newElementWith`/`mutateElement`; new AppState fields wired through type, defaults, storage
table and `restoreAppState`; new import fields optional with defaults in `restore.ts`; AGENTS.md
rules (`app.ownerDocument`/`ownerWindow`, `Merge<>`).

## Files in scope
- `packages/element/src/**`, `packages/element/tests/**`
- `packages/common/src/**` (constants, shared types)
- `packages/excalidraw/appState.ts`, `types.ts`, `history.ts`, `index.tsx`, `viewport.ts`
- `packages/excalidraw/actions/**`
- `packages/excalidraw/components/**` (App.tsx, LayerUI.tsx, footer/**, new PageTabs component, SearchMenu)
- `packages/excalidraw/context/**`
- `packages/excalidraw/data/**` (json, restore, blob, reconcile, types, library)
- `packages/excalidraw/scene/**`, `packages/excalidraw/renderer/**`
- `packages/excalidraw/locales/en.json`
- `packages/excalidraw/tests/**` (incl. `__snapshots__`)
- `excalidraw-app/collab/**`, `excalidraw-app/data/**`, `excalidraw-app/App.tsx`,
  `excalidraw-app/app_constants.ts`, `excalidraw-app/components/AppFooter.tsx`, `excalidraw-app/tests/**`
- Companion files: `dev-docs/docs/codebase/json-schema.mdx` (file format doc),
  `packages/excalidraw/CHANGELOG.md`

## Files off-limits
- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs (default off-limits): `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Ticket-specific: `packages/excalidraw/locales/*.json` other than `en.json` (Crowdin-managed),
  `packages/*/dist/**`, `packages/excalidraw/types/**`, `coverage/**`, `dev-dist/**`, `.husky/_/**`

## Acceptance criteria
- jsdom tests create, switch, rename and delete pages, and assert:
  - only the active page's elements render and are selectable;
  - undo stays on its page;
  - export of a page contains only its elements;
  - a legacy (single-page) file restores onto one default page.
- `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

## Non-goals
- Translating new strings beyond `en.json`.
- Per-page export of a whole multi-page file to PDF/slides, page thumbnails, cross-page links.
- Changing the backend storage format beyond what carrying pages requires.

## Gate 0 decisions (approved 2026-11-06)
- Stack: node-typescript (Yarn 1 monorepo) — accepted.
- Test command: `yarn test:app --watch=false`; acceptance also requires `yarn test:typecheck` and `yarn test:code`.
- Auth mode: estimated. Policy: argon4-plus-sonnet55.
- AI configs: all off-limits.
- `.gitignore` `.sdlc/` entry: declined — note in final report; `.gitignore` not in allowlist.
- Scope frozen as listed above (24 allowlist / 20 off-limits patterns).
- Record a baseline test run before codegen (pre-existing failures unknown).
