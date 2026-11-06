# Requirements — feature-extend — Per-element arrowhead size

Run: `20261106-101158-feature-extend-arrowhead-size` · Intent: feature-extend (delta requirements) · HEAD `14bb42ed`

Source: `intent_brief.md` (Gate 0 approved 2026-11-06), discovery code map in `discovery.md`.

## Delta summary

Today every arrowhead type has one fixed base size (`getArrowheadSize`, `packages/element/src/bounds.ts:727-745`), shrunk only by the short-last-segment fitting (`getArrowheadPoints`, bounds.ts:1058-1087). This change adds one optional per-element size preset for both heads of a linear element, a properties-panel control for it, and an appState default so the next arrow carries the chosen size. An element without the field renders exactly as today.

## In scope

1. One optional field `arrowheadSize` on `ExcalidrawLinearElement` (arrows, elbow arrows and lines), applying to both heads.
2. Named presets `small` / `medium` / `large` in `packages/common/src/constants.ts`, each mapped to a scale factor, with `medium` = 1 (today's size). `null` or absent = today's size.
3. Scaling of head geometry: the base size, the `arrow` head angle, the cardinality/crowfoot markers, the size beyond the last segment, and the existing short-segment clamp.
4. Bounds and canvas padding that follow the scaled head.
5. Canvas and SVG rendering through the shared shape path (`shape.ts`).
6. A properties-panel `RadioSelection` control next to the arrowhead pickers, in the desktop and compact panels, shown for arrows and for lines that have at least one head.
7. A `currentItemArrowheadSize` appState default, used by every creation site that already copies `currentItemStartArrowhead`/`currentItemEndArrowhead`.
8. Restore of old and new files: validation of the field, missing or invalid = today's size.
9. Copy/paste styles carries the size.
10. Undo/redo and collaboration carry the size (through the existing element deltas).
11. en.json strings for the control (reusing `small`/`medium`/`large` where they fit).
12. Tests for geometry, restore, SVG export, hit-testing and the panel; one CHANGELOG entry under Unreleased.
13. Hit-testing (selection, hover, eraser, lasso, binding) stays consistent with the drawn head at every size (FR-21, option C chosen at Gate 1).

## Out of scope

1. Separate start and end sizes.
2. Free numeric sizes or a slider.
3. Translations other than `en.json`.
4. excalidraw.com app-only changes (`excalidraw-app/**`).
5. Changing default head sizes or the existing short-segment fitting rule itself.
6. Elbow-arrow routing changes beyond keeping head clearance consistent with the scaled size.
7. Editing generated types (`packages/excalidraw/types/**`) or any off-limits file.

## Functional requirements

### Element model (packages/element, packages/common)

- **FR-1** `ExcalidrawLinearElement` gains an optional field `arrowheadSize?: ArrowheadSize | null`, where `ArrowheadSize` is the union of the preset keys. The field is optional so older clients and existing code that builds linear elements without it keep type-checking.
- **FR-2** `packages/common/src/constants.ts` defines the preset keys (`small`, `medium`, `large`) and their scale factors in the style of `STROKE_WIDTH`, plus a helper that maps a key (or `null`/`undefined`/unknown) to a scale factor, returning `1` for anything but a known non-medium key.
- **FR-3** `getArrowheadSize` (or a new scaled wrapper used by every consumer) returns the base size multiplied by the element's scale factor. Every in-package consumer that sizes a head for a given element uses the scaled size: `getArrowheadPoints`, `getArrowheadAngle` (the `arrow` head's widening keeps its proportions at the new scale), `getCardinalityMarkerScale`, `getArrowheadSizeBeyondLastSegment`, the elbow-arrow head clearance (`elbowArrow.ts`) and the skeleton label margin (`transform.ts`) where they have the element. A consumer with no element keeps today's size.
- **FR-4** The short-segment fitting still clamps the scaled head against the last segment's length (same rule, applied to the scaled size).
- **FR-5** `newLinearElement` and `newArrowElement` accept an optional `arrowheadSize` and set it on the element only when it is given (non-undefined), so an element created without it has no `arrowheadSize` key.
- **FR-6** The skeleton transform (`transform.ts`) passes `arrowheadSize` through from an arrow/line skeleton when given.
- **FR-7** `getCanvasPadding` (`renderElement.ts`) scales the arrowhead padding for heads larger than today's, so large heads are not clipped on canvas. (The existing `endArrowhead || endArrowhead` check is corrected to `startArrowhead || endArrowhead` only if the architect judges it in scope; otherwise it is left as is.)

