## Conventions

- Format all TypeScript, TSX, JSON, and Markdown files with Prettier (@excalidraw/prettier-config) and lint TypeScript/TSX with ESLint (--max-warnings=0).
- Group imports by external packages first (@excalidraw/math, @excalidraw/common, @excalidraw/element), then internal relative imports, then type-only imports (`import type { ... }`).
- Omit `arrowheadSize` from linear elements when at the default Medium scale (`1`); never store `arrowheadSize: 1` or `arrowheadSize: undefined` as an own property on constructed or restored elements.
- Only English locale strings (`packages/excalidraw/locales/en.json`) are edited; other locale files are synced externally and are off-limits.
- Use Vitest (`describe`, `it`, `expect`, `vi`) and `@testing-library/react` helpers from `packages/excalidraw/tests/test-utils.ts` for tests.

## Decisions

- Element property representation and default omission: Optional `arrowheadSize?: ArrowheadSize` (number scale factor in `[0.5, 1.5]`, presets Small = `0.5`, Medium = `1`, Large = `1.5`) on `ExcalidrawLinearElement`, omitted when equal to `1` (`DEFAULT_ARROWHEAD_SIZE`). (not Always storing `arrowheadSize: 1` on linear elements; not Separate `startArrowheadSize` and `endArrowheadSize` properties; not String enum `'small' | 'medium' | 'large'`) — Omitting the default value keeps all existing element and render snapshots unchanged and preserves backward compatibility with saved scenes while allowing numeric scale factors in [0.5, 1.5].
- Shared arrowhead size constants and validator placement: Export `ARROWHEAD_SIZES`, `DEFAULT_ARROWHEAD_SIZE`, `MIN_ARROWHEAD_SIZE`, `MAX_ARROWHEAD_SIZE`, and `isValidArrowheadSize` from `packages/element/src/bounds.ts` (re-exported via `@excalidraw/element`) and `ArrowheadSize` from `packages/element/src/types.ts` (re-exported via `@excalidraw/element/types`). (not Adding constants to `packages/common/src/constants.ts`; not Duplicating magic numbers across element and excalidraw packages) — `packages/common` is outside the Gate 0 write allowlist, whereas `packages/element/src/bounds.ts` is in scope and re-exported by `packages/element/src/index.ts`.
- New arrow default size state (Gate 0 Option A): Store `currentItemArrowheadSize: ArrowheadSize` (default `1`) in `AppState` with storage config `{ browser: true, export: false, server: false }` and pass it to `newArrowElement` in `App.tsx`. (not Deriving default arrowhead size only from selected elements without AppState persistence; not Persisting `currentItemArrowheadSize` to exported scene files or server) — Option A was chosen at Gate 0 so users can preconfigure arrowhead size with no selection and persist the preference locally in the browser.
- Secondary `getArrowheadSize` readers (`elbowArrow.ts` and `transform.ts`): Pass `arrow.arrowheadSize` as the second argument to `getArrowheadSize` in `packages/element/src/elbowArrow.ts` minimum leg checks and `packages/element/src/transform.ts` `clampLabelPositionOffEnds`. (not Leaving elbow routing and skeleton label clearance unscaled at 1x) — Scaling both readers keeps elbow leg clearances and bound label margins proportional to the rendered arrowhead while remaining byte-identical when `arrowheadSize` is undefined.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { ArrowheadSize, ExcalidrawLinearElement } from "@excalidraw/element/types";`
  - `type ArrowheadSize(): number`
  - `type ExcalidrawLinearElement(): ExcalidrawLinearElement`
- `packages/element/src/bounds.ts` (U02, edit) — import: `import { ARROWHEAD_SIZES, DEFAULT_ARROWHEAD_SIZE, MIN_ARROWHEAD_SIZE, MAX_ARROWHEAD_SIZE, isValidArrowheadSize, getArrowheadSize, getArrowheadAngle, getArrowheadPoints } from "@excalidraw/element";`
  - `const ARROWHEAD_SIZES(): { readonly small: 0.5; readonly medium: 1; readonly large: 1.5 }`
  - `const DEFAULT_ARROWHEAD_SIZE(): ArrowheadSize`
  - `const MIN_ARROWHEAD_SIZE(): ArrowheadSize`
  - `const MAX_ARROWHEAD_SIZE(): ArrowheadSize`
  - `function isValidArrowheadSize(value: unknown): value is ArrowheadSize`
  - `function getArrowheadSize(arrowhead: Arrowhead, scale: ArrowheadSize): number`
  - `function getArrowheadAngle(arrowhead: Arrowhead, size: number, scale: ArrowheadSize): Degrees`
- `packages/element/src/newElement.ts` (U03, edit) — import: `import { newLinearElement, newArrowElement } from "@excalidraw/element";`
  - `function newLinearElement(opts: { type: ExcalidrawLinearElement["type"]; points?: ExcalidrawLinearElement["points"]; polygon?: ExcalidrawLineElement["polygon"]; arrowheadSize?: ArrowheadSize } & ElementConstructorOpts): NonDeleted<ExcalidrawLinearElement>`
  - `function newArrowElement(opts: { type: ExcalidrawArrowElement["type"]; startArrowhead?: Arrowhead | null; endArrowhead?: Arrowhead | null; arrowheadSize?: ArrowheadSize; points?: ExcalidrawArrowElement["points"]; elbowed?: T; fixedSegments?: ExcalidrawElbowArrowElement["fixedSegments"] | null } & ElementConstructorOpts): T extends true ? NonDeleted<ExcalidrawElbowArrowElement> : NonDeleted<ExcalidrawArrowElement>`
- `packages/element/src/elbowArrow.ts` (U04, edit)
- `packages/element/src/transform.ts` (U05, edit)
- `packages/excalidraw/types.ts` (U06, edit) — import: `import type { AppState } from "@excalidraw/excalidraw/types";`
  - `type AppState(): AppState`
- `packages/excalidraw/appState.ts` (U07, edit) — import: `import { getDefaultAppState } from "../appState";`
  - `function getDefaultAppState(): Omit<AppState, "offsetTop" | "offsetLeft" | "width" | "height">`
- `packages/excalidraw/data/restore.ts` (U08, edit) — import: `import { restoreElement, restoreElements, restoreAppState } from "../data/restore";`
  - `function restoreElement(element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>, targetElementsMap: Readonly<ElementsMap>, existingElementsMap: Readonly<ElementsMap> | null | undefined, opts: { deleteInvisibleElements?: boolean }): typeof element | null`
  - `function restoreAppState(appState: ImportedDataState["appState"], localAppState: Partial<AppState> | null | undefined): RestoredAppState`
- `packages/excalidraw/locales/en.json` (U09, edit)
- `packages/excalidraw/components/icons.tsx` (U10, edit) — import: `import { ArrowheadSizeSmallIcon, ArrowheadSizeMediumIcon, ArrowheadSizeLargeIcon } from "../components/icons";`
  - `const ArrowheadSizeSmallIcon(): JSX.Element`
  - `const ArrowheadSizeMediumIcon(): JSX.Element`
  - `const ArrowheadSizeLargeIcon(): JSX.Element`
- `packages/excalidraw/actions/types.ts` (U11, edit) — import: `import type { ActionName } from "../actions/types";`
  - `type ActionName(): ActionName`
- `packages/excalidraw/actions/actionProperties.tsx` (U12, edit) — import: `import { actionChangeArrowheadSize } from "../actions/actionProperties";`
  - `const actionChangeArrowheadSize(): Action<ArrowheadSize>`
- `packages/excalidraw/components/Actions.tsx` (U13, edit)
- `packages/excalidraw/components/App.tsx` (U14, edit)
- `packages/excalidraw/actions/actionStyles.ts` (U15, edit)
- `packages/excalidraw/CHANGELOG.md` (U16, edit)
- `packages/element/tests/bounds.test.ts` (U17, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U18, edit)
- `packages/excalidraw/tests/arrowheadSize.test.tsx` (U19, create)
