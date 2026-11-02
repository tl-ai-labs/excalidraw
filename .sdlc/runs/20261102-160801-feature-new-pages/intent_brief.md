# Intent Brief — feature-new — Multi-page drawings

## Context

Seed, verbatim: "Add pages to a drawing: a tab bar to create, rename, reorder and delete pages, each with its own elements and viewport, saved in one file and shared in collaboration."

Problem, from the requester: an Excalidraw file holds one infinite canvas, so people who work on several related diagrams either crowd them onto one board or juggle many files and browser tabs. "Tabs in Excalidraw" (excalidraw/excalidraw#1543) has 86 votes since 2020.

Before: the editor has a single canvas and no tab bar.

After: a tab bar shows pages such as "SDK flow" and "Data pipeline", and clicking each tab switches the canvas to that page's own diagram and viewport.

Rendering, hit-testing, selection, undo, frames, export, library insert and collaboration all assume one element list today. The repo at 14bb42ed has no page concept.

## Goal

A drawing holds one or more ordered, named pages. A tab bar creates, renames, reorders, deletes and switches pages. Each page has its own elements and viewport. All pages are saved in one file, kept by local storage, and shared in collaboration. Files with no pages open unchanged on one default page.

Work required, by layer:

- `packages/element`: page membership (page id on elements or per-page scenes) and scene filtering.
- `packages/excalidraw`: app state for the active page, tab bar UI, correctly scoped history, export and serialization, restore that puts legacy files on one default page, search across pages.
- `excalidraw-app`: collaboration and local storage.

Decision the architect must make and record: a page id on every element, or separate element arrays. Weigh it against element-level collab reconciliation, fractional z-indices, the library's `Scene`/`Store`/history, and file-format backward compatibility.

## Files in scope

- `packages/element/src/**`, `packages/element/tests/**`
- `packages/common/src/**`
- `packages/utils/src/**`, `packages/utils/tests/**`
- `packages/excalidraw/` code: `actions/**`, `components/**`, `context/**`, `css/**`, `data/**`, `hooks/**`, `renderer/**`, `scene/**`, `tests/**`, and its root-level `*.ts` / `*.tsx` files
- `packages/excalidraw/locales/en.json` (English strings only; other locales are Crowdin-managed)
- `excalidraw-app/App.tsx`, `excalidraw-app/app_constants.ts`, `excalidraw-app/index.scss`
- `excalidraw-app/collab/**`, `excalidraw-app/data/**`, `excalidraw-app/share/**`, `excalidraw-app/components/**`, `excalidraw-app/tests/**`

Companion files:

- `packages/excalidraw/CHANGELOG.md`
- `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`, `initialdata.mdx`, `props.mdx`, `ui-options.mdx`
- Snapshot files under the test folders above, because new app state changes them

## Files off-limits

- `.sdlc/project.json` defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI config: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`
- Generated output: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.next/**`, `dev-dist/**`, `**/dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`
- Generated sources: `packages/excalidraw/fonts/**`, `packages/excalidraw/subset/**`
- Every locale file other than `en.json` (outside the allowlist)

## Acceptance criteria

1. jsdom tests create, switch, rename and delete pages.
2. Those tests assert that only the active page's elements render and are selectable.
3. Undo stays on its page.
4. Export of a page contains only its elements.
5. A legacy file restores onto one page.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

Reorder, per-page viewport, multi-page file round-trip, local-storage reload, collaboration sync and search across pages come from the stated scope and also need tests.

## Non-goals

- A browser E2E runner or any new test dependency.
- Translating strings into other locales.
- Changes to the fonts or subsetting code.

## Gate 0 outcome

Approved 2026-11-02. Scope above accepted unchanged.

- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: `estimated`
- Policy: `opus55-plus-sonnet55`
- Existing AI setup: off-limits
- `.gitignore`: declined, not in the allowlist. Note this in the final report.
