## Conventions

- Format all TypeScript, TSX, JSON, and Markdown files with Prettier (2-space indent, double quotes, trailing commas) and lint TS/TSX with ESLint.
- Group imports with blank lines between external packages, @excalidraw/* workspace value imports, @excalidraw/* type-only imports, relative value imports, and relative type-only imports; use `import type` for type-only imports.
- Omit `arrowheadSize` on newly created or restored linear elements when `arrowheadSize === undefined` so default element shapes and existing snapshots are unchanged.
- Use Vitest (`describe`, `it`, `expect`) and `@testing-library/react` (`fireEvent`, `queryByTestId`) with `API` test helpers for unit and component tests.
- Add English UI strings only to `packages/excalidraw/locales/en.json`; never edit other locale files.

## Decisions

- Arrowhead size multiplier representation and preset values: Optional `arrowheadSize?: number` on `ExcalidrawLinearElement` defaulting to `1` when omitted, with UI presets Small = `0.5`, Medium = `1`, Large = `1.5` (not String union ('small' | 'medium' | 'large') on the element; not Global AppState currentItemArrowheadSize property) — A numeric multiplier supports arbitrary positive finite values in scene JSON and skeleton API while keeping presets simple and avoiding off-limits AppState changes.
- Arrowhead size radio option testIds and i18n label key: Use `data-testid` values `"arrowhead-size-small"`, `"arrowhead-size-medium"`, and `"arrowhead-size-large"` with group `"arrowhead-size"` and label key `"labels.arrowheadSize"` (not CamelCase testIds without hyphens; not Unlabeled buttons without data-testid) — Matches FR-12 and provides deterministic selectors for properties panel tests.
- Clearing arrowheadSize on undo/redo and style paste: When applying a delta or pasting styles with `arrowheadSize: undefined`, pass `force = true` to `newElementWith` and `delete` the `arrowheadSize` property from the resulting element (not Calling `newElementWith(el, { arrowheadSize: undefined })` without `force` or leaving `arrowheadSize: undefined` as an own property) — `newElementWith` ignores `undefined` values unless `force = true`, and deleting the key restores the omitted-property state.

## Files of this change

- `packages/element/src/types.ts` (U01, edit)
  - `type ExcalidrawLinearElement(): ExcalidrawLinearElement`
- `packages/element/src/bounds.ts` (U02, edit)
  - `function getArrowheadSize(arrowhead: Arrowhead, arrowheadSize: number): number`
  - `function getArrowheadAngle(arrowhead: Arrowhead, size: number, arrowheadSize: number): Degrees`
- `packages/element/src/shape.ts` (U03, edit)
- `packages/element/src/renderElement.ts` (U04, edit)
  - `function getCanvasPadding(element: ExcalidrawElement): number`
- `packages/element/src/newElement.ts` (U05, edit)
- `packages/element/src/elbowArrow.ts` (U06, edit)
- `packages/element/src/transform.ts` (U07, edit)
- `packages/element/src/delta.ts` (U08, edit)
- `packages/excalidraw/locales/en.json` (U09, edit)
- `packages/excalidraw/data/restore.ts` (U10, edit)
- `packages/excalidraw/actions/types.ts` (U11, edit)
  - `type ActionName(): ActionName`
- `packages/excalidraw/components/shapeActionPredicates.ts` (U12, edit)
  - `const CHANGE_ARROWHEAD_SIZE_TYPES(): Set<ElementOrToolType>`
  - `function canChangeArrowheadSize(type: ElementOrToolType): boolean`
- `packages/excalidraw/actions/actionProperties.tsx` (U13, edit)
  - `const actionChangeArrowheadSize(): Action`
- `packages/excalidraw/components/Actions.tsx` (U14, edit)
- `packages/excalidraw/actions/actionStyles.ts` (U15, edit)
- `packages/excalidraw/tests/helpers/api.ts` (U16, edit)
- `packages/element/tests/bounds.test.ts` (U17, edit)
- `packages/element/tests/shape.test.ts` (U18, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U19, edit)
- `packages/excalidraw/tests/scene/export.test.ts` (U20, edit)
- `packages/excalidraw/actions/actionProperties.test.tsx` (U21, edit)
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx` (U22, edit)
- `packages/excalidraw/CHANGELOG.md` (U23, edit)
