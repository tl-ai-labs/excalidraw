## Conventions

- Formatter is Prettier 2.6 via @excalidraw/prettier-config: double quotes, trailing commas, 80-column lines; ESLint runs with --max-warnings=0 and enforces import/order (groups separated by blank lines, type-only imports last).
- Cross-package imports use the aliases @excalidraw/common, @excalidraw/element, @excalidraw/element/types and @excalidraw/math; imports inside one package are relative (./arrowheads, ../components/RadioSelection).
- Type-only imports use a separate `import type { ... }` statement (consistent-type-imports with separate-type-imports); never mix types into a value import.
- Element-package code is plain exported arrow functions with explicit return types and switch over string-literal unions; no classes for new helpers.
- Elements are immutable: actions update with newElementWith(el, partial) (bumps version/versionNonce, which history and collaboration rely on); never assign to an element field.
- Follow AGENTS.md: use Merge<> from @excalidraw/common/utility-types instead of Omit<> & ..., and app.ownerDocument / app.ownerWindow instead of document / window in new non-test DOM code.
- Geometry and render code runs per frame: the default path (no arrowheadSize key) must take no new allocations and must produce byte-identical numbers to today (multiply/divide by exactly 1).
- User-facing strings go through t("labels.<key>") from ../i18n; only packages/excalidraw/locales/en.json gets new keys, never another locale.
- Tests use vitest globals (describe/it/expect/beforeEach without import); editor tests render <Excalidraw /> with render() from tests/test-utils and drive it through API, UI and Keyboard from tests/helpers, querying controls by data-testid.
- Element-package tests import editor test helpers as @excalidraw/excalidraw/tests/helpers/api and the code under test relatively from ../src/<module>.
- Names fixed by this change: element property `arrowheadSize`, type `ArrowheadSize`, appState key `currentItemArrowheadSize`, action `actionChangeArrowheadSize` named "changeArrowheadSize", constants ARROWHEAD_SIZE_SCALES and DEFAULT_ARROWHEAD_SIZE, helpers isArrowheadSize / normalizeArrowheadSize / getArrowheadSizeScale.

## Decisions

