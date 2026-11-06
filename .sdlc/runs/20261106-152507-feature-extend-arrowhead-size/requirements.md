# Requirements — Per-element Arrowhead Size (Delta Specification)

- **Run ID:** `20261106-152507-feature-extend-arrowhead-size`
- **Mode:** `brownfield`
- **Intent:** `feature-extend`

This document specifies only the delta changes to the existing Excalidraw editor to support configurable per-element arrowhead sizes on linear elements (`arrow` and `line`).

---

## In scope

1. **Element data model & construction (`packages/element/src/types.ts`, `packages/element/src/newElement.ts`):** Add an optional `arrowheadSize` scale factor to `ExcalidrawLinearElement` (shared by `startArrowhead` and `endArrowhead`), accepted by `newLinearElement` and `newArrowElement`, and omitted (absent, not `1` or `undefined` own key) when at the default Medium size.
2. **Scene & element restoration (`packages/excalidraw/data/restore.ts`):** Preserve valid non-default `arrowheadSize` values on restored `line` and `arrow` elements, strip invalid or default (`1`) `arrowheadSize` values, and never add `arrowheadSize` to elements that omit it. Coalesce and validate `currentItemArrowheadSize` in `restoreAppState`.
3. **Arrowhead geometry & rendering (`packages/element/src/bounds.ts`, `packages/element/src/shape.ts`):** Scale the per-type base arrowhead size in `getArrowheadSize`, `getArrowheadAngle`, `getCardinalityMarkerScale`, `getArrowheadSizeBeyondLastSegment`, and `getArrowheadPoints` so both canvas and SVG rendering (`getArrowheadShapes` → `getArrowheadPoints`) draw scaled arrowheads while preserving short-segment shrinking/growing and composite cardinality marker proportions.
4. **Elbow routing & skeleton label clearance (`packages/element/src/elbowArrow.ts`, `packages/element/src/transform.ts`):** Scale the arrowhead size read by elbow-arrow minimum leg checks (`elbowArrow.ts` around L1490–1500) and skeleton-to-element bound label margin clamping (`packages/element/src/transform.ts` `clampLabelPositionOffEnds` around L662), keeping default-size behavior byte-identical.
5. **Properties panel UI, action & app state (`packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`, `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/icons.tsx`, `packages/excalidraw/locales/en.json`, `packages/excalidraw/CHANGELOG.md`):** Add `actionChangeArrowheadSize` offering Small, Medium, and Large presets (Medium = default `1`) rendered alongside `actionChangeArrowhead`, backed by browser-persisted `currentItemArrowheadSize` in `AppState` (Option A) that applies when creating new arrows and works when no element is selected.
6. **Copy / paste styles (`packages/excalidraw/actions/actionStyles.ts`):** Copy and paste `arrowheadSize` between arrows (including clearing a non-default `arrowheadSize` when pasting from a default-sized arrow and re-routing elbow arrows).
7. **Automated unit & integration tests (`packages/element/tests/bounds.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/arrowheadSize.test.tsx`, and the 3 permitted app-state snapshots):** Verify geometry, short-segment fitting, restore sanitization, SVG export head size, UI property changes, copy/paste styles, undo/redo (`delta.ts`), and collaboration reconciliation (`reconcile.ts`).

---

## Out of scope

