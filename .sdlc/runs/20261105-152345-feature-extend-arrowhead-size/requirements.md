# Requirements — Per-element Arrowhead Size (Delta)

Run ID: `20261105-152345-feature-extend-arrowhead-size`  
Mode: `brownfield` | Intent: `feature-extend`

## In scope

1. Add an optional per-element arrowhead size property on `ExcalidrawLinearElement` (working name `arrowheadSize`; exact property name and value type to be selected by the architect) that scales both start and end arrowheads uniformly and is omitted when at the default size.
2. Update arrowhead geometry, shapes, bounds, elbow route endpoint clearance, label placement, canvas padding, and (if required) SVG export and cache/history delta handling across `@excalidraw/element` and `@excalidraw/excalidraw` to use the element's arrowhead size while preserving short-segment fitting.
3. Update element creation (`newLinearElement` and both branches of `newArrowElement`) and restoration (`restore.ts` for `line`/`draw` and `arrow`) so the size key is written only when a non-default size is chosen and invalid values are stripped on restore.
4. Add a properties-panel control (`actionChangeArrowheadSize` in `actionProperties.tsx`, rendered inside `actionChangeArrowProperties` next to `changeArrowhead`) with preset constants in `@excalidraw/common`, action wiring (`actions/types.ts`, `actions/index.ts`), optional icons (`icons.tsx`), and English localization (`locales/en.json`).
5. Persist the last picked arrowhead size in a new `currentItem*` `AppState` field (`types.ts`, `appState.ts`) and read/propagate it across every path that creates or converts an arrow from current style or copies styles (`App.tsx`, `App.drawshape.ts`, `flowchart.ts`, `convertToShape.ts`, `ConvertElementTypePopup.tsx`, `actionStyles.ts`).
6. Update test helpers (`tests/helpers/api.ts`), add unit and integration tests (`bounds.test.ts`, `restore.test.ts`, `arrowheadSize.test.tsx`), update only the three permitted app-state snapshots via targeted Vitest `--update`, and add a `CHANGELOG.md` entry.

## Out of scope

