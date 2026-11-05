# Requirements — feature-extend — Per-element arrowhead size

Run: `20261104-000000-feature-extend-arrowhead-size` · Job: `feature-extend` (delta requirements) ·
Source: `intent_brief.md` (Gate 0 final scope, approved 2026-11-04) · Upstream: excalidraw/excalidraw#6712.

## Delta summary

Today an arrowhead's size is fixed per head type (`getArrowheadSize` in `packages/element/src/bounds.ts`)
and only shrinks on short segments (the existing legible-size fitting). This change adds one optional
per-element preset, `arrowheadSize` (S / M / L, applied to both heads), a properties-panel control for it,
and an `appState.currentItemArrowheadSize` default for new elements. Absent or M renders exactly as today.

## In scope

1. A new optional property `arrowheadSize` on linear elements (arrows and lines) with three preset values
   (small, medium, large); absent equals medium.
2. Geometry, bounds and rendering (canvas and SVG export) scale the arrowhead by the preset.
3. A properties-panel control (`ButtonIconSelect`, next to the arrowhead pickers) and its action.
4. `appState.currentItemArrowheadSize`, used when new arrows/lines are created, and its storage config.
5. Restore of old files and invalid values; copy/paste styles; history and collaboration round-trip.
6. `en.json` labels, tests, snapshot updates (appState only), a CHANGELOG Unreleased entry, and a
   `.sdlc/` line appended to `.gitignore`.

## Out of scope

1. Separate start/end sizes (one size applies to both heads).
2. Changing the default (medium) head sizes or the short-segment fitting algorithm itself.
3. Locales other than `en.json` (outside the write contract; Crowdin fills them).
4. New arrowhead types; the Mermaid/skeleton public API beyond an additive optional field; `excalidraw-app/`.
5. A free numeric size or slider (presets only).

## Functional requirements

### Element model & creation (`packages/element`)

- **FR-1** `ExcalidrawLinearElement` (arrows and lines) gains an optional, readonly `arrowheadSize`
  property whose type is a new exported union of three presets (small, medium, large). The property is
  optional so elements without it remain valid.
- **FR-2** A single exported helper maps a preset (or `undefined`/`null`) to a numeric scale: medium and
  absent map to exactly `1`; small is strictly less than `1`; large is strictly greater than `1`.
- **FR-3** `newLinearElement` / `newArrowElement` accept an optional `arrowheadSize` option. When the
  option is absent or equals the default (medium), the created element carries no `arrowheadSize` key, so
  the serialized shape of default elements is byte-identical to today's (existing element snapshots do not
  change). A non-default preset is stored on the element.
- **FR-4** Every code path that creates an arrow or line from current-item state (`App.tsx`,
  `App.drawshape.ts`, `ConvertElementTypePopup.tsx`, `flowchart.ts`, `convertToShape.ts`, as applicable)
  passes `appState.currentItemArrowheadSize` (or the source element's size, when converting/duplicating
  an existing element) to the creation call.

### Geometry, bounds & rendering

- **FR-5** The arrowhead size used for drawing is `getArrowheadSize(type) × scale(element.arrowheadSize)`;
  the existing short-segment fitting is then applied to that scaled size, so the fitted size never exceeds
  the scaled size and, for medium/absent, the result is identical to today's for every head type.
- **FR-6** `getArrowheadPoints` (and any helper it uses, e.g. angle) uses the scaled size, so element
  bounds (`getElementBounds` / `getElementAbsoluteCoords` paths that include arrowheads) follow the preset.
- **FR-7** The canvas render path and the rough.js shape generation (`shape.ts`) use the same scaled
  arrowhead points, so canvas and SVG export agree; shape caching must not reuse a shape across a size
  change.
- **FR-8** Other callers of `getArrowheadSize` (`elbowArrow.ts`, `transform.ts`) keep their current
  behaviour for medium/absent; where they reserve spacing for a head on a specific element, they use the
  element's scaled size.

### Properties panel & actions (`packages/excalidraw`)

- **FR-9** A new action `changeArrowheadSize` (added to the `ActionName` union) updates `arrowheadSize`
  on every selected arrow/line (skipping other element types) and sets `appState.currentItemArrowheadSize`;
  it is recorded in history (`CaptureUpdateAction.IMMEDIATELY`).
