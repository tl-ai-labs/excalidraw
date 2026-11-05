## Conventions

- TypeScript strict; no `any`, no new `@ts-ignore`; type-only imports use `import type` on their own line, as the surrounding file does.
- Formatting is Prettier via @excalidraw/prettier-config (80 columns, double quotes, trailing commas, semicolons); for .ts/.tsx it is enforced through ESLint's prettier/prettier rule (the `eslint` check and its --fix), while the standalone `prettier` check judges only .json/.md files. ESLint also enforces import order (external packages, then @excalidraw/* aliases, then relative, then type imports).
- Import across packages through the path aliases (`@excalidraw/element`, `@excalidraw/element/types`, `@excalidraw/common`, `@excalidraw/math`), never through relative paths that climb out of a package; inside packages/element/src import siblings relatively (`./bounds`, `./types`).
- Prefer `Merge<Base, Overrides>` for type overrides (AGENTS.md); keep new element properties `Readonly` like their neighbours.
- Tests run on Vitest with globals (`describe`, `it`, `expect` without import); build elements with `API.createElement` from `@excalidraw/excalidraw/tests/helpers/api`; assert with `expect(...).toBe/toEqual/toBeLessThan/toBeGreaterThan`; test names are lower-case sentences.
- User-facing strings go through `t("labels.<key>")`; new keys are added to packages/excalidraw/locales/en.json only, next to the existing arrowhead labels; no other locale file is touched.
- Default (medium or absent) arrowhead size must produce exactly today's numbers: every scaled expression multiplies by `getArrowheadSizeScale(...)`, which returns the literal 1 for medium/absent, so no rounding drift reaches existing snapshots.
- Do not change any existing function's behaviour beyond the arrowhead-size scaling; do not rename or reorder existing exports, element fields or appState keys.

## Decisions

- Preset type and its home: `export type ArrowheadSize = "small" | "medium" | "large";` in packages/element/src/types.ts directly after `AnyArrowhead`; `ExcalidrawLinearElement` gains `arrowheadSize?: ArrowheadSize;` (optional, inside its Readonly block, after `endArrowhead`). Imported as `import type { ArrowheadSize } from "@excalidraw/element/types";`. (not separate startArrowheadSize/endArrowheadSize; not numeric scale stored on the element) — Gate 1 approved one preset for both heads, stored as string names; optional keeps old elements valid and additive for older clients.
- Scale helper and constants: packages/element/src/bounds.ts exports `DEFAULT_ARROWHEAD_SIZE: ArrowheadSize = "medium"`, `ARROWHEAD_SIZE_SCALES: Readonly<Record<ArrowheadSize, number>> = { small: 0.5, medium: 1, large: 1.5 }`, `isArrowheadSize(value: unknown): value is ArrowheadSize` and `getArrowheadSizeScale(arrowheadSize: ArrowheadSize | null | undefined): number` (returns 1 for null/undefined/unknown). All reach consumers through the existing `export * from "./bounds"` in packages/element/src/index.ts, imported from `@excalidraw/element`. (not a new arrowheadSize.ts module; not constants in @excalidraw/common) — bounds.ts already owns getArrowheadSize and is re-exported, so no new file or index edit is needed.
- Where the scale is applied in geometry: Only `getArrowheadPoints` scales: `const scale = getArrowheadSizeScale(element.arrowheadSize); const size = getArrowheadSize(arrowhead) * scale;` and the angle becomes `getArrowheadAngle(arrowhead, minSize / scale)`. `getArrowheadSize`, `getArrowheadAngle`, `getArrowheadSizeBeyondLastSegment` and `getCardinalityMarkerScale` keep their signatures and bodies. (not adding an element parameter to getArrowheadSize; not scaling inside getArrowheadSizeBeyondLastSegment) — The existing fitting already clamps to `size` (Math.min(size, ...)), so the fitted size never exceeds the scaled size and the fitting algorithm is untouched; dividing by scale keeps a small/large head the same shape as a default one.
- Default on creation: `newLinearElement` and `newArrowElement` accept `arrowheadSize?: ArrowheadSize | null` and add the key only when it is a non-medium preset (`...(opts.arrowheadSize && opts.arrowheadSize !== DEFAULT_ARROWHEAD_SIZE ? { arrowheadSize: opts.arrowheadSize } : {})`). (not always writing arrowheadSize: "medium") — FR-3/NFR-1: default elements serialize byte-identically, so existing element snapshots do not change.
- What the action writes: `changeArrowheadSize` writes the chosen preset verbatim (including "medium") with `newElementWith` on every selected linear element (arrow or line), sets `appState.currentItemArrowheadSize`, and returns `captureUpdate: CaptureUpdateAction.IMMEDIATELY`. Its value is an `ArrowheadSize`. (not deleting the key when medium is chosen) — newElementWith creates a new element object, so ShapeCache (a WeakMap keyed by element) regenerates; an explicit value round-trips through the generic delta like any other field.
- App state default and storage: `AppState.currentItemArrowheadSize: ArrowheadSize`, default `"medium"` in getDefaultAppState placed after `currentItemEndArrowhead`, storage `{ browser: true, export: false, server: false }`. restoreAppState replaces an invalid value with the default via `isArrowheadSize`. — Mirrors currentItemStartArrowhead (FR-13/FR-15).
- Restore of elements: In restoreElement's line and arrow branches, pass `arrowheadSize` in the extra object only when `isArrowheadSize(element.arrowheadSize)`; when the stored value is invalid, delete it from the result; never add the key to an element that lacked it. — FR-14: old files restore unchanged; restoreElementWithProperties spreads the original element, so an invalid value must be removed explicitly.
- Panel control placement and labels: The control is the repo's `RadioSelection<ArrowheadSize>` (what this repo uses where the brief says ButtonIconSelect; no ButtonIconSelect component exists) with `group="arrowhead-size"`, options small/medium/large reusing the already-imported `FontSizeSmallIcon` / `FontSizeMediumIcon` / `FontSizeLargeIcon` (S / M / L glyphs) and testIds `arrowheadSize-small`, `arrowheadSize-medium`, `arrowheadSize-large`. It renders wherever `renderAction("changeArrowhead")` renders: right after it in Actions.tsx (same condition) and in actionChangeArrowProperties' PanelComponent (compact popover). en.json keys: `labels.arrowheadSize` = "Arrowhead size", `labels.arrowheadSize_small` = "Small", `labels.arrowheadSize_medium` = "Medium", `labels.arrowheadSize_large` = "Large". (not new SVG icons in icons.tsx; not a dropdown or slider; not a new ButtonIconSelect component) — Smallest change that satisfies FR-10/FR-11; icons.tsx stays untouched and the S/M/L glyphs already exist.
- Files in scope that need no edit: No edit to delta.ts, reconcile.ts, shape.ts, renderElement.ts, index.ts, icons.tsx or ConvertElementTypePopup.tsx. — delta/reconcile apply element properties generically via newElementWith; shape.ts and the canvas path draw from getArrowheadPoints, which reads element.arrowheadSize, and ShapeCache is keyed by element object so any newElementWith update regenerates; the arrow canvas padding (40) already covers a large head; index.ts re-exports bounds.ts; ConvertElementTypePopup spreads the source element into newLinearElement/newArrowElement, so the size carries over through the new option.
- What 'bounds follow the size' means: Linear element bounds are computed from the shaft curve only (getLinearElementRotatedBounds uses the first drawable); arrowhead geometry lives in getArrowheadPoints in bounds.ts, so AC-3 is asserted on getArrowheadPoints extents in bounds.test.ts. (not adding arrowhead extents to getElementBounds) — Adding heads to element bounds would change existing element bounds and snapshots, which NFR-1 forbids.
- Where the AC-4 panel/action test lives: In packages/excalidraw/tests/scene/export.test.ts, in a new `arrowhead size` describe block that also holds AC-1, rendering the editor with `React.createElement(Excalidraw)` (the file is .ts). (not packages/excalidraw/actions/actionProperties.test.tsx) — The frozen allowlist holds only restore.test.ts, export.test.ts, bounds.test.ts and shape.test.ts as test files.
- Snapshot updates: No unit writes snapshots: the appState snapshots that gain `currentItemArrowheadSize: "medium"` live in packages/excalidraw/tests/__snapshots__/ (contextmenu, history, regressionTests .snap), which the frozen allowlist's `tests/**/__snapshots__/**` glob does not match per plan-lint. They are updated by the orchestrator or person with `yarn vitest run --update` on those three test files only; element snapshot entries must not change. (not `yarn test:update` over the whole suite; not tooling units at those paths (refused: outside the allowlist)) — Limits rewrites to the appState snapshots the change is expected to touch, so an accidental element-snapshot drift still fails the project test run.