1. Automatic sizing derived from the size of the arrow or its bound shapes (beyond today's short-segment fitting).
2. Separate sizes for the start and end arrowheads (one property scales both heads).
3. Arrowhead controls for lines (`canHaveArrowheads` remains arrow-only, as today).
4. Changes to the element skeleton API (`convertToExcalidrawElements`) and its documentation in `dev-docs/`.
5. Translations in locale files other than `packages/excalidraw/locales/en.json`.
6. Older clients rendering the new size (they do not know the property, draw arrows at today's default size, and preserve unknown keys on restore and mutation).
7. Any modifications to `.gitignore`, `package.json`, `yarn.lock`, or any snapshot file outside the three allowed app-state snapshots.

## Functional requirements per module

### Module: `@excalidraw/common`

- **FR-1 (Defaults and preset constants):** Define the default arrowhead size and the properties-panel preset options in `packages/common/src/constants.ts` (exact identifier names and value type to be determined by the architect).

### Module: `@excalidraw/element`

- **FR-2 (Linear element type and default-omission creation):** Declare the optional arrowhead size property on `ExcalidrawLinearElement` in `packages/element/src/types.ts` and accept it in `newLinearElement` and both the elbowed and non-elbowed branches of `newArrowElement` in `packages/element/src/newElement.ts`. An element at the default size must carry no size key; the key is written onto the element object only when a non-default size is provided.
- **FR-3 (Arrowhead geometry, shapes, and short-segment fitting):** Update `packages/element/src/bounds.ts` and `packages/element/src/shape.ts` so `getArrowheadPoints`, arrowhead angles, circle diameters, and cardinality markers scale with the element's arrowhead size, rendering identically to today when the property is absent. The existing short-segment fitting (`lengthMultiplier` and `getArrowheadSizeBeyondLastSegment`) must still cap the head so it never exceeds what its segment allows.
- **FR-4 (Downstream geometry consumers, cache, and deltas):** Update `packages/element/src/elbowArrow.ts` (endpoint route clearance), `packages/element/src/transform.ts` (label placement relative to arrowheads), and `packages/element/src/renderElement.ts` (canvas padding covering the largest allowed head) to use the element's arrowhead size. Update `packages/element/src/mutateElement.ts` and `packages/element/src/delta.ts` if required for shape-cache invalidation or history deltas.
- **FR-5 (Element-package arrow creation paths):** Update `packages/element/src/flowchart.ts` (flowchart binding arrow creation) and `packages/element/src/convertToShape.ts` (shape-recognition arrow creation) to read the remembered arrowhead size from the new current-item app-state field and set the property only when non-default.

### Module: `@excalidraw/excalidraw`

- **FR-6 (Restore validation and key omission):** Update `packages/excalidraw/data/restore.ts` in both the `line`/`draw` and `arrow` cases to validate the arrowhead size property when present, drop invalid values, and never add the size key when absent or when set to the default size.
- **FR-7 (Current-item app state):** Add the new current-item arrowhead size field to `AppState` in `packages/excalidraw/types.ts`, initialize its default value in `getDefaultAppState()`, and configure its persistence in `APP_STATE_STORAGE_CONF` (`{ browser: true, export: false, server: false }`) in `packages/excalidraw/appState.ts`.
- **FR-8 (Properties-panel action and UI control):** Implement `actionChangeArrowheadSize` in `packages/excalidraw/actions/actionProperties.tsx` (and register/export it in `packages/excalidraw/actions/types.ts` and `packages/excalidraw/actions/index.ts`, with icons in `packages/excalidraw/components/icons.tsx` if needed and labels in `packages/excalidraw/locales/en.json`), rendered in `actionChangeArrowProperties` next to `changeArrowhead`. Picking a size must update selected linear elements as one undoable history entry (`CaptureUpdateAction.IMMEDIATELY`), re-route elbow arrows where applicable, and update the current-item app-state field (writing the element key only when non-default, and removing or omitting it when returning to the default size).
- **FR-9 (Editor arrow creation, conversion, style copy/paste, and SVG export):** Read the current-item arrowhead size field in `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/App.drawshape.ts`, and `packages/excalidraw/components/ConvertElementTypePopup.tsx` so every path that creates or converts an arrow (`App.tsx`, `App.drawshape.ts`, `flowchart.ts`, `convertToShape.ts`, `ConvertElementTypePopup.tsx`) applies the last picked size. Carry the size across copy/paste styles in `packages/excalidraw/actions/actionStyles.ts`, and update `packages/excalidraw/renderer/staticSvgScene.ts` if needed for SVG export.

### Module: Tests & Documentation

- **FR-10 (Test helper, test cases, and changelog):** Update `packages/excalidraw/tests/helpers/api.ts` (`API.createElement`) to accept and copy the optional size property onto created linear elements; add tests in `packages/element/tests/bounds.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`, and `packages/excalidraw/tests/arrowheadSize.test.tsx`; and add an entry under Unreleased → Features in `packages/excalidraw/CHANGELOG.md`.

## Non-functional requirements

- **NFR-1 (Snapshot update constraint):** Never run `yarn test:update`. The only snapshots allowed to change are `history.test.tsx.snap`, `regressionTests.test.tsx.snap`, and `contextmenu.test.tsx.snap` in `packages/excalidraw/tests/__snapshots__/`, updated by running Vitest with `--update` on only their three test files, producing a diff that only adds the new current-item key at its default value. Every other snapshot file is off-limits.
- **NFR-2 (Default-size key absence):** An element at the default arrowhead size carries no size key, whether created new or restored from serialized data, ensuring existing element and export snapshots remain untouched.
- **NFR-3 (AGENTS.md rules compliance):** Follow both `AGENTS.md` repository rules: (1) use `app.ownerDocument` and `app.ownerWindow` (or the mounted node's `ownerDocument` and `defaultView` when `app` is unavailable) instead of DOM globals; (2) prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.
- **NFR-4 (No `.gitignore` or off-limits modifications):** Make no change to `.gitignore`, `package.json`, `yarn.lock`, or any off-limits file. Follow ESLint `import/order` conventions with zero warnings (`--max-warnings=0`).
- **NFR-5 (Fixed verification command):** The fixed test command `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` must pass word for word (baseline: 149 test files; 2632 passed, 47 skipped, 1 todo).
- **NFR-6 (Architect design authority):** The exact element property name, `AppState` current-item key name, and value type/preset representation are left to the architect and constrained only by the behavioral requirements above.

## PII inventory

None. This feature only adds a visual geometry property on diagram elements and an editor UI preference key.

| Field | Sensitivity | Protection |
| --- | --- | --- |
| None | N/A | N/A |

## Role matrix

Not applicable. `@excalidraw/excalidraw` and `@excalidraw/element` are client-side whiteboard packages without role-based access control.

## Acceptance criteria

- **AC-1 (SVG export of smaller arrowhead):** A jsdom test in `packages/excalidraw/tests/arrowheadSize.test.tsx` restores an arrow carrying a smaller arrowhead size and exports it to SVG; its rendered arrowhead is measurably smaller than the same arrow's head at the default size.
- **AC-2 (Default-size key omission and restore behavior):** Tests in `packages/excalidraw/tests/data/restore.test.ts` confirm that an arrow without the property restores without adding the key and renders at today's size, a valid non-default value is preserved on restore, and an invalid value is dropped without adding the key.
- **AC-3 (Bounds and short-segment fitting):** Tests in `packages/element/tests/bounds.test.ts` confirm that a smaller arrowhead size yields smaller element bounds for the same points, and short-segment fitting still caps the head on a short last segment.
- **AC-4 (Panel control, undoable history, and remembered size across creation paths):** Tests in `packages/excalidraw/tests/arrowheadSize.test.tsx` confirm that the properties panel renders the size control wherever the arrowhead pickers appear, changing it updates selected arrows as a single undoable history entry, and subsequent arrows created from current style (`App.tsx`, `App.drawshape.ts`, `flowchart.ts`, `convertToShape.ts`, `ConvertElementTypePopup.tsx`) take the last picked size from the current-item app-state field (carrying no element key when at the default size).
- **AC-5 (Snapshot and `.gitignore` invariance):** `yarn test:update` is never executed. `git diff` shows no change to `.gitignore` and no change to any snapshot file except `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap`, `packages/excalidraw/tests/__snapshots__/regressionTests.test.tsx.snap`, and `packages/excalidraw/tests/__snapshots__/contextmenu.test.tsx.snap` (updated via Vitest `--update` on only their three test files), where the diff adds only the new current-item key at its default value.
- **AC-6 (Fixed test command execution):** Running `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` word for word passes completely with 0 type errors, 0 lint warnings, and all test files passing against the baseline (149 test files; 2632 passed, 47 skipped, 1 todo, plus new tests).

## Open questions for HITL

None for HITL (all Gate 0 decisions are confirmed and frozen).  
*Deferred to Architect (Phase 2):* Selection of the exact property name on `ExcalidrawLinearElement` (working name `arrowheadSize`), the matching `currentItem*` key name on `AppState`, and the value type/preset scale values.