- Size representation: A closed set of named presets "small" | "medium" | "large" mapped by ARROWHEAD_SIZE_SCALES = { small: 0.5, medium: 1, large: 1.5 } in @excalidraw/common; "medium" is the default (scale 1, today's geometry) and is never stored on an element: an absent key means default. (not numeric scale values on the element; not free-form pixel sizes; not separate start/end sizes) — A closed union restores and validates trivially, maps to RadioSelection like stroke width, and the absent-key default keeps every existing element and snapshot unchanged.
- Where the scale applies: Only inside getArrowheadPoints in bounds.ts: size = getArrowheadSize(arrowhead) * getArrowheadSizeScale(element.arrowheadSize), after which the existing short-segment fitting (length multiplier and getArrowheadSizeBeyondLastSegment) runs unchanged with that size as the full size; getArrowheadSize(arrowhead) keeps its signature and per-type values. (not adding a size parameter to getArrowheadSize; not scaling in shape.ts or renderElement.ts) — getArrowheadPoints is the single function canvas, SVG export, shape cache and bounds all read (NFR-3); for sizes at or below default this equals the smaller of the chosen size and today's auto-shrunk size, and elbowArrow.ts/transform.ts keep reading the unscaled per-type size.
- Head opening angle: getArrowheadPoints passes minSize / scale to getArrowheadAngle, so a chosen size draws the same shape as the default at full size and the existing widening still applies when the fitting shrinks the head. (not passing the absolute minSize (small heads would open wider than default)) — FR-2 asks for proportional scaling; dividing by exactly 1 keeps the default byte-identical.
- Bounds: Linear bounds (getLinearElementRotatedBounds) are extended by the arrowhead extents only for arrow elements whose getArrowheadSizeScale is greater than 1; default and small heads keep today's curve-only bounds. (not always including heads in bounds (changes every existing arrow's bounds and export size, breaking NFR-1); not including heads whenever the key is present (choosing small would grow the bounds)) — Today heads never define the extent; this keeps default bounds identical (AC-2), makes an enlarged head grow the bounds that export sizing, culling and the hit-test prefilter use (AC-3), and never lets a smaller choice grow them.
- Hit-testing: Hit-testing follows the scaled head through getElementBounds (the hitElementItself prefilter); the precise test stays against the arrow path as today. (not editing collision.ts / utils.ts to hit-test head outlines) — collision.ts and utils.ts are outside the Gate 0 allowlist and heads are not hit targets today; the head tip sits on the path end so clicks on the head near the tip still hit.
- Elbow arrows and rendering padding: Elbow routing does not read the size and actionChangeArrowheadSize does not re-route; renderElement.ts, shape.ts and staticSvgScene.ts are not edited. (not re-routing elbow arrows on size change; not scaling getCanvasPadding) — Routing reserves space per head type; the 40px arrow canvas padding exceeds the largest lateral head extent at scale 1.5 (bar: 22.5px); shapes already come from getArrowheadPoints.
- Writing the default: Setting the default size writes { arrowheadSize: undefined } via newElementWith (serializes as absent); actionChangeArrowheadSize and paste-styles skip an element whose normalized size already equals the target, so untouched elements gain no key. (not rebuilding element objects without the key in actions) — newElementWith cannot delete keys; skipping no-op elements keeps existing element snapshots (e.g. paste-styles tests) free of a new key.
- Restore: restoreElement keeps a valid non-default arrowheadSize on line and arrow elements, deletes the key when the value is invalid or "medium", and leaves an element without the key untouched; restoreAppState falls back to DEFAULT_ARROWHEAD_SIZE for a missing or invalid currentItemArrowheadSize. — Canonical absence of the default keeps restored scenes byte-identical to today and makes invalid imports render at the default.
- Unknown values at render time: getArrowheadSizeScale returns 1 for any value that is not a key of ARROWHEAD_SIZE_SCALES (including undefined). — An element received over collaboration from a newer client renders at default instead of NaN geometry (NFR-2).
- Properties-panel control: actionChangeArrowheadSize renders <fieldset><legend>{t("labels.arrowheadSize")}</legend> with a RadioSelection<ArrowheadSize> (group "arrowhead-size", testIds arrowheadSize-small / arrowheadSize-medium / arrowheadSize-large) reusing FontSizeSmallIcon, FontSizeMediumIcon and FontSizeLargeIcon; it renders right after changeArrowhead in the full panel under predicates.arrowheads and inside actionChangeArrowProperties for the compact and mobile panels. (not new icons in icons.tsx; not a new predicate in shapeActionPredicates.ts) — Follows the actionChangeStrokeWidth pattern and the existing arrowhead visibility exactly (open question 2 default).
- appState storage: currentItemArrowheadSize is stored like currentItemEndArrowhead: { browser: true, export: false, server: false }. — It is a per-user drawing default, not scene data.
- Which new elements take the default: Arrows created by the drawing tool (App.tsx), flowchart (flowchart.ts), autoshape recognition (convertToShape.ts, App.drawshape.ts) and conversion to sharp or curved arrows (ConvertElementTypePopup.tsx) pass arrowheadSize: <appState>.currentItemArrowheadSize; elbow conversion keeps the element's own size via the existing spread; lines get no size from appState because they draw no heads. — Mirrors exactly where currentItemStartArrowhead / currentItemEndArrowhead are applied today.
- Snapshot churn: After all source and test units, a tooling step runs vitest with --update over packages/ only; the only expected snapshot change is the new currentItemArrowheadSize key in appState-capturing snapshots (and the new control in panel DOM snapshots). (not updating excalidraw-app snapshots (off-limits)) — getDefaultAppState gains a key (FR-7), which Gate 0 allows in appState snapshots; reviewers check the diff shows no element or geometry change.

## Files of this change

- `packages/common/src/constants.ts` (U01, edit) — import: `import { ARROWHEAD_SIZE_SCALES, DEFAULT_ARROWHEAD_SIZE } from "@excalidraw/common";`
  - `const ARROWHEAD_SIZE_SCALES(): { readonly small: 0.5; readonly medium: 1; readonly large: 1.5 }`
  - `const DEFAULT_ARROWHEAD_SIZE(): keyof typeof ARROWHEAD_SIZE_SCALES`
