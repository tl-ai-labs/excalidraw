# Intent Brief — feature-extend — Lasso honours boxSelectionMode (Wrap / Overlap)

## Context
Source: `../prompts/EX-FE-04/brief.txt` + `command.txt` (reported in excalidraw/excalidraw#11809).
Rectangle box selection already honours the user preference `appState.boxSelectionMode`
(`"contain"` = "Wrap", `"overlap"` = "Overlap"; menu item `PreferencesBoxSelectionModeItem`),
via `getElementsWithinSelection(..., boxSelectionMode)` → `elementsOverlappingBBox({ type })` in
`packages/element/src/{selection,bounds}.ts`, called from `App.tsx:~11311`.
The free-form lasso (`packages/excalidraw/lasso/index.ts` → `getLassoSelectedElementIds` in
`lasso/utils.ts`) ignores the preference: today it selects an element if ANY sampled point of its
outline is inside the lasso polygon (`enclosureTest`) OR the lasso path crosses its outline
(`intersectionTest`) — i.e. it always behaves like Overlap.

## Goal
The lasso honours `appState.boxSelectionMode`:
- **Wrap (`contain`)** — an element is selected only if it is fully enclosed by the lasso polygon
  (every sampled outline point inside, and the lasso path does not cross the element outline).
- **Overlap (`overlap`)** — touching is enough (current behaviour: partial enclosure or intersection).

Before: preference = Wrap, a lasso that only clips the corner of a rectangle still selects it.
After: that same lasso leaves the rectangle unselected in Wrap and selects it in Overlap.

Implementation direction: add an optional `boxSelectionMode` input to `getLassoSelectedElementIds`
(default preserving existing callers' behaviour is decided by the architect), pass
`this.app.state.boxSelectionMode` from `lasso/index.ts`. Containment vs intersection must be correct for
rectangles, diamonds, ellipses, rotated shapes, lines/arrows and freehand strokes, plus bound text.
Use existing `@excalidraw/math` polygon helpers (`polygonIncludesPointNonZero`, segment intersection)
and the existing `elementsSegments` map — no new dependencies.

## Files in scope
- `packages/excalidraw/lasso/utils.ts` — selection-mode-aware enclosure/intersection logic
- `packages/excalidraw/lasso/index.ts` — pass `boxSelectionMode` from app state
- `packages/excalidraw/tests/lasso.test.tsx` — unit/jsdom tests for both modes per shape type
- `packages/excalidraw/tests/selection.test.tsx` — integration test: lasso tool + preference, both modes,
  and a regression check that box selection behaviour is unchanged
- `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` — only if snapshot output changes
- `packages/excalidraw/CHANGELOG.md` — one line under `## Unreleased` (companion: user-visible behaviour change)
- `.gitignore` — append a `.sdlc/` entry (approved at Gate 0)

## Files off-limits
Project defaults + AI configs: `.env`, `.env.*`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`,
`.mcp.json`, `.cursor/**`, `node_modules/**`, `**/node_modules/**`, `dist/**`, `**/dist/**`, `build/**`,
`**/build/**`, `dev-dist/**`, `.next/**`, `coverage/**`, `packages/excalidraw/types/**`, `.git/**`, `.sdlc/**`.
Ticket-specific: `packages/element/src/selection.ts`, `packages/element/src/bounds.ts` (box-selection
path must not change), `packages/excalidraw/components/App.tsx`,
`packages/excalidraw/components/main-menu/DefaultItems.tsx`, `packages/excalidraw/locales/**`,
`packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `excalidraw-app/**`.

## Acceptance criteria
1. With `boxSelectionMode: "contain"`, a lasso that clips only part of an element does not select it; a
   lasso that fully encloses it does.
2. With `boxSelectionMode: "overlap"`, a partially touched element is selected (and fully enclosed ones too).
3. Covered for rectangle, ellipse, rotated shape, line/arrow and freehand stroke in
   `packages/excalidraw/tests/lasso.test.tsx`, and an end-to-end lasso-tool case per mode in
   `packages/excalidraw/tests/selection.test.tsx` — including a partially touched element selected only in Overlap mode.
4. Existing box-selection tests pass unchanged.
5. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals
- No change to rectangle box-selection behaviour or its code path.
- No new preference, menu item, locale string or app-state field (the existing "Select on: Wrap / Overlap" preference now applies to both tools; renaming its label is out of scope).
- No changes to `excalidraw-app/`.
- No lasso performance rework beyond what the new checks need.

## Gate 0 decisions (frozen 2026-11-06)
- Approved scope: exactly the 7 allowlist paths above; off-limits as listed (29 patterns) — frozen in `.sdlc/local/write-contract.json`.
- Test command: `yarn test:app --watch=false`; extra checks `yarn test:typecheck`, `yarn test:code`.
- Policy: `argon4-plus-flash38` (project default). Auth mode: `estimated` (subscription; no ANTHROPIC_API_KEY).
- AI configs: off-limits. `.gitignore`: add `.sdlc/`.