- **FR-10** Its `PanelComponent` renders a `ButtonIconSelect` with three options (S / M / L) and a label
  from `en.json`; the selected value reflects the selected elements' common size (absent read as medium)
  or `appState.currentItemArrowheadSize` when nothing applicable is selected, following the pattern of the
  existing arrowhead/arrow-type actions.
- **FR-11** `Actions.tsx` renders the control wherever the arrowhead pickers (`changeArrowhead`) render,
  and only then.
- **FR-12** Copy/paste styles (`actionStyles.ts`) carries `arrowheadSize` between arrows/lines like it
  carries `startArrowhead`/`endArrowhead`.

### App state

- **FR-13** `AppState` gains `currentItemArrowheadSize` (the preset type), default medium in
  `getDefaultAppState`, with storage config matching the existing `currentItemStartArrowhead`
  (browser yes, export no, server no), so appState snapshots gain this field and nothing else changes.

### Restore, history, collaboration

- **FR-14** `restoreElement` keeps a valid `arrowheadSize` and drops (leaves absent) a missing or invalid
  one; it never adds the key to an element that lacked it, so restored old files are unchanged.
- **FR-15** `restoreAppState` restores `currentItemArrowheadSize`, falling back to the default for a
  missing or invalid value.
- **FR-16** Undo/redo and collaboration reconcile round-trip the property with no special casing beyond
  what the generic element delta already provides (edit `delta.ts` / `reconcile.ts` only if a test shows
  it is required). Older clients that ignore the field keep rendering today's size (property additive,
  no existing field changes meaning).

### Tests, i18n, docs, housekeeping

- **FR-17** `en.json` gains the label for the control and one string per preset; no other locale file
  changes.
- **FR-18** `API.createElement` (tests helper) accepts `arrowheadSize`.
- **FR-19** New/extended tests cover AC-1 to AC-4 (restore, SVG export, bounds, shape, action).
- **FR-20** `packages/excalidraw/CHANGELOG.md` gains an Unreleased "Features" entry; `.gitignore` gains a
  `.sdlc/` line (appended; nothing else changes).

## Non-functional requirements

- **NFR-1** Backward compatibility: element snapshots of existing tests do not change; only appState
  snapshots gain `currentItemArrowheadSize`.
- **NFR-2** Type safety: `yarn test:typecheck` passes with the repo's strict config; no `any` introduced.
- **NFR-3** Lint/format: `yarn test:code` passes.
- **NFR-4** No measurable rendering cost for medium/absent (scale 1 short-circuits to today's math).
- **NFR-5** Follow `AGENTS.md`/`CLAUDE.md` conventions (e.g. `Merge<Base, Overrides>` for type overrides).

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) — `arrowheadSize` / `currentItemArrowheadSize` are presentation presets | none | n/a |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | arrow/line element `arrowheadSize` | read, set via panel, copy/paste styles, undo/redo |
| Collaborator (any version) | scene element | receives the property; older clients ignore it |
| Viewer (view mode) | scene | renders the size; no panel control |

## Acceptance criteria

- **AC-1** jsdom test: an arrow restored with the small preset exports to SVG with an arrowhead path
  smaller than the same arrow at the default size (and large is bigger than default).
- **AC-2** jsdom test: an old arrow without the property restores with no `arrowheadSize` key and the
  default head size; existing element snapshots are unchanged; only appState snapshots gain
  `currentItemArrowheadSize`.
- **AC-3** `bounds.test.ts`: the bounds of an arrow follow the preset (small ⊂ default ⊂ large), and on a
  very short segment the fitted size never exceeds the scaled size.
- **AC-4** Test: the `changeArrowheadSize` action updates the selected arrows/lines and
  `appState.currentItemArrowheadSize`, and the panel control renders when an arrow is selected.
- **AC-5** The property is optional and additive: no existing element field changes type or meaning
  (verified by the unchanged element snapshots of AC-2 and by review).
- **AC-6** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Open questions for HITL

Resolved at Gate 1 (approved 2026-11-04): both proposals accepted — small `0.5`, medium `1`, large `1.5`;
stored as `"small" | "medium" | "large"`.

1. Exact scale factors for S and L. Proposed: small `0.5`, medium `1`, large `1.5` (architect may tune
   to keep L within existing short-segment fitting) — say so at this gate if you want other values.
2. Stored value names. Proposed: `"small" | "medium" | "large"` (panel shows S / M / L).
