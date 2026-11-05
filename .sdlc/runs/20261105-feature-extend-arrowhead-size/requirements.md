# Requirements — Per-element Arrowhead Size (`20261105-feature-extend-arrowhead-size`)

> **Phase 1 rule (`feature-extend`, brownfield):** This document specifies **delta requirements only** relative to the existing arrow and arrowhead implementation in `@excalidraw/element` and `@excalidraw/excalidraw`.

---

## In scope

1. **Optional per-element `arrowheadSize` multiplier on linear elements:** Add `arrowheadSize?: number` to `ExcalidrawLinearElement` (`packages/element/src/types.ts`), covering both `startArrowhead` and `endArrowhead`. When omitted (`undefined`), the effective multiplier is `1` (today's rendered size).
2. **Element creation and Skeleton API passthrough:** Pass `arrowheadSize` through `newLinearElement` and `newArrowElement` (`packages/element/src/newElement.ts`) and `convertToExcalidrawElements` (`packages/element/src/transform.ts`) only when explicitly provided, keeping it omitted by default on newly created elements.
3. **Scene restore and validation:** Preserve a valid numeric `arrowheadSize` in `restoreElement` (`packages/excalidraw/data/restore.ts`) for `line` and `arrow` elements, drop invalid (non-numeric, non-finite, or `<= 0`) values, and leave `arrowheadSize` absent when not set on the input element.
4. **Scaled arrowhead geometry and bounds:** Scale the base arrowhead size returned by `getArrowheadSize` (and its callers in `packages/element/src/bounds.ts`, `packages/element/src/elbowArrow.ts`, and `packages/element/src/transform.ts`) by the element's `arrowheadSize` multiplier while keeping short-segment fitting (`length * lengthMultiplier` and `getArrowheadSizeBeyondLastSegment`) applied after scaling so element bounds, hit-testing, and export remain consistent.
5. **Arrowhead shape generation and canvas padding:** Render arrowheads for linear elements (`arrow` and `line` with arrowheads) at the scaled size in `packages/element/src/shape.ts`, and scale per-element canvas padding in `getCanvasPadding` (`packages/element/src/renderElement.ts`) for both `arrow` and `line` elements having either `startArrowhead` or `endArrowhead` so larger arrowhead presets are never clipped on the canvas.
6. **Properties panel control (`changeArrowheadSize`):** Register a `changeArrowheadSize` action (`packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`) with small / medium / large preset buttons stored as a numeric multiplier on selected linear elements, rendered in desktop and compact properties panels (`packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/components/shapeActionPredicates.ts`) when selected arrows or lines have at least one arrowhead, with undo/redo history support and style copy/paste support (`packages/excalidraw/actions/actionStyles.ts`).
7. **Localization and documentation:** Add English labels in `packages/excalidraw/locales/en.json`, document `arrowheadSize` in `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`, and add an Unreleased entry in `packages/excalidraw/CHANGELOG.md`.

---

## Out of scope

1. Separate arrowhead size properties for start vs. end arrowheads (Gate 0 decision (b) confirms a single `arrowheadSize` property for both heads).
2. Remembering the last-used arrowhead size in `AppState` (`currentItemArrowheadSize` is excluded per Gate 0 decision (c); `packages/excalidraw/appState.ts` and `packages/excalidraw/types.ts` are out of scope).
3. Changing the automatic short-segment shrinking algorithm itself (`getArrowheadPoints` / `getArrowheadSizeBeyondLastSegment` rules remain unchanged; fitting caps the scaled head size).
4. Changing per-type base arrowhead pixel sizes at multiplier `1` (`25` for `arrow`, `12` for `diamond`/`diamond_outline`, `20` for `cardinality_one`/`cardinality_exactly_one`/`cardinality_zero_or_one`, `15` for crow's foot and default heads).
5. Modifying locale files other than `packages/excalidraw/locales/en.json` (translations are managed via Crowdin).
6. Modifying `excalidraw-app/` collaboration or reconciliation code (version-based element reconciliation carries element properties generically).
7. Modifying any existing test snapshot files (`**/__snapshots__/**`).

---

## Functional requirements per module

### Module 1 — Element Model, Constructors & Skeleton API (`@excalidraw/element`)

- **FR-1 (`packages/element/src/types.ts`):** `ExcalidrawLinearElement` MUST declare `readonly arrowheadSize?: number`. Both `ExcalidrawArrowElement` and `ExcalidrawLineElement` inherit this optional property.
- **FR-2 (`packages/element/src/newElement.ts`):** `newLinearElement` and `newArrowElement` (both standard and elbow branches) MUST accept `arrowheadSize?: number` in their options and include `arrowheadSize` on the returned element object only when `opts.arrowheadSize !== undefined`. Newly created elements without `opts.arrowheadSize` MUST NOT have an `arrowheadSize` own property so serialized output and existing snapshots remain byte-for-byte identical.
- **FR-3 (`packages/element/src/transform.ts`):** `convertToExcalidrawElements` MUST pass `arrowheadSize` from `ExcalidrawElementSkeleton` through to `newLinearElement` / `newArrowElement`, and `clampLabelPositionOffEnds` MUST scale the arrowhead clearance margin by the arrow's effective arrowhead size multiplier (`arrow.arrowheadSize ?? 1`).
- **FR-4 (`packages/element/src/delta.ts`):** Element history deltas (`Delta.calculate` / application) MUST preserve and revert `arrowheadSize` across undo and redo transitions, including transitions between `undefined` (omitted) and a numeric multiplier.

### Module 2 — Arrowhead Geometry, Bounds & Rendering (`@excalidraw/element`)

- **FR-5 (`packages/element/src/bounds.ts`):** `getArrowheadSize` and/or its callers in `bounds.ts` (`getArrowheadPoints`, `getArrowheadSizeBeyondLastSegment`, `getCardinalityMarkerScale`, `getArrowheadAngle`) MUST scale the per-type base arrowhead size by the element's `arrowheadSize ?? 1` multiplier. When `arrowheadSize` is `undefined` or `1`, all computed points, angles, and bounds MUST be identical to existing behavior.
- **FR-6 (`packages/element/src/bounds.ts`):** Short-segment fitting in `getArrowheadPoints` (`Math.min(size, length * lengthMultiplier)` and `getArrowheadSizeBeyondLastSegment`) MUST be applied after scaling the base size by `arrowheadSize ?? 1`, so short segments still cap the rendered arrowhead size and element bounds (`getElementBounds` / `getElementAbsoluteCoords`) reflect the effective arrowhead geometry.
- **FR-7 (`packages/element/src/elbowArrow.ts`):** Elbow arrow minimum leg clearance for arrowheads (`getArrowheadSize(arrow.startArrowhead)` / `getArrowheadSize(arrow.endArrowhead)`) MUST account for `arrow.arrowheadSize ?? 1` so elbow routing respects scaled arrowheads.
- **FR-8 (`packages/element/src/shape.ts`):** `ShapeCache.generateElementShape` MUST generate arrowhead drawables at the scaled size for both `arrow` and `line` elements whenever `startArrowhead !== null` or `endArrowhead !== null` (with `endArrowhead` defaulting to `"arrow"` only when `element.type === "arrow"` and `element.endArrowhead === undefined`).
- **FR-9 (`packages/element/src/renderElement.ts`):** `getCanvasPadding` MUST compute canvas padding for both `arrow` and `line` elements that have `startArrowhead` or `endArrowhead` (fixing the duplicate `element.endArrowhead || element.endArrowhead` check and the `line` fallthrough), scaling the 40px arrowhead padding by `Math.max(1, element.arrowheadSize ?? 1)` (e.g., `40 * Math.max(1, element.arrowheadSize ?? 1)`) so that neither start-only arrowheads, line arrowheads, nor large arrowhead presets are clipped on canvas, while keeping 40px for default-sized arrows with arrowheads and 20px when no arrowheads are present.

### Module 3 — Restore, Actions, Properties Panel & Docs (`@excalidraw/excalidraw`)

- **FR-10 (`packages/excalidraw/data/restore.ts`):** In `restoreElement` for `"line"` and `"arrow"`, if `element.arrowheadSize` is a finite positive number (`typeof element.arrowheadSize === "number" && Number.isFinite(element.arrowheadSize) && element.arrowheadSize > 0`), it MUST be preserved on the restored element; if `element.arrowheadSize` is `undefined` or invalid (e.g., `null`, `NaN`, `<= 0`, string), it MUST be omitted from the restored element so existing snapshots and old files restore without an `arrowheadSize` key.
- **FR-11 (`packages/excalidraw/actions/types.ts`, `packages/excalidraw/actions/actionProperties.tsx`):** Register action `"changeArrowheadSize"` (`actionChangeArrowheadSize`) with three presets — small (`0.5`), medium (`1`), and large (`1.5`) — rendered as a `RadioSelection` preset button group. Selecting a preset updates `arrowheadSize` on all selected linear elements via `newElementWith`, re-routes elbow arrows via `updateElbowArrowRoute`, and records history with `CaptureUpdateAction.IMMEDIATELY`. When reading form value (`getFormValue`), an element with `arrowheadSize === undefined` MUST map to the medium (`1`) preset.
- **FR-12 (`packages/excalidraw/components/shapeActionPredicates.ts`, `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/actions/actionProperties.tsx`):** The arrowhead size control MUST be displayed in both desktop (`SelectedShapeActions` in `Actions.tsx`) and compact/mobile (`actionChangeArrowProperties` / compact popover) panels whenever at least one selected linear element (`arrow` or `line`) has at least one arrowhead (`Boolean(el.startArrowhead || el.endArrowhead)`).
- **FR-13 (`packages/excalidraw/actions/actionStyles.ts`):** In `actionPasteStyles`, within the arrow-to-arrow style-paste block (`newElement.type === "arrow" && isArrowElement(elementStylesToCopyFrom)`), pasting styles MUST make the target arrow's `arrowheadSize` match the source arrow's `arrowheadSize` in every case, alongside `startArrowhead` and `endArrowhead`. When the source arrow has a numeric `arrowheadSize`, the target arrow gets that value; when the source arrow has no `arrowheadSize` (`undefined`), the target arrow ends with no `arrowheadSize` (`arrowheadSize === undefined`, today's default size), including when the target arrow had an `arrowheadSize` before the paste. If the target arrow is an elbow arrow (`isElbowArrow(newElement)`), it MUST then be re-routed via `updateElbowArrowRoute`.
- **FR-14 (`packages/excalidraw/locales/en.json`, `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`, `packages/excalidraw/CHANGELOG.md`):** Add the `labels.arrowheadSize` string (and any preset labels not already in `en.json`), document `arrowheadSize` in the Skeleton API docs, and record the feature under Unreleased in `CHANGELOG.md`.

---

## Non-functional requirements

- **NFR-1 (Backward & Forward Compatibility):** Elements without `arrowheadSize` MUST serialize, restore, and render identically to today. Older clients receiving elements with `arrowheadSize` ignore unknown fields or carry them via version-based reconciliation without crashing.
- **NFR-2 (Snapshot Integrity):** All existing `__snapshots__` files MUST remain byte-for-byte untouched.
- **NFR-3 (Performance & Immutability):** Element updates MUST use `newElementWith` (bumping `version` / `versionNonce` to invalidate `ShapeCache` and `ElementBounds` WeakMap caches) with zero in-place mutation of `Readonly` element objects.
- **NFR-4 (Type Safety & Lint Cleanliness):** The codebase MUST pass `yarn test:typecheck` (TypeScript 5.9 strict mode) and `yarn test:code` (ESLint with `--max-warnings 0`).

---

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| None | N/A | No PII or user data is introduced; `arrowheadSize` is a numeric drawing geometry multiplier on scene elements. |

---

## Role matrix

Excalidraw is a client-side single-user / peer-collaborative canvas editor without RBAC roles.

| Role | Resource | Action |
|---|---|---|
| Editor user (interactive mode) | Selected linear element (`arrow` / `line`) with arrowhead(s) | Read and update `arrowheadSize` via properties panel, paste styles, undo/redo, and programmatic API |
| Viewer (view mode / read-only export) | Scene elements (`arrow` / `line`) | Render and export elements honoring `arrowheadSize` (read-only) |

---

## Acceptance criteria

1. **AC-1 (Restore & SVG export of scaled arrowhead):** In `packages/excalidraw/tests/scene/export.test.ts` (and `packages/excalidraw/tests/data/restore.test.ts`), a Vitest jsdom test restores an arrow with `arrowheadSize: 0.5` (and `1.5`), exports to SVG via `exportScene({ type: "svg", ... })`, and asserts that the rendered arrowhead path coordinates are smaller (for `0.5`) and larger (for `1.5`) than an otherwise identical arrow with default size (`arrowheadSize` omitted).
2. **AC-2 (Backward compatibility & snapshot preservation):** In `packages/excalidraw/tests/data/restore.test.ts`, restoring an arrow or line without `arrowheadSize` leaves `"arrowheadSize" in restoredElement === false` (or `restoredElement.arrowheadSize === undefined`), drops invalid `arrowheadSize` values (e.g., `0`, `-1`, `"large"`), and passes all existing `toMatchSnapshot` assertions without modifying any `__snapshots__` file.
3. **AC-3 (Scaled geometry, bounds & short-segment cap):** In `packages/element/tests/bounds.test.ts` and `packages/element/tests/shape.test.ts`, Vitest assertions verify that `getArrowheadPoints` and `getElementBounds` scale with `arrowheadSize` (e.g., `0.5` vs `1` vs `1.5`) on long segments, and that on a short last segment the head size remains capped by the short-segment fitting logic (`<= length * lengthMultiplier` or `getArrowheadSizeBeyondLastSegment`).
4. **AC-4 (Properties panel visibility, mutation & undo/redo):** In `packages/excalidraw/actions/actionProperties.test.tsx`, a Vitest test selects an arrow (and a line with an arrowhead), asserts that the arrowhead size preset buttons (`small`, `medium`, `large`) appear in the properties panel (and do not appear when an arrow/line has no arrowheads), clicks a preset to update `element.arrowheadSize`, and verifies that Undo and Redo revert and reapply `element.arrowheadSize`.
5. **AC-5 (Default omission on newly created elements):** In `packages/excalidraw/tests/data/restore.test.ts` / `packages/excalidraw/actions/actionProperties.test.tsx`, newly created arrows and lines have `element.arrowheadSize === undefined` (`!("arrowheadSize" in element)`).
6. **AC-6 (Canvas padding for large presets, start-only heads, and lines with heads):** A Vitest test verifies that Canvas rendering / `getCanvasPadding` gives unclipped padding (`>= 40 * 1.5`) for an arrow or line with `arrowheadSize: 1.5` and an arrowhead at either `startArrowhead` or `endArrowhead`, `40` at default size with either head, and `20` when neither head is set.
7. **AC-7 (Full verification suite):** Running `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` from the repository root exits with code `0`.
8. **AC-8 (Paste styles `arrowheadSize` synchronization — appended after AC-7 to preserve existing AC numbering):** In `packages/excalidraw/actions/actionProperties.test.tsx` (or another allowlisted test file under `packages/excalidraw/actions/*.test.tsx`), a Vitest test verifies both arrow-to-arrow style-paste cases via `actionCopyStyles` and `actionPasteStyles`: (a) copying styles from a source arrow with `arrowheadSize: 1.5` onto a target arrow that had no `arrowheadSize` sets `target.arrowheadSize` to `1.5`, and (b) copying styles from a source arrow with no `arrowheadSize` onto a target arrow with `arrowheadSize: 0.5` leaves the target arrow with `target.arrowheadSize === undefined`.

---

## Open questions for HITL

None — all Gate 0 design decisions (`(a)` presets small/medium/large stored as a numeric multiplier, `(b)` single optional `arrowheadSize` property for both heads, `(c)` no `currentItemArrowheadSize` in `appState`) are confirmed and frozen.
