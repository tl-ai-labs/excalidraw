## Conventions

- TypeScript strict throughout; no `any`, no `@ts-ignore`; prefer `readonly`, `const`, `?.` and `??` (copilot-instructions).
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit<>&`; use `app.ownerDocument`/`app.ownerWindow` for any DOM API (AGENTS.md).
- Formatting is Prettier via @excalidraw/prettier-config (double quotes, trailing commas, 80 columns); eslint runs with --max-warnings=0, so a prettier/prettier warning fails.
- Imports: value imports first, then `import type` blocks (separate-type-imports); groups separated by one blank line; cross-package imports use the `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math` aliases, in-package imports are relative (`./bounds`).
- Elements are immutable: every element update goes through `newElementWith(el, {...})` (which bumps the version and so invalidates ShapeCache, ElementBounds and the hit-shape cache); only test helpers mutate in place.
- Comments are lowercase, short, and say why, like the existing ones in bounds.ts.
- UI strings come from `t("labels.x")`; only packages/excalidraw/locales/en.json is edited; no literal text in JSX.
- An element with no `arrowheadSize` (or `null`/`"medium"`) must produce exactly HEAD's geometry, bounds, shapes and SVG: scale 1 multiplies, never branches into new code, and the bounds extension runs only when the scale is above 1.
- Tests are Vitest with jsdom and @testing-library/react: globals `describe`/`it`/`expect`, `vi` imported from "vitest" only when used; editor tests use `API`, `UI` and `render` from packages/excalidraw/tests/helpers and test-utils; element tests import sources relatively (`../src/bounds`).
- Element snapshots must not change; only the appState snapshots gain `currentItemArrowheadSize: null`.

## Decisions

- Allowlist check for option C (FR-21e): No file outside the allowlist changes: hitElementBoundingBox (collision.ts), the contain lasso (lasso/utils.ts) and box selection (selection.ts via elementsOverlappingBBox) all read getElementBounds, so at large they follow the widened bounds with no edit; distance.ts and utils.ts stay shaft-only. (not stop the run for collision.ts / lasso/utils.ts edits (that was option A, not chosen)) — Option C accepts that every reader of getElementBounds follows the drawn head at large, so the bounds change in bounds.ts is the whole hit-testing change.
- Drawn selection border at large (FR-21d): The single-element selection border keeps reading LinearElementEditor.getElementAbsoluteCoords (shaft-only, interactiveScene.ts:1916); it is not changed. (not make the border follow getElementBounds (needs linearElementEditor.ts or interactiveScene.ts, both off the allowlist)) — At HEAD every arrowhead already reaches outside that border at every size, so a large head outside it is the same accepted mismatch, not a new one; the multi-selection box reads getCommonBounds and does follow the head.
- Presets and scale factors: ArrowheadSize = "small" | "medium" | "large" with scale 0.6 / 1 / 1.5; null, undefined or any unknown value scales by 1. — Settled at Gate 1; medium is today's size.
- Where the type and the table live: The `ArrowheadSize` union is declared in packages/element/src/types.ts next to `Arrowhead`; packages/common/src/constants.ts holds ARROWHEAD_SIZE_KEYS, ARROWHEAD_SIZE_SCALE, isArrowheadSize() and getArrowheadSizeScale(), importing the type with `import type` from @excalidraw/element/types (as it already does for ExcalidrawElement). (not declare the union in constants.ts (types.ts would then import a type from common for an element field, unlike every other element field)) — FR-1 names the type on the element model; FR-2 puts the presets in constants.ts in the STROKE_WIDTH style.
- Scaling API in bounds.ts: getArrowheadSize(arrowhead, scale = 1), getArrowheadAngle(arrowhead, size?, scale = 1) and the private getCardinalityMarkerScale(marker, corner, strokeWidth, scale) take a trailing scale; element-aware callers pass getArrowheadSizeScale(element.arrowheadSize). Callers with no element keep calling with no scale. (not a new getScaledArrowheadSize(element, arrowhead) wrapper (a second name for the same size, and the angle and marker helpers still need the scale)) — Existing call sites and tests (transform.test.ts, bounds.test.ts) keep compiling and returning HEAD values.
- Creation without a size (FR-5 vs FR-9): newLinearElement and newArrowElement write the `arrowheadSize` key only for a non-null value; `null` and `undefined` both create an element with no key. (not write the key for any non-undefined value (a null current size would add `arrowheadSize: null` to every new arrow and churn element snapshots)) — FR-9 and NFR-2 require a null current size to create no key; null and absent render the same.
- Picking medium: changeArrowheadSize stores the picked key as is, so medium stores "medium". — Settled at Gate 1.
- Restore: restoreElement keeps `arrowheadSize` on line and arrow elements only when isArrowheadSize() holds; null, missing or invalid leave no key. restoreAppState keeps currentItemArrowheadSize when it is null or a known key, else sets null. — FR-13/FR-14: restored old elements stay byte-identical to today's output.
- Bounds under option C (FR-21b, AC-3): getLinearElementRotatedBounds extends the shaft bounds by the drawn heads only when the element is an arrow and its scale is above 1, using getArrowheadPoints for the same parts shape.ts draws (composite cardinality markers split into their bar, crow's-foot and circle parts with the same offsets); a circle part adds its center plus and minus half the diameter. (not include heads at every size (changes medium and small bounds, breaks NFR-1 and FR-21a); not read the head drawables from ShapeCache (rough jitter, and the cache can be empty)) — Lines never draw heads (shape.ts adds heads for arrows only), and small or medium heads must leave bounds and every hit result as at HEAD.
- Files that need no change: shape.ts, staticSvgScene.ts, arrowheads.ts, binding.ts, delta.ts and actionFlip.ts stay unchanged. — Head shapes read the size through getArrowheadPoints(element, ...); SVG export uses the same shapes; the generic delta key diff carries the field and applies it through newElementWith; one size for both heads needs no swap on flip.
- Canvas padding (FR-7): getCanvasPadding returns 40 times max(1, scale) for an arrow with a start or an end head (the `endArrowhead || endArrowhead` typo fixed to `startArrowhead || endArrowhead`), else 20. — Settled at Gate 1; large heads must not clip on the element canvas.
- Elbow arrows: The simple-route leg check (getSimpleRoute) reserves the scaled head size; changeArrowheadSize re-routes elbow arrows with updateElbowArrowRoute exactly as changeArrowhead does. The fixed BASE_BINDING_GAP padding elsewhere in elbowArrow.ts is unchanged. — FR-3 asks for scaled head clearance; out-of-scope item 6 forbids other routing changes.
- Creation sites (FR-9): currentItemArrowheadSize is passed as `arrowheadSize` wherever an arrow is created from currentItemStartArrowhead/currentItemEndArrowhead: App.tsx arrow tool, App.drawshape.ts, convertToShape.ts, flowchart.ts and the two ConvertElementTypePopup.tsx arrow cases. The line tool does not pass it. — The line tool never gives a line a head (App.tsx:8628-8631), so a size there would be dead data.
- Panel control and predicate (FR-11, FR-12): Predicate `arrowheadSize` is true when the active tool is `arrow`, or a target element is an arrow, or a target line has a start or end head. The control is a RadioSelection, group "arrowhead-size", legend t("labels.arrowheadSize"), options small/medium/large with t("labels.small"|"labels.medium"|"labels.large"), FontSizeSmallIcon/FontSizeMediumIcon/FontSizeLargeIcon and testIds `arrowheadSize-small|medium|large`; rendered after changeArrowhead in the desktop panel and inside actionChangeArrowProperties for compact and mobile. — Settled at Gate 1; the font-size icons are the existing small/medium/large set.
- Paste styles (FR-15): Pasting onto an arrow copies the source arrow's arrowheadSize; when the source has none and the target has one, it writes null; when neither has one it writes nothing (undefined), so no key appears. — Mirrors how the arrowheads are copied without adding a key to elements that never had one.
- Snapshots: The three appState snapshot files (contextmenu, history, regressionTests) are regenerated by `vitest --update` tooling steps, never typed. The two utils.test.ts.snap files (packages/utils/tests, packages/excalidraw/tests/packages) have no owning test file at HEAD, so no run writes them and they stay byte-identical. — Gate 1 listed five snap files, but only three are produced by tests that exist; editing the orphaned two by hand would be untested churn.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { ArrowheadSize } from "@excalidraw/element/types";`
  - `type ArrowheadSize(): "small" | "medium" | "large"`
