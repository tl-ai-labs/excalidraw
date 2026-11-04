# Intent Brief — feature-extend — Per-element arrowhead size

## Context

Arrowheads on arrows and lines have a fixed size per head type: `getArrowheadSize` in
`packages/element/src/bounds.ts` returns arrow 25, diamond 12, cardinality 15/20, and 15 otherwise.
The size only shrinks automatically on very short segments (the existing short-segment fitting in
`getArrowheadPoints`). Requested upstream in excalidraw/excalidraw#6712.

Before: a short arrow between two small boxes carries a head almost as big as the boxes, and the
properties panel offers no size control.

## Goal

Add an optional per-element arrowhead size on linear elements (arrows and lines), set from a new
control in the properties panel, with a default equal to today's size.

Proposed design (the user may override at Gate 0):

- **Property:** `arrowheadSize?: "small" | "medium" | "large"` on `ExcalidrawLinearElement`.
  It is a scale factor on today's per-type base size: small 0.5, medium 1, large 1.5. Absent means
  medium, which is exactly today's size.
- **Scope:** one size shared by the start and end heads.
- **Absent stays absent:** `newElement`/`restore` do not write the field when it is unset, so old
  files and existing snapshots keep the same element shape. `restore` drops invalid values.
  The panel writes it only when the user changes it.
- **No new AppState field:** the control acts on selected arrows/lines only and newly drawn arrows
  use the default. This keeps app-state snapshots and collab payloads unchanged. Adding a
  `currentItemArrowheadSize` ("remember for the next arrow") is out of scope unless requested at Gate 0.
- **Geometry:** `getArrowheadSize` (or its callers in `getArrowheadPoints`) multiplies by the
  element's scale before the existing short-segment fitting runs, so the fitting still caps the head
  on short segments. Bounds (`bounds.ts`), hit-testing and shapes (`shape.ts`), canvas padding
  (`renderElement.ts#getCanvasPadding`), SVG/PNG export and the elbow-arrow/binding/label-margin
  callers all go through the same scaled size.
- **Canvas padding:** `getCanvasPadding` today checks `endArrowhead || endArrowhead` (a typo that
  ignores the start head) and uses a fixed 40px. Fix both so large heads are not clipped.
- **Collab/history:** older clients ignore the unknown optional field and render today's size.
  `mutateElement`/`newElementWith` changes go through the existing version bump so history
  deltas and reconciliation carry the field.
- **Properties panel:** `actionChangeArrowheadSize` in `actionProperties.tsx`, a 3-button
  ButtonIconSelect like stroke width. It is rendered in `components/Actions.tsx` next to the arrowhead pickers
  when a selected element has an arrowhead. It is registered in `actions/types.ts`, included in copy/paste
  styles (`actionStyles.ts`), and has labels in `locales/en.json`.
- AGENTS.md conventions: `Merge<Base, Overrides>` over `Omit & ...`, and `app.ownerDocument` over DOM globals.

## Files in scope

- `packages/element/src/types.ts`: new `ArrowheadSize` type and optional field on linear elements
- `packages/element/src/bounds.ts`: scaled `getArrowheadSize` / `getArrowheadPoints`
- `packages/element/src/shape.ts`: arrowhead shapes use the scaled size
- `packages/element/src/renderElement.ts`: `getCanvasPadding` fix and scaling
- `packages/element/src/newElement.ts`: accept the optional field
- `packages/element/src/elbowArrow.ts`, `packages/element/src/binding.ts`, `packages/element/src/transform.ts`: callers of `getArrowheadSize`
- `packages/element/src/index.ts`: export new type/helpers if needed
- `packages/common/src/constants.ts`: size presets / scale constants
- `packages/excalidraw/data/restore.ts`: validate the field, absent stays absent
- `packages/excalidraw/actions/actionProperties.tsx`: new action
- `packages/excalidraw/actions/types.ts`: action name
- `packages/excalidraw/actions/actionStyles.ts`: copy/paste styles
- `packages/excalidraw/components/Actions.tsx`: render the control
- `packages/excalidraw/components/icons.tsx`: icons for the control, if needed
- `packages/excalidraw/locales/en.json`: labels
- `packages/excalidraw/tests/helpers/api.ts`: allow the field in test element factories
- Tests, new or extended:
  - `packages/element/tests/bounds.test.ts`
  - `packages/element/tests/shape.test.ts`
  - `packages/element/tests/newElement.test.ts`
  - `packages/excalidraw/tests/data/restore.test.ts`
  - a new jsdom test `packages/excalidraw/tests/arrowheadSize.test.tsx` (panel control, SVG export, bounds)
- Snapshot files under `packages/element/tests/__snapshots__/**` and `packages/excalidraw/tests/**/__snapshots__/**`: allowed only for additions from new tests; existing snapshots must stay unchanged.

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs: `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.github/copilot-instructions.md`
- Generated/other: `packages/excalidraw/types/**`, `dev-dist/**`, `coverage/**`
- Non-English locale files (`packages/excalidraw/locales/*.json` other than `en.json`), which are managed by Crowdin
- `excalidraw-app/**`

## Acceptance criteria

1. A jsdom test shows that an arrow with `arrowheadSize: "small"` survives restore and renders a smaller
   head in SVG export than the same arrow without the property.
2. An old arrow without the property restores to today's size, without the field being added,
   and every existing snapshot is unchanged.
3. Element bounds follow the size: large is wider than default, which is wider than small. Short-segment
   fitting still caps the head.
4. The properties panel shows the arrowhead size control for a selected arrow or line with an
   arrowhead. Picking a size updates the element and is undoable.
5. Canvas padding accounts for the start head and for large heads.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals

- Independent start/end sizes.
- A "remember for next arrow" AppState default (`currentItemArrowheadSize`).
- Free numeric sizing or a slider.
- Translations other than `en.json`.
- Changes to `excalidraw-app/`.
- Changing the default head size of any arrowhead type.

## Gate 0 decisions (approved 2026-11-04)

- Design defaults above approved as proposed.
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (no `test:update`).
- Auth mode: estimated. Policy: opus55-plus-sonnet55.
- `.gitignore`: not modified. Note in the final report that `.sdlc/` is not in `.gitignore`.
- Write contract frozen with the allowlist and off-limits listed above. Non-English locales are blocked because they are not in the allowlist.