- `packages/element/src/types.ts` (U02, edit) — import: `import type { ArrowheadSize } from "@excalidraw/element/types";`
  - `type ArrowheadSize(): "small" | "medium" | "large"`
  - `type ExcalidrawLinearElement(): gains `arrowheadSize?: ArrowheadSize``
- `packages/element/src/arrowheads.ts` (U03, edit) — import: `import { getArrowheadSizeScale, isArrowheadSize, normalizeArrowheadSize } from "@excalidraw/element";`
  - `function isArrowheadSize(value: unknown): value is ArrowheadSize`
  - `function normalizeArrowheadSize(value: unknown): ArrowheadSize | undefined`
  - `function getArrowheadSizeScale(arrowheadSize: ArrowheadSize | undefined): number`
- `packages/element/src/bounds.ts` (U04, edit) — import: `import { getArrowheadPoints, getElementBounds } from "@excalidraw/element";`
  - `function getArrowheadPoints(element: ExcalidrawLinearElement, shape: Drawable[], position: "start" | "end", arrowhead: Arrowhead, offsetMultiplier: number = 0): number[] | null (now scaled by element.arrowheadSize)`
  - `function getElementBounds(element: ExcalidrawElement, elementsMap: ElementsMap, nonRotated: boolean = false): Bounds (arrows with a size above default include their heads)`
- `packages/element/src/newElement.ts` (U05, edit) — import: `import { newArrowElement, newLinearElement } from "@excalidraw/element";`
  - `function newLinearElement(opts: { type; points?; polygon?; arrowheadSize?: ExcalidrawLinearElement["arrowheadSize"] } & ElementConstructorOpts): NonDeleted<ExcalidrawLinearElement>`
  - `function newArrowElement(opts: { type; startArrowhead?; endArrowhead?; points?; elbowed?; fixedSegments?; arrowheadSize?: ExcalidrawLinearElement["arrowheadSize"] } & ElementConstructorOpts): NonDeleted<ExcalidrawArrowElement | ExcalidrawElbowArrowElement>`
- `packages/excalidraw/types.ts` (U06, edit) — import: `import type { AppState } from "../types";`
  - `type AppState(): gains `currentItemArrowheadSize: ArrowheadSize``
- `packages/excalidraw/appState.ts` (U07, edit) — import: `import { getDefaultAppState } from "../appState";`
  - `function getDefaultAppState(): Omit<AppState, "offsetTop" | "offsetLeft" | "width" | "height"> (now with currentItemArrowheadSize)`
- `packages/element/src/flowchart.ts` (U08, edit)
- `packages/element/src/convertToShape.ts` (U09, edit)
- `packages/excalidraw/data/restore.ts` (U10, edit) — import: `import { restoreAppState, restoreElements } from "../data/restore";`
  - `function restoreElement(element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>, targetElementsMap: Readonly<ElementsMap>, existingElementsMap: Readonly<ElementsMap> | null | undefined, opts: { deleteInvisibleElements?: boolean } | undefined): typeof element | null (arrowheadSize normalized)`
  - `function restoreAppState(appState: ImportedDataState["appState"], localAppState: Partial<AppState> | null | undefined): RestoredAppState (currentItemArrowheadSize validated)`
- `packages/excalidraw/actions/types.ts` (U11, edit)
- `packages/excalidraw/locales/en.json` (U12, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U13, edit) — import: `import { actionChangeArrowheadSize } from "../actions/actionProperties";`
  - `Action<ArrowheadSize> actionChangeArrowheadSize(): Action registered as "changeArrowheadSize"`
- `packages/excalidraw/actions/index.ts` (U14, edit)
- `packages/excalidraw/components/Actions.tsx` (U15, edit)
- `packages/excalidraw/actions/actionStyles.ts` (U16, edit)
- `packages/excalidraw/components/App.tsx` (U17, edit)
- `packages/excalidraw/components/App.drawshape.ts` (U18, edit)
- `packages/excalidraw/components/ConvertElementTypePopup.tsx` (U19, edit)
- `packages/element/tests/arrowheadSize.test.ts` (U20, create)
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (U21, create)
- `packages/excalidraw/CHANGELOG.md` (U23, edit)
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx` (U24, edit)