- `packages/common/src/constants.ts` (U02, edit) — import: `import { ARROWHEAD_SIZE_KEYS, ARROWHEAD_SIZE_SCALE, isArrowheadSize, getArrowheadSizeScale } from "@excalidraw/common";`
  - `const ARROWHEAD_SIZE_KEYS(): readonly ArrowheadSize[]`
  - `const ARROWHEAD_SIZE_SCALE(): Readonly<Record<ArrowheadSize, number>>`
  - `function isArrowheadSize(value: unknown): value is ArrowheadSize`
  - `function getArrowheadSizeScale(size: ArrowheadSize | null | undefined): number`
- `packages/element/src/bounds.ts` (U03, edit) — import: `import { getArrowheadSize, getArrowheadAngle, getArrowheadPoints, getElementBounds } from "@excalidraw/element";`
  - `function getArrowheadSize(arrowhead: Arrowhead, scale: number = 1): number`
  - `function getArrowheadAngle(arrowhead: Arrowhead, size: number | undefined, scale: number = 1): Degrees`
- `packages/element/src/renderElement.ts` (U04, edit)
- `packages/element/src/elbowArrow.ts` (U05, edit)
- `packages/element/src/newElement.ts` (U06, edit)
- `packages/element/src/transform.ts` (U07, edit)
- `packages/excalidraw/types.ts` (U08, edit)
- `packages/element/src/convertToShape.ts` (U09, edit)
- `packages/element/src/flowchart.ts` (U10, edit)
- `packages/excalidraw/appState.ts` (U11, edit)
- `packages/excalidraw/data/restore.ts` (U12, edit)
- `packages/excalidraw/actions/types.ts` (U13, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U14, edit) — import: `import { actionChangeArrowheadSize } from "../actions/actionProperties";`
  - `const actionChangeArrowheadSize(): Action<ArrowheadSize>`
- `packages/excalidraw/actions/index.ts` (U15, edit)
- `packages/excalidraw/components/shapeActionPredicates.ts` (U16, edit)
- `packages/excalidraw/components/Actions.tsx` (U17, edit)
- `packages/excalidraw/actions/actionStyles.ts` (U18, edit)
- `packages/excalidraw/components/App.tsx` (U19, edit)
- `packages/excalidraw/components/App.drawshape.ts` (U20, edit)
- `packages/excalidraw/components/ConvertElementTypePopup.tsx` (U21, edit)
- `packages/excalidraw/locales/en.json` (U22, edit)
- `packages/excalidraw/tests/helpers/api.ts` (U23, edit)
- `packages/element/tests/arrowheadSize.test.ts` (U24, create)
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (U25, create)
- `packages/excalidraw/CHANGELOG.md` (U29, edit)
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx` (U30, edit)
