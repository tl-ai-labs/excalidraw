# Intent Brief — feature-extend — Per-element arrowhead size

## Context

Module: arrowheads on arrows and lines. Today the size is fixed per head type
(`getArrowheadSize` in `packages/element/src/bounds.ts`: 25 for `arrow`, 12 for diamonds,
15 default, constants for cardinality markers) and only shrinks automatically on very short
segments (`getArrowheadPoints` → `lengthMultiplier` / `getArrowheadSizeBeyondLastSegment`).
Requested in excalidraw/excalidraw#6712.

Before: a short arrow between two small boxes carries a head almost as big as the boxes, and
the properties panel offers no size control.

## Goal

An optional per-element arrowhead size, set from a control in the properties panel, with a
default.

After: the properties panel shows an arrowhead size control and the same arrow displays a
small, proportionate head.

Proposed shape (confirm at Gate 0):
- One optional property on linear elements, `arrowheadSize?: number`, a multiplier applied to
  both heads. `undefined` means 1 (today's size). Both start and end heads use it.
- The panel control is a preset button group (small / medium / large → 0.5 / 1 / 1.5, for
  example), shown for arrows and lines that have at least one arrowhead (`canHaveArrowheads`).
  It writes the multiplier to the selected elements.
- The size scales the base size from `getArrowheadSize`. Short-segment fitting still
  caps it (fitting is applied after scaling), so bounds, hit-testing (`ShapeCache`) and
  export stay consistent.
- Default: `arrowheadSize` stays omitted on newly created elements, so serialized output and
  snapshots don't change. An optional `appState.currentItemArrowheadSize` is a Gate 0 decision
  (see below).

## Files in scope

Element package:
- `packages/element/src/types.ts`: the `arrowheadSize` property on `ExcalidrawLinearElement`.
- `packages/element/src/bounds.ts`: head geometry and size scaling (`getArrowheadSize` callers,
  `getArrowheadPoints`, `getArrowheadSizeBeyondLastSegment`, `getArrowheadAngle`) and bounds.
- `packages/element/src/shape.ts`: head drawables for canvas, SVG and hit-test.
- `packages/element/src/renderElement.ts`: `getCanvasPadding` gives arrows with heads a fixed
  40px canvas padding sized for today's heads, so larger presets would be clipped on the
  canvas. The padding must follow the scaled head size. Two gaps nearby: line 113 checks
  `endArrowhead` twice, so arrows with only a start head get 20px, and `line` elements with
  arrowheads fall through to the default 20px.
- `packages/element/src/newElement.ts`: creation opts passthrough.
- `packages/element/src/transform.ts`: skeleton API passthrough.
- `packages/element/src/elbowArrow.ts`: only if its arrowhead gap must follow the size.
- `packages/element/src/delta.ts`: only if history deltas need the new key handled explicitly.

Editor package:
- `packages/excalidraw/data/restore.ts`: restore the property, keep it absent or validate it, and
  drop invalid values.
- `packages/excalidraw/actions/actionProperties.tsx` and `packages/excalidraw/actions/types.ts`:
  a new `changeArrowheadSize` action.
- `packages/excalidraw/actions/actionStyles.ts`: paste styles carries the size.
- `packages/excalidraw/components/Actions.tsx` and
  `packages/excalidraw/components/shapeActionPredicates.ts`: panel placement, desktop and
  compact.
- `packages/excalidraw/components/icons.tsx`: only if the preset buttons need icons.
- `packages/excalidraw/locales/en.json`: the label and option names.
- `packages/excalidraw/appState.ts` and `packages/excalidraw/types.ts`: only if Gate 0 picks
  remembering the last-used size.

Tests:
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/scene/export.test.ts`
- `packages/element/tests/bounds.test.ts`
- `packages/element/tests/shape.test.ts`
- `packages/excalidraw/actions/actionProperties.test.tsx`
- New test files beside these as needed.

Companion files:
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`: lists arrow
  element properties.
- `packages/excalidraw/CHANGELOG.md`: an Unreleased entry.

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`,
  `.sdlc/**`, `.git/**`.
- AI configs: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`.
- Generated: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`,
  `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/*/types/**`, `yarn.lock`.
- Existing snapshot files (`**/__snapshots__/**`): the acceptance criteria require them
  unchanged.
- Locales other than `en.json` (translations come through Crowdin).

## Acceptance criteria

1. A jsdom test restores an arrow that has the new size and shows that SVG export renders a
   smaller head than at the default size.
2. An old arrow without the property restores to today's size, and existing snapshots stay
   unchanged.
3. Element bounds follow the size, and short-segment fitting still caps the head.
4. The properties-panel control appears for arrows and lines with arrowheads and updates the
   selected elements, which can be undone and redone through history.
5. Collaborators on older versions and files without the property render identically. The
   property is optional and absent by default.
6. Canvas rendering doesn't clip the largest preset. The per-element canvas padding
   (`getCanvasPadding`) covers the scaled head at either end, for arrows and for lines with
   arrowheads.
7. The run's test command passes, run exactly as one command:
   `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`

## Non-goals

- Separate start and end sizes.
- Changing the automatic short-segment shrinking algorithm itself.
- Per-type default sizes other than today's.
- Translations beyond `en.json`.
- Any change to `excalidraw-app/` collaboration code. Reconciliation is version-based and
  carries element properties generically.

## Gate 0 — final (approved 2026-11-05)

- Auth mode: `estimated`. Policy: `argon4-plus-sonnet55`.
- Test command (run exactly, as one command):
  `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Design decisions confirmed:
  - (a) Presets small / medium / large, stored as a multiplier.
  - (b) A single `arrowheadSize` property for both heads.
  - (c) No `currentItemArrowheadSize` in appState, so `packages/excalidraw/appState.ts` and
    `packages/excalidraw/types.ts` are out of scope.
- `.gitignore`: not changed. `.sdlc/` is already ignored through `.git/info/exclude`.
- Write contract frozen. Allowlist: the in-scope files above, plus
  `packages/excalidraw/tests/helpers/api.ts` and the test globs `packages/element/tests/*.test.ts(x)`,
  `packages/excalidraw/actions/*.test.tsx`, `packages/excalidraw/tests/data/*.test.ts` and
  `packages/excalidraw/tests/scene/*.test.ts`. Snapshots are off-limits.
