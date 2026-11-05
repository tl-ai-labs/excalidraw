## Conventions

- Format with Prettier defaults (80 cols, 2-space indent, double quotes, trailing commas all, semicolons) and satisfy ESLint with --max-warnings=0.
- Follow ESLint import/order: external packages first, then @excalidraw/* packages, then relative imports, with import type declarations separated by a blank line at the bottom of each group.
- Do not access global window or document in editor runtime code; use app.ownerDocument / app.ownerWindow when DOM globals are needed.
- Use Merge<Base, Overrides> from @excalidraw/common/utility-types instead of Omit<Base, ...> & Overrides when overriding fields on union or element types.
- Add new UI translation strings only to packages/excalidraw/locales/en.json and reference them via t("labels.<key>").

## Decisions

- Arrowhead size constants and type: Export ARROWHEAD_SIZES = { sm: 0.5, md: 0.75, lg: 1, xl: 1.25 } as const, type ArrowheadSize = (typeof ARROWHEAD_SIZES)[keyof typeof ARROWHEAD_SIZES], DEFAULT_ARROWHEAD_SIZE: ArrowheadSize = ARROWHEAD_SIZES.lg, and isValidArrowheadSize(value: unknown): value is ArrowheadSize from packages/common/src/constants.ts, and re-export ArrowheadSize from packages/element/src/types.ts. (not Fixed pixel presets shared across all arrowhead types; not String preset keys requiring a lookup table at every geometry call site) — Each arrowhead type has its own base pixel size (25, 12, 15, 20), so numeric scale multipliers (with lg = 1 as default) scale all arrowhead types proportionally while matching FONT_SIZES and RadioSelection ergonomics.
- Element property and default-key omission: Add optional arrowheadSize?: ArrowheadSize on ExcalidrawLinearElement; omit arrowheadSize whenever it is undefined, not a valid ArrowheadSize preset, or equal to DEFAULT_ARROWHEAD_SIZE (1) in newLinearElement, newArrowElement, restoreElementWithProperties, mutateElement, and newElementWith (deleting nextElement.arrowheadSize when undefined or DEFAULT_ARROWHEAD_SIZE). (not Always persisting arrowheadSize: 1 on every linear element; not Leaving arrowheadSize: undefined as an own property when resetting to default) — Omitting the key at the default size preserves existing element snapshots and serialized scene shapes and ensures resetting or undoing back to default leaves no own key.
- Geometry scaling, angle widening, and linear element bounds: getArrowheadSize(arrowhead: Arrowhead, size: ArrowheadSize = DEFAULT_ARROWHEAD_SIZE) multiplies the per-type base pixel size by size; getArrowheadAngle(arrowhead: Arrowhead, size?: number, arrowheadSize: ArrowheadSize = DEFAULT_ARROWHEAD_SIZE) computes const resolvedSize = size ?? getArrowheadSize(arrowhead, arrowheadSize) in the body and measures widening from fullSize = getArrowheadSize(arrowhead, arrowheadSize) down to ARROW_ARROWHEAD_WIDEST_SIZE * arrowheadSize so arrowheads keep their 20deg angle at every size and only widen when short-segment fitting shrinks them, with every getArrowheadAngle caller passing element.arrowheadSize; getLinearElementRotatedBounds keeps today's line-only bounds for sizes at or below DEFAULT_ARROWHEAD_SIZE (sm, md, lg) and only for sizes above DEFAULT_ARROWHEAD_SIZE (xl) extends coords with getArrowheadPoints computed from the uncached [generateLinearElementShape(element)] curve (handling [cx, cy, diameter] for circle/circle_outline and point pairs for other arrowheads). (not Reading arrowhead shapes from ShapeCache in getLinearElementRotatedBounds or changing bounds for sm/md/default sizes; not Widening arrow arrowhead angles against unscaled 25px/10px thresholds when a smaller preset size is selected) — Keeping line-only bounds at or below the default size preserves existing arrows and exports while computing xl arrowhead extents from the uncached curve avoids any ShapeCache dependency, and scaling the angle thresholds preserves the 20deg head shape across all preset sizes.
- AppState persistence and properties panel action: Add currentItemArrowheadSize: ArrowheadSize to AppState (defaulting to DEFAULT_ARROWHEAD_SIZE in getDefaultAppState, browser-persisted in APP_STATE_STORAGE_CONF, validated in restoreAppState) and register actionChangeArrowheadSize (name: "changeArrowheadSize", rendered inside actionChangeArrowProperties between changeArrowhead and changeArrowType, with RadioSelection testIds arrowheadSize-small, arrowheadSize-medium, arrowheadSize-large, arrowheadSize-veryLarge). (not Separate start and end arrowhead size controls; not Top-level panel action outside actionChangeArrowProperties) — A single arrowheadSize scales both ends uniformly and sits alongside changeArrowhead and changeArrowType in the arrow properties section.
- Propagating currentItemArrowheadSize and updating snapshots: Pass currentItemArrowheadSize into newArrowElement in App.tsx, App.drawshape.ts, flowchart.ts, convertToShape.ts, ConvertElementTypePopup.tsx (sharpArrow, curvedArrow, elbowArrow), and API.createElement, copy/paste arrowheadSize in actionStyles.ts, and update only history.test.tsx.snap, regressionTests.test.tsx.snap, and contextmenu.test.tsx.snap via a targeted vitest -u tooling unit. (not Running yarn test:update across all snapshots; not Preserving previous arrow size when converting between arrow types in ConvertElementTypePopup) — Gate 0 confirmed that all arrow creation and arrow-type conversion paths take the remembered size and only the three AppState snapshot files may be updated.

## Files of this change

- `packages/common/src/constants.ts` (U01, edit) — import: `import { ARROWHEAD_SIZES, DEFAULT_ARROWHEAD_SIZE, isValidArrowheadSize, type ArrowheadSize } from "@excalidraw/common";`
  - `const ARROWHEAD_SIZES(): { readonly sm: 0.5; readonly md: 0.75; readonly lg: 1; readonly xl: 1.25 }`
  - `type ArrowheadSize(): 0.5 | 0.75 | 1 | 1.25`
  - `const DEFAULT_ARROWHEAD_SIZE(): ArrowheadSize`
  - `function isValidArrowheadSize(value: unknown): value is ArrowheadSize`
- `packages/element/src/types.ts` (U02, edit) — import: `import type { ArrowheadSize, ExcalidrawLinearElement } from "@excalidraw/element/types";`
  - `type ArrowheadSize(): 0.5 | 0.75 | 1 | 1.25`
  - `type ExcalidrawLinearElement(): ExcalidrawLinearElement`
- `packages/element/src/newElement.ts` (U03, edit) — import: `import { newArrowElement, newLinearElement } from "@excalidraw/element";`
  - `function newLinearElement(opts: { type: ExcalidrawLinearElement["type"]; points?: ExcalidrawLinearElement["points"]; polygon?: ExcalidrawLineElement["polygon"]; arrowheadSize?: ExcalidrawLinearElement["arrowheadSize"] } & ElementConstructorOpts): NonDeleted<ExcalidrawLinearElement>`
  - `function newArrowElement(opts: { type: ExcalidrawArrowElement["type"]; startArrowhead?: Arrowhead | null; endArrowhead?: Arrowhead | null; arrowheadSize?: ExcalidrawLinearElement["arrowheadSize"]; points?: ExcalidrawArrowElement["points"]; elbowed?: T; fixedSegments?: ExcalidrawElbowArrowElement["fixedSegments"] | null } & ElementConstructorOpts): T extends true ? NonDeleted<ExcalidrawElbowArrowElement> : NonDeleted<ExcalidrawArrowElement>`
- `packages/element/src/mutateElement.ts` (U04, edit) — import: `import { mutateElement, newElementWith } from "@excalidraw/element";`
  - `function mutateElement(element: TElement, elementsMap: ElementsMap, updates: ElementUpdate<TElement>): TElement`
  - `function newElementWith(element: TElement, updates: ElementUpdate<TElement>, force: boolean): TElement`
- `packages/element/src/bounds.ts` (U05, edit) — import: `import { getArrowheadSize, getArrowheadAngle, getArrowheadPoints, getElementBounds } from "@excalidraw/element";`
  - `function getArrowheadSize(arrowhead: Arrowhead, size: ArrowheadSize): number`
  - `function getArrowheadAngle(arrowhead: Arrowhead, size: number | undefined, arrowheadSize: ArrowheadSize): Degrees`
- `packages/element/src/elbowArrow.ts` (U06, edit) — import: `import { updateElbowArrowPoints, updateElbowArrowRoute } from "@excalidraw/element";`
- `packages/element/src/transform.ts` (U07, edit) — import: `import { convertToExcalidrawElements } from "@excalidraw/element";`
- `packages/element/src/renderElement.ts` (U08, edit) — import: `import { renderElement } from "@excalidraw/element";`
- `packages/excalidraw/types.ts` (U09, edit) — import: `import type { AppState } from "../types";`
  - `type AppState(): AppState`
- `packages/excalidraw/appState.ts` (U10, edit) — import: `import { getDefaultAppState } from "../appState";`
  - `function getDefaultAppState(): Omit<AppState, "offsetTop" | "offsetLeft" | "width" | "height">`
- `packages/element/src/flowchart.ts` (U11, edit) — import: `import { createFlowchart } from "@excalidraw/element";`
- `packages/element/src/convertToShape.ts` (U12, edit) — import: `import { convertToShape } from "@excalidraw/element";`
- `packages/excalidraw/data/restore.ts` (U13, edit) — import: `import { restoreElements, restoreAppState } from "../data/restore";`
  - `function restoreElements(targetElements: readonly T[] | undefined | null, existingElements: Readonly<ElementsMapOrArray> | null | undefined): CombineBrandsIfNeeded<T, OrderedExcalidrawElement>`
  - `function restoreAppState(appState: ImportedDataState["appState"], localAppState: Partial<AppState> | null | undefined): RestoredAppState`
- `packages/excalidraw/locales/en.json` (U14, edit)
- `packages/excalidraw/actions/types.ts` (U15, edit) — import: `import type { ActionName } from "./types";`
  - `type ActionName(): ActionName`
- `packages/excalidraw/actions/actionProperties.tsx` (U16, edit) — import: `import { actionChangeArrowheadSize } from "./actionProperties";`
  - `const actionChangeArrowheadSize(): Action`
- `packages/excalidraw/actions/index.ts` (U17, edit) — import: `import { actionChangeArrowheadSize } from "../actions";`
  - `const actionChangeArrowheadSize(): Action`
- `packages/excalidraw/actions/actionStyles.ts` (U18, edit) — import: `import { actionCopyStyles, actionPasteStyles } from "./actionStyles";`
- `packages/excalidraw/components/ConvertElementTypePopup.tsx` (U19, edit)
- `packages/excalidraw/components/App.drawshape.ts` (U20, edit)
- `packages/excalidraw/components/App.tsx` (U21, edit)
- `packages/excalidraw/CHANGELOG.md` (U22, edit)
- `packages/excalidraw/tests/helpers/api.ts` (U23, edit) — import: `import { API } from "./helpers/api";`
  - `class API(): API`
- `packages/element/tests/bounds.test.ts` (U24, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U25, edit)
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (U26, create)