## Files of this change

- `packages/element/src/types.ts` (U01, edit)
  - `type ArrowheadSize(): "small" | "medium" | "large"`
- `packages/element/src/bounds.ts` (U02, edit) — import: `import { DEFAULT_ARROWHEAD_SIZE, ARROWHEAD_SIZE_SCALES, isArrowheadSize, getArrowheadSizeScale } from "@excalidraw/element";`
  - `const DEFAULT_ARROWHEAD_SIZE(): ArrowheadSize`
  - `const ARROWHEAD_SIZE_SCALES(): Readonly<Record<ArrowheadSize, number>>`
  - `function isArrowheadSize(value: unknown): value is ArrowheadSize`
  - `function getArrowheadSizeScale(arrowheadSize: ArrowheadSize | null | undefined): number`
- `packages/element/src/newElement.ts` (U03, edit)
- `packages/element/src/elbowArrow.ts` (U04, edit)
- `packages/element/src/transform.ts` (U05, edit)
- `packages/excalidraw/types.ts` (U06, edit)
- `packages/excalidraw/appState.ts` (U07, edit)
- `packages/excalidraw/components/App.tsx` (U08, edit)
- `packages/excalidraw/components/App.drawshape.ts` (U09, edit)
- `packages/element/src/flowchart.ts` (U10, edit)
- `packages/element/src/convertToShape.ts` (U11, edit)
- `packages/excalidraw/data/restore.ts` (U12, edit)
- `packages/excalidraw/locales/en.json` (U13, edit)
- `packages/excalidraw/actions/types.ts` (U14, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U15, edit) — import: `import { actionChangeArrowheadSize } from "../actions/actionProperties";`
  - `const actionChangeArrowheadSize(): Action<ArrowheadSize>`
- `packages/excalidraw/components/Actions.tsx` (U16, edit)
- `packages/excalidraw/actions/actionStyles.ts` (U17, edit)
- `packages/excalidraw/tests/helpers/api.ts` (U18, edit)
- `packages/element/tests/bounds.test.ts` (U19, edit)
- `packages/element/tests/shape.test.ts` (U20, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U21, edit)
- `packages/excalidraw/tests/scene/export.test.ts` (U22, edit)
- `packages/excalidraw/CHANGELOG.md` (U23, edit)
- `.gitignore` (U24, edit)