1. Independent arrowhead sizes for `startArrowhead` vs. `endArrowhead` on the same element (both heads share `arrowheadSize`).
2. Changing the default (Medium) pixel size of any arrowhead type or altering existing short-segment shrinking/growing rules for default-sized arrows.
3. Modifying `getElementBounds` / `getLinearElementRotatedBounds` to include arrowhead outlines in element bounding boxes (linear element bounding boxes continue to derive from `shape[0]` shaft geometry so existing element and render snapshots remain unchanged. The size does not change the existing short-segment fitting, so a head's extent along the shaft stays on the shaft. Only its sideways extent can go past the shaft's bounding box, and that is already true at today's sizes).
4. Editing `packages/element/src/delta.ts`, `packages/excalidraw/data/reconcile.ts`, or `excalidraw-app/collab/**` (these modules operate generically over element fields and `version`/`versionNonce`; undo/redo and collaboration sync are verified via tests only).
5. Locale translations outside `packages/excalidraw/locales/en.json`.
6. Backward-compatible rendering of `arrowheadSize` in older Excalidraw client versions: `restoreElementWithProperties` in `packages/excalidraw/data/restore.ts` spreads unknown element fields (`...element`) for forward compatibility, so older clients keep `arrowheadSize` through restore and edits and draw the head at today's size.
7. Modifying `.gitignore`, AI configuration files, or any snapshot file other than `history.test.tsx.snap`, `contextmenu.test.tsx.snap`, and `regressionTests.test.tsx.snap`.
8. **Known limit (export padding):** Exported images frame the shafts plus the 10px export padding, so wide heads can be cropped at the image edge. Some heads already reach past the padding at today's size: bar 15px, cardinality-one markers 20px. At 1.5x the arrow head reaches 12.8px sideways, bar 22.5px and cardinality-one markers 30px. This run does not fix that.

---

## Functional requirements per module

### Area 1: Element model + restore

- **FR-1 (`packages/element/src/types.ts` — Linear element property):**
  `ExcalidrawLinearElement` MUST declare an optional `arrowheadSize?: ArrowheadSize` (number scale factor) shared by both `startArrowhead` and `endArrowhead`. Three presets MUST be supported: Small = `0.5`, Medium = `1` (the default, today's size, omitted from elements), and Large = `1.5` (Large is capped at 1.5x). The supported range is finite numbers in `[0.5, 1.5]` inclusive.
- **FR-2 (`packages/element/src/newElement.ts` — Omission of default field on construction):**
  `newLinearElement` and `newArrowElement` MUST accept an optional `arrowheadSize` in `opts`. When `opts.arrowheadSize` is omitted, `undefined`, or equal to the default Medium scale (`1`), the returned element object MUST NOT have an `"arrowheadSize"` own property (`!("arrowheadSize" in element)`). When a valid non-default scale is provided, `element.arrowheadSize` MUST be set to that scale.
- **FR-3 (`packages/excalidraw/data/restore.ts` — Element restoration & sanitization):**
  In `restoreElement` (`case "line"` and `case "arrow"`, around L630–737), because `restoreElementWithProperties` spreads `...element`, restoration MUST explicitly validate `element.arrowheadSize` against the supported range of finite numbers in `[0.5, 1.5]` inclusive:
  - If `element.arrowheadSize` is a finite number in `[0.5, 1.5]` inclusive other than `1`, retain `arrowheadSize` on the restored element.
  - If `element.arrowheadSize` is absent, `undefined`, equal to the default (`1`), out of range (`< 0.5` or `> 1.5`), or invalid (e.g., `null`, non-number, `NaN`, non-finite, `<= 0`), delete/omit the `"arrowheadSize"` key from the restored element so that legacy and default-sized elements never carry an `arrowheadSize` property.
- **FR-4 (`packages/excalidraw/data/restore.ts` — AppState restoration):**
  `restoreAppState` MUST validate `currentItemArrowheadSize` against the supported range of finite numbers in `[0.5, 1.5]` inclusive, keeping any in-range value and falling back to `1` (Medium) when it is missing or outside `[0.5, 1.5]`.

### Area 2: Geometry / rendering

- **FR-5 (`packages/element/src/bounds.ts` — Base size scaling):**
  `getArrowheadSize(arrowhead: Arrowhead, scale = 1): number` MUST multiply the per-type base pixel size (`25` for `"arrow"`, `12` for `"diamond"`/`"diamond_outline"`, `15` for `"cardinality_many"`/`"cardinality_one_or_many"`/`"cardinality_zero_or_many"`, `20` for `"cardinality_one"`/`"cardinality_exactly_one"`/`"cardinality_zero_or_one"`, `15` otherwise) by `scale`. When `scale` is omitted or `1`, the return value MUST be byte-identical to today's result.
- **FR-6 (`packages/element/src/bounds.ts` — Angle, short-segment fitting & cardinality marker scaling):**
  `getArrowheadPoints(element, shape, position, arrowhead, offsetMultiplier)` and its helpers in `packages/element/src/bounds.ts` MUST apply `element.arrowheadSize ?? 1` consistently:
  - Target head size is `size = getArrowheadSize(arrowhead, scale)`.
  - Short-segment shrinking (`Math.min(size, length * lengthMultiplier)`) and growing past a short last segment (`getArrowheadSizeBeyondLastSegment(element, position, arrowhead)`) operate relative to the scaled target size:
    - In `getCardinalityMarkerScale`, part sizes (`"cardinality_one"`, `"cardinality_many"`, `"circle_outline"`) are scaled by `scale` so composite cardinality markers fit the last segment and keep their relative part proportions at every `arrowheadSize`.
    - In `getArrowheadSizeBeyondLastSegment` for `"arrow"`, `legibleSize` scales with `getArrowheadSize(arrowhead, scale) / 2`, and `getArrowheadAngle` MUST compare the drawn size against the SCALED full size (`getArrowheadSize(arrowhead, scale)` vs. drawn `minSize`); if it compared against the unscaled 25px, Small (`0.5`) would widen to about 28 degrees.
- **FR-7 (`packages/element/src/shape.ts` — Canvas & SVG shape generation):**
  `getArrowheadShapes` (called by `_generateElementShape` for `element.type === "arrow"`) draws all arrowhead types through `getArrowheadPoints(element, shape, position, ...)`. Because both canvas (`drawElementOnCanvas`) and SVG export (`renderElementToSvg`) render the `Drawable[]` produced by `ShapeCache.generateElementShape`, scaling in `getArrowheadPoints` (and any shape helper in `shape.ts` if needed) MUST produce smaller/larger arrowhead paths in both canvas and SVG export without altering default-size output.
- **FR-8 (`packages/element/src/elbowArrow.ts` & `packages/element/src/transform.ts` — Elbow leg check & skeleton label margin):**
  **Decision:** Both secondary readers of `getArrowheadSize` MUST follow `arrow.arrowheadSize`:
  - In `packages/element/src/elbowArrow.ts` (around L1490–1500), the minimum first/last leg check MUST pass `arrow.arrowheadSize` to `getArrowheadSize(arrow.startArrowhead, arrow.arrowheadSize)` and `getArrowheadSize(arrow.endArrowhead, arrow.arrowheadSize)`.
  - In `packages/element/src/transform.ts` (`clampLabelPositionOffEnds` around L662, verified at `packages/element/src/transform.ts` rather than `packages/excalidraw/data/transform.ts`), the endpoint arrowhead clearance margin MUST pass `arrow.arrowheadSize` to `getArrowheadSize(arrowhead, arrow.arrowheadSize)`.
  - When `arrow.arrowheadSize` is absent (`undefined`), both readers MUST produce byte-identical results to today.

### Area 3: UI / actions / app state

- **FR-9 (`packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts` — `currentItemArrowheadSize` in AppState):**
  Add `currentItemArrowheadSize` to `AppState` (defaulting to Medium / `1` in `getDefaultAppState()`) and configure it in `APP_STATE_STORAGE_CONF` with `{ browser: true, export: false, server: false }` (Gate 0 Option A).
- **FR-10 (`packages/excalidraw/actions/types.ts`, `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/components/icons.tsx`, `packages/excalidraw/locales/en.json` — `changeArrowheadSize` action & control):**
  Register `actionChangeArrowheadSize` (`name: "changeArrowheadSize"`) in `actionProperties.tsx`:
  - **PanelComponent:** Render a `<fieldset>` with localized legend (`t("labels.arrowheadSize")`) and a `RadioSelection` button list offering Small (`0.5`, `t("labels.small")`), Medium (`1`, `t("labels.medium")`), and Large (`1.5`, `t("labels.large")`) with dedicated icons from `packages/excalidraw/components/icons.tsx`. Use `getFormValue` so the control reflects `element.arrowheadSize ?? DEFAULT_ARROWHEAD_SIZE` for selected linear elements that can have arrowheads, or `appState.currentItemArrowheadSize` when nothing is selected.
  - **perform:** Update selected linear elements (where `isLinearElement(el)`) and update `appState.currentItemArrowheadSize` with `CaptureUpdateAction.IMMEDIATELY`. When setting Medium (default), the `"arrowheadSize"` property MUST be removed from the element (ensuring `newElementWith` bumps `version`/`versionNonce` via `force` when clearing a previously set `arrowheadSize` and deletes the own key). When an updated element is an elbow arrow (`isElbowArrow`), recompute its route via `updateElbowArrowRoute`.
- **FR-11 (`packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/actions/actionProperties.tsx` — Control placement):**
  Render `renderAction("changeArrowheadSize")` where `renderAction("changeArrowhead")` is rendered:
  - In `SelectedShapeActions` (`packages/excalidraw/components/Actions.tsx` around L189) gated by `predicates.arrowheads` (which is true when the arrow tool is active with no selection or when an arrow is selected).
  - In `actionChangeArrowProperties` (`packages/excalidraw/actions/actionProperties.tsx` around L2070) so the compact/mobile arrow properties popover also exposes the control.
- **FR-12 (`packages/excalidraw/components/App.tsx` — New arrow creation from AppState):**
  In `packages/excalidraw/components/App.tsx` (around L8626–8660), when creating a new arrow with `newArrowElement`, pass `arrowheadSize: this.state.currentItemArrowheadSize` so newly drawn arrows inherit the active size preset (and omit the field on the element when `currentItemArrowheadSize` is Medium).
- **FR-13 (`packages/excalidraw/CHANGELOG.md` — Changelog entry):**
  Add an entry under `## Unreleased` in `packages/excalidraw/CHANGELOG.md` documenting per-element arrowhead size.

### Area 4: Copy-styles

- **FR-14 (`packages/excalidraw/actions/actionStyles.ts` — Copy and paste styles):**
  In `actionPasteStyles` (around L185–202), when pasting styles from a copied arrow onto a target arrow (`newElement.type === "arrow" && isArrowElement(elementStylesToCopyFrom)`):
  - Copy `elementStylesToCopyFrom.arrowheadSize` onto `newElement` if set, or remove `arrowheadSize` from `newElement` if `elementStylesToCopyFrom` is at the default size (absent `arrowheadSize`).
  - Existing `updateElbowArrowRoute` invocation on `isElbowArrow(newElement)` (L193–201) runs after applying `arrowheadSize`.

### Area 5: Tests

- **FR-15 (`packages/element/tests/bounds.test.ts` — Geometry & fitting tests):**
  Add unit tests testing head geometry from `getArrowheadPoints` (not the element's bounding box):
  - On a long straight last segment (long enough that no head is shortened), each head type's sideways half-width at scale `s` (`0.5` and `1.5`) equals `s` times its half-width at scale `1`, within float tolerance, and the head angle does not change with the scale when the head is not shortened.
  - Explicit regression test: an `"arrow"` head at Small (`0.5`) stays at 20 degrees.
  - Short-segment shrinking and `getArrowheadSizeBeyondLastSegment` (including `getCardinalityMarkerScale` proportional part scaling and `"arrow"` angle widening) continue to hold for non-default `arrowheadSize`.
- **FR-16 (`packages/excalidraw/tests/data/restore.test.ts` — Restore tests):**
  Add unit tests verifying:
  - An arrow/line with an in-range non-default `arrowheadSize` in `[0.5, 1.5]` (e.g., `0.5`, `0.75`, `1.5`) restores with `arrowheadSize` intact.
  - An old arrow/line without `arrowheadSize` restores without gaining an `"arrowheadSize"` property (`"arrowheadSize" in restored === false`).
  - An arrow/line with an out-of-range value (e.g., `0.4`, `1.6`), default `1`, or invalid `arrowheadSize` (e.g., `0`, `-1`, `NaN`, `"large"`, `null`) has `"arrowheadSize"` stripped on restore, and `restoreAppState` falls back to `1` when `currentItemArrowheadSize` is missing or outside `[0.5, 1.5]`.
- **FR-17 (`packages/excalidraw/tests/arrowheadSize.test.tsx` — End-to-end feature tests):**
  Create `packages/excalidraw/tests/arrowheadSize.test.tsx` covering:
  - Restoring an arrow with a smaller `arrowheadSize` and exporting to SVG produces smaller arrowhead path geometry than the same arrow at default size, while an old arrow without the property exports identical SVG head geometry to today.
  - Changing arrowhead size via the properties panel updates selected arrows, sets `currentItemArrowheadSize` when nothing is selected so subsequent arrows use that size, and removes the field when switched back to Medium.
  - Undo and redo of `changeArrowheadSize` (exercising `packages/element/src/delta.ts` without modifying it).
  - Copy/paste styles (`actionCopyStyles` / `actionPasteStyles`) transfers `arrowheadSize` (and resets to default when pasting from a default-sized arrow).
  - Collaboration reconciliation (`reconcileElements` in `packages/excalidraw/data/reconcile.ts` without modifying it) preserves `arrowheadSize` according to `version` / `versionNonce`.

---

## Non-functional requirements

- **NFR-1 (Backward compatibility of saved scenes):** Existing `.excalidraw` files and scenes containing arrows/lines without `arrowheadSize` MUST restore without acquiring the `arrowheadSize` key and MUST render identically (byte-for-byte identical geometry and SVG paths) to prior versions.
- **NFR-2 (No element or render snapshot changes):** No existing element snapshot or render/SVG snapshot in the repository may change. Default-sized linear elements MUST omit the `arrowheadSize` property rather than storing `1` or `undefined`.
- **NFR-3 (Strictly bounded app-state snapshot updates):** The only permitted snapshot changes across the entire repository are the addition of the `currentItemArrowheadSize` key in:
  - `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap`
  - `packages/excalidraw/tests/__snapshots__/contextmenu.test.tsx.snap`
  - `packages/excalidraw/tests/__snapshots__/regressionTests.test.tsx.snap`
- **NFR-4 (Write-scope compliance):** Only files on the Gate 0 frozen allowlist may be created or modified. `packages/element/src/delta.ts`, `packages/excalidraw/data/reconcile.ts`, non-English locale files (`packages/excalidraw/locales/*.json` except `en.json`), and AI config files MUST NOT be modified.
- **NFR-5 (Type safety & code quality):** All changes MUST pass strict TypeScript typechecking (`yarn test:typecheck`) and linter/code checks (`yarn test:code`) with zero errors.

---

## PII inventory

None. This feature only adds a numeric geometric scale preset (`arrowheadSize` / `currentItemArrowheadSize`) to diagram elements and local browser UI preferences; no personal, user-identifying, or sensitive data is collected, processed, or stored.

| Field | Sensitivity | Protection |
|---|---|---|
| None | N/A | N/A |

---

## Role matrix

Excalidraw editor operates as a client-side canvas with a single interactive editor user role (plus read-only view mode where property editing is disabled).

| Role | Resource | Action | Permission |
|---|---|---|---|
| Editor User (edit mode) | Selected `arrow` / `line` element (`arrowheadSize`) | View / Change arrowhead size preset (Small, Medium, Large), Copy/Paste styles, Undo/Redo | Allowed |
| Editor User (edit mode, no selection) | `AppState.currentItemArrowheadSize` | Preconfigure arrowhead size for newly drawn arrows (persisted to browser storage only) | Allowed |
| Viewer (view mode / locked element) | `arrow` / `line` element (`arrowheadSize`) | Render existing `arrowheadSize` on canvas and SVG export; cannot mutate via properties panel | Read-only |

---

## Acceptance criteria

1. **AC-1 (Restore + SVG export smaller head):** In `packages/excalidraw/tests/arrowheadSize.test.tsx`, a jsdom test verifies that an arrow with a smaller `arrowheadSize` restores with the value intact and draws a smaller arrowhead in `exportScene({ type: "svg", ... })` than the same arrow without `arrowheadSize`. Executable via: `yarn test:app --watch=false packages/excalidraw/tests/arrowheadSize.test.tsx`.
2. **AC-2 (Legacy arrow compatibility & snapshot invariance):** In `packages/excalidraw/tests/data/restore.test.ts` and `packages/excalidraw/tests/arrowheadSize.test.tsx`, jsdom tests verify that an arrow without `arrowheadSize` restores without gaining the `"arrowheadSize"` property (`!("arrowheadSize" in restored)`) and draws today's arrowhead. Running `yarn test:app --watch=false` passes with zero element or render snapshot changes, and only `currentItemArrowheadSize` added in `history.test.tsx.snap`, `contextmenu.test.tsx.snap`, and `regressionTests.test.tsx.snap`.
3. **AC-3 (Arrowhead geometry from `getArrowheadPoints` & short-segment fitting):** In `packages/element/tests/bounds.test.ts`, unit tests on head geometry from `getArrowheadPoints` (not the element's bounding box) verify that: (a) on a long straight last segment (long enough that no head is shortened), each head type's sideways half-width at scale `s` (`0.5` and `1.5`) equals `s` times its half-width at scale `1`, within float tolerance, and the head angle does not change with the scale when the head is not shortened; (b) an explicit regression test verifies that an `"arrow"` head at Small (`0.5`) stays at 20 degrees; and (c) short-segment shrinking and `getArrowheadSizeBeyondLastSegment` (including cardinality marker scaling) still apply. Executable via: `yarn test:app --watch=false packages/element/tests/bounds.test.ts`.
4. **AC-4 (Properties panel update, undo/redo, copy-styles & collab reconcile):** In `packages/excalidraw/tests/arrowheadSize.test.tsx`, tests verify that changing the arrowhead size from the properties panel updates selected arrows (and `currentItemArrowheadSize` for new arrows), can be undone and redone cleanly via history deltas, copies/pastes via `actionCopyStyles`/`actionPasteStyles`, and reconciles via `reconcileElements`. Executable via: `yarn test:app --watch=false packages/excalidraw/tests/arrowheadSize.test.tsx`.
5. **AC-5 (Full verification suite):** The confirmed Gate 0 test command `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` completes with exit code `0`.

---

## Open questions for HITL

None. All architectural and product scope questions (property representation, omission of default value, preset options Small/Medium/Large, Option A `currentItemArrowheadSize` browser-only persistence, older-client behavior, and scaling of `elbowArrow.ts` and `transform.ts` readers) are settled by Gate 0 decisions and verified against the repository.
