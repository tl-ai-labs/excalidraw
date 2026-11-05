# Intent Brief — feature-extend — Per-element arrowhead size

Status: Gate 0 approved 2026-11-05; scope frozen in `.sdlc/local/write-contract.json` (33 allowlist,
33 off-limits patterns). Gate 0 answers: auth `vendor`; policy `argon4-agsdk-only`; test command
`yarn test:typecheck && yarn test:code && yarn test:app --watch=false`; decision 1 yes (new arrows take
the last picked size); decision 2 as proposed (no key at the default size); no `.gitignore` change.

## Context

Arrowheads on arrows and lines are drawn at a fixed size per head type: `getArrowheadSize()` in
`packages/element/src/bounds.ts` (arrow 25px, diamond 12px, others 15px, cardinality markers their own
constants). `getArrowheadPoints()` shrinks a head automatically only when the last segment is too short
(`lengthMultiplier`, then `getArrowheadSizeBeyondLastSegment()` lets it grow back past the segment's start).
Requested upstream in excalidraw/excalidraw#6712.

Before: a short arrow between two small boxes carries a head almost as big as the boxes, and the
properties panel offers no size control.

Head size is also read outside rendering: `elbowArrow.ts` (route clearance at the endpoints) and
`transform.ts` (label placement next to a head), and `renderElement.ts` pads the arrow's canvas for its heads.

## Goal

An optional per-element arrowhead size, set from a control in the properties panel, with a default.

- One new optional property on linear elements (working name `arrowheadSize`; the architect picks the
  name and value type) that scales both heads of the element. When it is absent, the element renders exactly
  as today.
- A properties-panel control next to the existing arrowhead pickers sets it on the selected arrows. Like
  the other style controls, the last size picked becomes the size for arrows created next (Gate 0
  decision 1). It is held in a new current-item app-state field, used by every path that creates an arrow
  from the current style: drawing, the flowchart's binding arrow, shape recognition and type conversion.
  The new field adds one key to three app-state snapshot files, and those are the only snapshots allowed
  to change.
- An element at the default size carries no key, whether it was drawn new or restored from an old file.
  The key appears only once a size other than the default is chosen, on the element or as the remembered
  size. This is what keeps existing element snapshots and older collaborators unchanged.
- The existing short-segment fitting still applies on top of the chosen size: a head never grows past
  what its segment allows, so a smaller chosen size only makes it smaller.
- After: the same short arrow between two small boxes, set to a small size, shows a small, proportionate
  head, and the panel shows the size control.

## Files in scope

Proposed allowlist (Gate 0 confirms; the architect plans each as an edit):

Element package
- `packages/element/src/types.ts` — the optional property on `ExcalidrawLinearElement`
- `packages/element/src/newElement.ts` — `newLinearElement` / `newArrowElement` (both branches) accept it
- `packages/element/src/bounds.ts` — head geometry: chosen size feeds `getArrowheadPoints`, the angle and
  the short-segment fitting; bounds follow through the cached shape
- `packages/element/src/shape.ts` — head shapes (circle diameter, cardinality markers) read the same size
- `packages/element/src/elbowArrow.ts` — endpoint clearance uses the element's head size
- `packages/element/src/transform.ts` — label placement uses the element's head size
- `packages/element/src/flowchart.ts` — the flowchart's binding arrow takes the remembered size
- `packages/element/src/convertToShape.ts` — a recognized arrow takes the remembered size
- `packages/element/src/renderElement.ts` — canvas padding covers the largest allowed head
- `packages/element/src/mutateElement.ts` — only if the shape cache must be invalidated on a size change
- `packages/element/src/delta.ts` — history deltas, only if the new key needs handling
- `packages/common/src/constants.ts` — default value and the panel's preset sizes

Editor package
- `packages/excalidraw/data/restore.ts` — validate the property when present; never add it when absent
- `packages/excalidraw/renderer/staticSvgScene.ts` — SVG export, only if it needs the size explicitly
- `packages/excalidraw/actions/actionProperties.tsx` — new `actionChangeArrowheadSize`, rendered in
  `actionChangeArrowProperties` next to `changeArrowhead`
- `packages/excalidraw/actions/types.ts` — action name
- `packages/excalidraw/actions/index.ts` — export
- `packages/excalidraw/actions/actionStyles.ts` — copy/paste styles carries the size
- `packages/excalidraw/components/ConvertElementTypePopup.tsx` — converting between arrow kinds keeps it
- `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/App.drawshape.ts` — drawn
  arrows take the remembered size
- `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts` — the current-item field, its default
  and its storage config
- `packages/excalidraw/components/icons.tsx` — icons for the control, if it uses icons
- `packages/excalidraw/locales/en.json` — labels (English only; other locales come from Crowdin)
- `packages/excalidraw/CHANGELOG.md` — Unreleased → Features entry (public element type changes)

Tests
- `packages/excalidraw/tests/helpers/api.ts` — `API.createElement` copies the property onto arrows/lines
- `packages/element/tests/bounds.test.ts` — bounds and head points follow the size
- `packages/excalidraw/tests/data/restore.test.ts` — old arrow restores without the property; new value
  restores and invalid values are dropped
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (new) — panel control, SVG export of a smaller head
- The three app-state snapshot files, for the new current-item key only:
  `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap`,
  `packages/excalidraw/tests/__snapshots__/regressionTests.test.tsx.snap`,
  `packages/excalidraw/tests/__snapshots__/contextmenu.test.tsx.snap`

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- Existing AI setup (default off-limits): `.claude/settings.local.json`, `CLAUDE.md`, `AGENTS.md`,
  `.github/copilot-instructions.md`
- This ticket: `yarn.lock`, `**/package.json` (no dependency changes), `excalidraw-app/**`, `examples/**`,
  `dev-docs/**`, `packages/excalidraw/types/**`, the generated `packages/excalidraw/subset/**/*-wasm.ts`
- Every other snapshot file, element snapshots included: `packages/element/tests/__snapshots__/**`,
  `packages/excalidraw/tests/data/__snapshots__/**` and the remaining ten files in
  `packages/excalidraw/tests/__snapshots__/`

## Acceptance criteria

1. A jsdom test restores an arrow that carries a smaller size and exports it to SVG; its head is measurably
   smaller than the same arrow's head at the default size.
2. An old arrow without the property restores without it (no key added) and renders at today's size.
   Existing element and export snapshots are unchanged: `git diff` shows no change to any snapshot file
   except the three app-state snapshots, and in those only lines that add the new current-item key at
   its default value.
3. Bounds follow the size: a test shows a smaller size gives smaller element bounds for the same points,
   and the short-segment fitting still caps the head on a short last segment.
4. The panel shows the size control wherever the arrowhead pickers show. Changing it updates the selected
   arrows as one undoable history entry, and an arrow drawn afterwards takes the picked size.
5. The study's fixed test command passes, run word for word:
   `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`. Its three parts passed before
   any change (149 test files; 2632 passed, 47 skipped, 1 todo).
6. Snapshots are never accepted blindly. `yarn test:update` is never run. The three app-state snapshots
   are updated by `--update` limited to their own three test files, and the diff is checked to contain
   only the new key before the fixed test command runs.

## Non-goals

- Automatic sizing from the size of the arrow or its bound shapes. The head is "proportionate" because the
  person picks a smaller size; beyond that, only today's short-segment fitting adjusts it.
- Separate sizes for the start and end heads (one property scales both).
- Arrowhead controls for lines: `canHaveArrowheads` stays arrow-only, as today.
- The element skeleton API (`convertToExcalidrawElements`) and its docs in `dev-docs/`.
- Translations other than `en.json`.
- Older clients showing the new size: they don't know the property, so they draw such arrows at today's
  size, and they keep the property when they edit the element (restore and mutation keep unknown keys).
