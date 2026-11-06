# Intent Brief — feature-extend — Per-element arrowhead size

## Context

Arrowheads on arrows and lines have a fixed size per head type (`getArrowheadSize` in
`packages/element/src/bounds.ts`: 25px for `arrow`, 12px for diamonds, 15/20px for cardinality
markers, 15px otherwise). The only adaptation today is automatic: `getArrowheadPoints` shrinks a head
on a short last segment and `getArrowheadSizeBeyondLastSegment` lets it grow back past the segment's
start where it fits. Requested in excalidraw/excalidraw#6712.

The full per-type size is also read outside head drawing: elbow-arrow routing keeps each leg longer
than its head (`packages/element/src/elbowArrow.ts`), and skeleton-to-element label placement keeps a
label clear of the head (`packages/element/src/transform.ts`). Canvas and SVG export both draw heads
through `getArrowheadShapes` → `getArrowheadPoints` (`packages/element/src/shape.ts`), and element
bounds come from the same generated shape, so one geometry change reaches both renderers and bounds.

History deltas (`packages/element/src/delta.ts`) and collaboration reconciliation
(`packages/excalidraw/data/reconcile.ts`) work on whole elements by `version`/`versionNonce`, so a new
element field is carried through undo/redo and sync without code there. That is verified by tests
rather than edited.

## Goal

Users can choose an arrowhead size for each arrow or line, using a new control in the properties panel
next to the existing arrowhead pickers. An element that doesn't set the property keeps today's size.

Before: a short arrow between two small boxes carries a head almost as big as the boxes, and the
properties panel offers no size control.
After: the properties panel shows an arrowhead size control, and the same arrow can display a small,
proportionate head.

Proposed shape (the architect may refine it): an optional `arrowheadSize` on
`ExcalidrawLinearElement`, a scale applied to the per-type size and shared by both heads. It is absent
by default, and absent means today's size. The existing short-segment shrinking and growing apply on
top of the scaled size.

## Gate 0 decisions (approved 2026-11-06)

- **Auth mode:** `vendor`. Policy `argon4-plus-flash38` (Gemini via the Antigravity worker).
- **Test command:** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
- **Property shape:** optional `arrowheadSize` on linear elements, a scale on the per-type size that
  both heads share. The panel offers Small, Medium and Large, and Medium is today's size. An arrow at
  the default size doesn't store the field, so old files and existing element snapshots stay
  unchanged.
- **New arrows: option A.** `currentItemArrowheadSize` in app state, persisted to the browser only
  (`{ browser: true, export: false, server: false }`). The control works with nothing selected. The
  only expected snapshot change is that new app-state key in `history.test.tsx.snap`,
  `contextmenu.test.tsx.snap` and `regressionTests.test.tsx.snap`. No element or render snapshot may
  change.
- **Older clients:** they render today's size and may drop the field on edit. Accepted as a non-goal.
- **`.gitignore`:** not changed (`.sdlc/` is already ignored through `.git/info/exclude`).

## Files in scope

The frozen allowlist is below. Everything else is refused by the write contract.

Element package:
- `packages/element/src/types.ts` — optional `arrowheadSize` on linear elements
- `packages/element/src/newElement.ts` — accept the option in `newArrowElement` / `newLinearElement`
- `packages/element/src/bounds.ts` — scale the head size; keep the angle, short-segment fitting and
  cardinality marker layout consistent with it
- `packages/element/src/shape.ts` — pass the element's size through head shape generation, if needed
- `packages/element/src/elbowArrow.ts` — leg checks use the element's head size
- `packages/element/src/transform.ts` — label margin uses the element's head size

Editor package:
- `packages/excalidraw/data/restore.ts` — keep a valid size, drop an invalid one, and add nothing to
  elements that lack it
- `packages/excalidraw/actions/actionProperties.tsx` — new `changeArrowheadSize` action and control
- `packages/excalidraw/actions/types.ts` — the action's name
- `packages/excalidraw/components/Actions.tsx` — render the control where the arrowhead pickers render
- `packages/excalidraw/actions/actionStyles.ts` — copy/paste styles carries the size
- `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts` — `currentItemArrowheadSize`
  default for new arrows (option A)
- `packages/excalidraw/components/App.tsx` — pass the current size when creating arrows
- `packages/excalidraw/components/icons.tsx` — icons for the size buttons
- `packages/excalidraw/locales/en.json` — control labels (English only)
- `packages/excalidraw/CHANGELOG.md` — Unreleased entry

Tests:
- `packages/element/tests/bounds.test.ts`
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (new)
- `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap`,
  `contextmenu.test.tsx.snap`, `regressionTests.test.tsx.snap` — only the new app-state key

## Files off-limits

- Project defaults (`.env*`, `.mcp.json`, `node_modules/**`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `dist/**`, `.sdlc/**`, `.git/**`)
- AI configs detected by discovery (`CLAUDE.md` and any others listed at Gate 0)
- `packages/excalidraw/locales/*.json` other than `en.json` (translations are synced externally)
- `packages/element/src/delta.ts`, `packages/excalidraw/data/reconcile.ts`, `excalidraw-app/collab/**`
  (generic over element fields; covered by tests, not edited)
- `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.github/copilot-instructions.md`, generated
  `packages/excalidraw/types/**`
- Every other snapshot file (element and render snapshots must not change)

## Acceptance criteria

1. A jsdom test shows that an arrow with a smaller `arrowheadSize` restores with the value intact and
   draws a smaller head in SVG export than the same arrow without it.
2. A jsdom test shows that an old arrow without the property restores without gaining it and draws
   today's head. Existing element and render snapshots stay unchanged; the three app-state snapshots
   gain only the `currentItemArrowheadSize` key.
3. A test shows the arrow's bounds follow the size: a larger head widens them, a smaller one narrows
   them, and the short-segment fitting still applies.
4. Changing the size from the properties panel updates the selected arrows and can be undone.
5. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals

- Separate sizes for the start and end heads.
- Changing the default size of any head type, or the existing short-segment fitting rules.
- Translations other than English.
- Making older clients understand the property. They render today's size, and an edit from an older
  client can drop it (see Gate 0 risk).