### Editor (packages/excalidraw)

- **FR-8** `AppState` gains `currentItemArrowheadSize: ArrowheadSize | null`, default `null` (today's size) in `getDefaultAppState`, with storage config `{ browser: true, export: false, server: false }` like the arrowhead keys.
- **FR-9** Every creation site that copies `currentItemStartArrowhead`/`currentItemEndArrowhead` also passes `currentItemArrowheadSize` (App.tsx arrow and line tools, App.drawshape.ts, ConvertElementTypePopup.tsx, convertToShape.ts, flowchart.ts where applicable). A `null` current size creates an element with no `arrowheadSize` key (FR-5).
- **FR-10** A new action `changeArrowheadSize` (added to the `ActionName` union and exported from `actions/index.ts`) sets `arrowheadSize` on every selected linear element via `newElementWith`, updates `currentItemArrowheadSize`, and records an undoable history entry (`CaptureUpdateAction.IMMEDIATELY`). Choosing `medium` stores `"medium"` (or the architect may choose to store `null`; either way it renders at today's size).
- **FR-11** The action's `PanelComponent` is a `RadioSelection` with options small / medium / large, `testId`s per option, and `getFormValue` reading the selected elements' size (falling back to `currentItemArrowheadSize`, then medium). It is rendered next to the arrowhead pickers in the desktop panel and in the compact arrow-properties popover (`Actions.tsx`, `actionChangeArrowProperties`).
- **FR-12** The control is shown when the active tool or selection can have arrowheads (`shapeActionPredicates.ts`): for arrows always, and for lines only when at least one selected line has a start or end head (or when the line tool is active with a non-null current head). The architect fixes the exact predicate.
- **FR-13** `restoreElement` keeps a valid `arrowheadSize` on line and arrow elements and drops a missing or invalid one (no key written), so restored old elements are byte-identical to today's restore output.
- **FR-14** `restoreAppState` gives `currentItemArrowheadSize` its default when missing or invalid.
- **FR-15** Copy/paste styles (`actionStyles.ts`) copies `arrowheadSize` onto pasted linear elements, as it does the arrowheads.
- **FR-16** `actionFlip` needs no swap (one size for both heads); the field is preserved through flips.
- **FR-17** `locales/en.json` gains the control's label (e.g. `labels.arrowheadSize`) and reuses existing `small`/`medium`/`large` strings for the options.
- **FR-18** History and collaboration carry the field through the existing generic element deltas; `delta.ts` changes only if the architect finds the field needs explicit handling.
- **FR-19** The test helper `API.createElement` (`tests/helpers/api.ts`) passes `arrowheadSize` through for arrows and lines.
- **FR-20** `CHANGELOG.md` gains one entry under Unreleased describing the feature.

### Hit-testing (added at Gate 1 revise)

- **FR-21** Hit-testing of a linear element stays consistent with its drawn head at every size. Today a linear element is hit-tested in two steps (discovery at HEAD `14bb42ed`):
  1. a pre-check against `getElementBounds` (`collision.ts:183`, `hitElementItself`), whose linear bounds come from the shaft curve only (`bounds.ts:1189+`, `getLinearElementRotatedBounds`, `ShapeCache.get(element)?.[0]`);
  2. a precise test, `distanceToElement` → `deconstructLinearOrFreeDrawElement` (`utils.ts:129`) → `generateLinearCollisionShape` (`shape.ts:678`), which builds the shaft only and reads no arrowhead geometry; its cache (`ElementShapesCache`, `utils.ts:73`) is keyed on element version.

  The requirement is:
  - **FR-21a** At `medium`, `null` or no field, every hit-test result (`hitElementItself`, `getElementAtPosition`, eraser, lasso, the binding hover in `binding.ts`) is identical to HEAD.
  - **FR-21b** (option C, chosen at Gate 1 revise) Element bounds grow with `arrowheadSize` **only when its factor is above 1** (`large`): `getElementBounds` then includes the drawn heads' extent (the same `getArrowheadPoints` geometry the renderer draws). At `small` (factor below 1) the bounds are unchanged from HEAD. So at `large`, everything that reads the element's bounds follows the drawn head: the bounding-box hit of a selected linear element (`hitElementBoundingBox`, `collision.ts:250-258`, via `App.tsx:6133` and `hyperlink/helpers.ts:195`), the lasso's contain mode (`lasso/utils.ts:93-108`), and box selection (`elementsOverlappingBBox`, `bounds.ts`). This is an accepted behaviour change at `large` only. The precise outline test (`distanceToElement` → `generateLinearCollisionShape`) stays shaft-only at every size; heads do not become hittable by the precise test.
  - **FR-21c** Changing an element's `arrowheadSize` bumps its version (`newElementWith`), so the bounds cache, `ShapeCache` and `ElementShapesCache` never serve a hit shape computed for the old size.
  - **FR-21d** At `large`, the widened bounds widen the `hitElementItself` pre-check together with the drawn head, so the pre-check never rejects a point the precise test would hit. Other readers of `getElementBounds` follow at `large` too (align/distribute, the multi-selection box, frame containment, export size); this is accepted with option C. Any place that would then disagree with the bounds (for example the selected element's drawn selection border, which reads `LinearElementEditor.getElementAbsoluteCoords`, shaft-only, `linearElementEditor.ts:2267-2272` / `interactiveScene.ts:1916`) is named by the architect, with whether it must change.
  - **FR-21e** Only the allowlisted files may change. `collision.ts`, `distance.ts`, `utils.ts`, `linearElementEditor.ts`, `lasso/utils.ts` and `renderer/interactiveScene.ts` are **not on the write contract's allowlist**. If option C needs a change in any file outside the allowlist (including one needed to keep the bounds and the drawn head or selection box in agreement), the run stops before any spec section is submitted and asks the person; widening the scope is the person's decision, for a new run with its own Gate 0.

## Non-functional requirements

- **NFR-1** Backward compatibility: an element without `arrowheadSize` (or with `null`/`medium`) produces geometry, bounds, canvas and SVG output identical to HEAD `14bb42ed`.
- **NFR-2** Snapshot stability: existing element and geometry snapshots stay unchanged. Only snapshots that capture appState gain the `currentItemArrowheadSize` key.
- **NFR-3** Forward/backward collaboration: the field is optional; older clients ignore it and render today's size.
- **NFR-4** Type safety: `yarn test:typecheck` passes under the repo's strict TypeScript config; no `any` introduced.
- **NFR-5** Repo conventions: follow AGENTS.md (`Merge<>` over `Omit<>&`, `app.ownerDocument`/`ownerWindow` for any new DOM API) and copilot-instructions (terse, readonly, `?.`/`??`).
- **NFR-6** Performance: no extra shape-cache invalidation beyond the version bump `newElementWith` already causes, and no new per-hit-test allocation on the bounds pre-check's miss path (`collision.ts:194-198` bails out early on 99% of points).

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | The change adds a rendering preset; no personal data is read, stored or sent. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Selected linear elements | Set arrowhead size (undoable) |
| Editor user | AppState `currentItemArrowheadSize` | Set via the panel; persisted to browser storage only |
| Collaborator (any version) | Shared element | Receives the field; older versions ignore it |
| Embedding host (library API) | Element skeleton / `updateScene` | May pass `arrowheadSize` |

## Acceptance criteria

- **AC-1** In jsdom tests, an arrow with `arrowheadSize: "small"` restores with the field kept, and its SVG export renders a smaller head than the same arrow without the field (head path extent measurably smaller).
- **AC-2** An old arrow without the field restores to today's size: `restoreElement` writes no `arrowheadSize` key, and `getArrowheadPoints` returns the same points as for HEAD. Existing element and geometry snapshots stay unchanged; only appState snapshots gain the new key.
- **AC-3** Element bounds follow the size: a `large` head yields larger element bounds than the default for the same arrow, and on a short last segment the head is still clamped by the fitting rule.
- **AC-4** The properties panel shows the size control for arrows and for lines with heads (not for lines without heads). Changing it updates every selected element's `arrowheadSize` and `currentItemArrowheadSize`, and undo restores the previous size.
- **AC-5** Saved files without the property, and elements received from older collaborators, render identically to today (covered by AC-2 and NFR-1 tests); the type stays optional.
- **AC-6** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` all pass from the repo root.
- **AC-7** Hit-testing follows FR-21, checked in jsdom tests (`packages/element/tests/arrowheadSize.test.ts` or `packages/excalidraw/tests/arrowheadSize.test.tsx`): at `small`, `medium` and with no field, `getElementBounds` and `hitElementItself` give the same results as HEAD for points on the shaft, just off it, and on the head. At `large`, `getElementBounds` contains the drawn head's points (`getArrowheadPoints`), `hitElementItself` still hits the shaft and misses a point that is off the shaft and outside the widened bounds, and a box selection that encloses the shaft but not a large head no longer selects the arrow. After `changeArrowheadSize` on a selected arrow, the bounds and hits use the new size, with no stale cached shape.

## Assumptions

- `medium` scale is exactly `1`; `small` and `large` factors (e.g. 0.6 and 1.5) are the architect's to fix in the spec's decisions.
- `currentItemArrowheadSize` defaults to `null` so element snapshots of newly drawn arrows stay unchanged (NFR-2).
- Hit-testing code outside the allowlist (`collision.ts`, `distance.ts`, `utils.ts`, `lasso/utils.ts`) is expected to need no change under option C, because it reads `getElementBounds` from `bounds.ts`; FR-21e covers the case where it does.
- Snapshot files under `**/__snapshots__/*.snap` that capture appState are regenerated by the project's own `vitest --update`, not typed by hand.

## Open questions for HITL

None open.

## Decisions settled after Gate 1

- **Bounds (open question 1, settled by the person at Gate 1 revise: option C).** At HEAD, linear-element bounds and the precise hit shape are the shaft only (architect, Phase 2 first pass: `bounds.ts:1223-1226`, `linearElementEditor.ts:2267-2272`, `shape.ts:678`, `shape.ts:1184`). With option C, bounds grow with the drawn head only when the factor is above 1 (`large`); AC-3 stands as the brief wrote it; FR-21b is loosened so that at `large` box hits, the contain lasso and box selection follow the drawn head.
- **Presets:** small 0.6, medium 1, large 1.5. Picking `medium` stores `"medium"`.
- **Canvas padding:** the `endArrowhead || endArrowhead` typo in `getCanvasPadding` is fixed, and the padding is scaled by the factor when it is above 1.
- **`delta.ts`:** no change (the generic key diff carries the field; deltas apply through `newElementWith`).
- **Panel predicate:** the control shows for arrows, for lines with at least one head, or when the arrow tool is active.
- **Snapshots that change:** the five appState `.snap` files (contextmenu, history, regressionTests and the two `utils.test.ts.snap`).
