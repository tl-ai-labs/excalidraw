## Conventions

- Use TypeScript with strict null checks and explicit `readonly` array/object types for element data models.
- Use 2-space indentation, double quotes, trailing commas, and semicolons matching the repository Prettier and ESLint configuration.
- Order imports with external/workspace packages (`@excalidraw/common`, `@excalidraw/math`, `@excalidraw/element`) first, followed by relative imports and `import type` declarations.
- Keep all functions in `packages/element/src/textStyleRanges.ts` pure and side-effect-free: never mutate input range arrays or range objects in place.
- Write tests using Vitest (`describe`, `it`, `expect`, `vi`) and `@testing-library/react` helpers (`render`, `fireEvent`, `act`, `API`, `UI`, `Keyboard`, `Pointer`).

## Decisions

- Persisted `textStyleRanges` representation on `ExcalidrawTextElement`: Store `TextStyleRange` entries as `{ readonly start: number; readonly end: number; readonly strokeColor?: string; readonly backgroundColor?: string }` in 0-based end-exclusive UTF-16 code-unit offsets into `element.originalText`, and set `textStyleRanges` as a standard enumerable own property (`normalizeTextStyleRanges(...)`, defaulting to `[]`) on `ExcalidrawTextElement` in `newTextElement`, `restoreElement`, `deepCopyElement`, `ElementsDelta.applyDelta`, and clipboard serialize/parse. (not Storing line-relative offsets into `element.text`; not Defining a non-enumerable hidden accessor via `Object.defineProperty` on text elements; not Embedding HTML/Markdown tags in `originalText`) — `originalText` offsets survive line wrapping and reflow, and a standard enumerable own `textStyleRanges` array (defaulting to `[]`) is preserved across all object spreads (`newElementWith` / `mutateElement`), JSON serialisation, clipboard copy/paste, restore, duplication, and history deltas.
- Canonical range normalisation and overlap resolution: Use elementary interval decomposition over all range boundary points in `normalizeTextStyleRanges` and `applyTextStyleRange` so later ranges override earlier ranges per property (`strokeColor` vs `backgroundColor` independently), drop ranges with `start >= end` or neither style set, drop `backgroundColor: "transparent"` and `strokeColor === elementStrokeColor`, sort by `start`, and merge adjacent intervals with identical `strokeColor` and `backgroundColor`. (not Allowing overlapping ranges at render time; not Replacing the entire style object when only one of `strokeColor` or `backgroundColor` is applied) — Elementary interval decomposition guarantees deterministic, non-overlapping canonical ranges while preserving orthogonal inline styles (`strokeColor` when applying `backgroundColor`, and vice versa).
- WYSIWYG inline selection tracking vs initial mount auto-select: Track the active textarea selection in `packages/excalidraw/wysiwyg/textWysiwyg.tsx` and expose `getActiveTextWysiwygSelection(element?)`, treating the initial mount `editable.select()` (when `autoSelect && !pendingInitialSelection`) as non-inline until the selection is set via `initialSelection` or changed after mount via `setSelectionRange`, `selectionStart`/`selectionEnd` setters, or user selection events, and preserving the last active selection when clicking properties UI. (not Treating `editable.selectionStart < editable.selectionEnd` on initial mount as an active inline range selection; not Reading `document.activeElement` only at action execution time without preserving selection across properties UI pointerdown) — On editor open, `editable.select()` selects all text by default; excluding the untouched initial auto-select preserves existing element-wide and sticky-note colour picker behaviour when no explicit substring selection has been made.
- Inline highlight colour picker availability during text editing: Render `app.actionManager.renderAction("changeBackgroundColor")` inside `actionChangeStrokeColor.PanelComponent` when `appState.editingTextElement` is active and not bound to a sticky note (since sticky-note labels already render `changeBackgroundColor`), and resolve `resolveColorTarget` for `backgroundColor` to the `regular` domain (including `"transparent"`) when `getActiveTextWysiwygSelection` is active. (not Modifying `getShapeActionPredicates` in `shapeActionPredicates.ts` to enable `backgroundColor` for all text elements; not Creating a separate action registration for text highlight colour) — Existing tests assert `getShapeActionPredicates(...).backgroundColor === false` for plain text elements and `shapeActionPredicates.ts` is outside the write allowlist; rendering `changeBackgroundColor` inside `actionChangeStrokeColor.PanelComponent` when editing non-sticky text exposes inline highlight controls and allows `"transparent"` to clear highlights.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { TextStyleRange, ExcalidrawTextElement } from "@excalidraw/element/types";`
  - `type TextStyleRange(): { readonly start: number; readonly end: number; readonly strokeColor?: string; readonly backgroundColor?: string }`
  - `type ExcalidrawTextElement(): ExcalidrawTextElement`
- `packages/element/src/textStyleRanges.ts` (U02, create) — import: `import { normalizeTextStyleRanges, applyTextStyleRange, shiftTextStyleRangesOnEdit, getWrappedLineTextRuns, getWrappedTextLinesForElement, getTextElementLineRuns, getSelectionTextStyle, areTextStyleRangesEqual, type TextStyleRange, type TextStyleRun } from "./textStyleRanges";`
  - `type TextStyleRange(): TextStyleRange`
  - `type TextStyleRun(): { readonly text: string; readonly start: number; readonly end: number; readonly strokeColor?: string; readonly backgroundColor?: string }`
  - `function normalizeTextStyleRanges(ranges: readonly TextStyleRange[] | null | undefined, textLength: number, elementStrokeColor: string | undefined): TextStyleRange[]`
  - `function applyTextStyleRange(ranges: readonly TextStyleRange[] | null | undefined, textLength: number, selection: { readonly start: number; readonly end: number }, style: { readonly strokeColor?: string; readonly backgroundColor?: string }, elementStrokeColor: string | undefined): TextStyleRange[]`
  - `function shiftTextStyleRangesOnEdit(ranges: readonly TextStyleRange[] | null | undefined, prevText: string, nextText: string): TextStyleRange[]`
  - `function getWrappedLineTextRuns(line: WrappedTextLine, ranges: readonly TextStyleRange[] | null | undefined): TextStyleRun[]`
  - `function getWrappedTextLinesForElement(element: Pick<ExcalidrawTextElement, "text" | "originalText" | "fontSize" | "fontFamily" | "width" | "autoResize">, maxWidth: number | undefined, env: RenderEnvironment | undefined): WrappedTextLine[]`
  - `function getTextElementLineRuns(element: Pick<ExcalidrawTextElement, "text" | "originalText" | "fontSize" | "fontFamily" | "width" | "autoResize" | "textStyleRanges" | "strokeColor">, env: RenderEnvironment | undefined, maxWidth: number | undefined): TextStyleRun[][]`
  - `function getSelectionTextStyle(element: Pick<ExcalidrawTextElement, "originalText" | "strokeColor" | "textStyleRanges">, selection: { readonly start: number; readonly end: number }): { strokeColor: string | null; backgroundColor: string | null }`
  - `function areTextStyleRangesEqual(a: readonly TextStyleRange[] | null | undefined, b: readonly TextStyleRange[] | null | undefined): boolean`
- `packages/element/src/index.ts` (U03, edit) — import: `import { normalizeTextStyleRanges, applyTextStyleRange, shiftTextStyleRangesOnEdit, getWrappedLineTextRuns, getTextElementLineRuns, getSelectionTextStyle } from "@excalidraw/element";`
  - `function normalizeTextStyleRanges(ranges: readonly TextStyleRange[] | null | undefined, textLength: number, elementStrokeColor: string | undefined): TextStyleRange[]`
  - `function applyTextStyleRange(ranges: readonly TextStyleRange[] | null | undefined, textLength: number, selection: { readonly start: number; readonly end: number }, style: { readonly strokeColor?: string; readonly backgroundColor?: string }, elementStrokeColor: string | undefined): TextStyleRange[]`
  - `function shiftTextStyleRangesOnEdit(ranges: readonly TextStyleRange[] | null | undefined, prevText: string, nextText: string): TextStyleRange[]`
  - `function getWrappedLineTextRuns(line: WrappedTextLine, ranges: readonly TextStyleRange[] | null | undefined): TextStyleRun[]`
  - `function getTextElementLineRuns(element: Pick<ExcalidrawTextElement, "text" | "originalText" | "fontSize" | "fontFamily" | "width" | "autoResize" | "textStyleRanges" | "strokeColor">, env: RenderEnvironment | undefined, maxWidth: number | undefined): TextStyleRun[][]`
  - `function getSelectionTextStyle(element: Pick<ExcalidrawTextElement, "originalText" | "strokeColor" | "textStyleRanges">, selection: { readonly start: number; readonly end: number }): { strokeColor: string | null; backgroundColor: string | null }`
- `packages/element/src/newElement.ts` (U04, edit) — import: `import { newTextElement } from "@excalidraw/element";`
  - `function newTextElement(opts: ElementConstructorOpts & { text: string; textStyleRanges?: ExcalidrawTextElement["textStyleRanges"] }): NonDeleted<ExcalidrawTextElement>`
- `packages/element/src/renderElement.ts` (U05, edit)
- `packages/element/src/duplicate.ts` (U06, edit)
- `packages/element/src/transform.ts` (U07, edit)
- `packages/element/src/delta.ts` (U08, edit)
- `packages/excalidraw/renderer/staticSvgScene.ts` (U09, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U10, edit) — import: `import { getActiveTextWysiwygSelection } from "../wysiwyg/textWysiwyg";`
  - `function getActiveTextWysiwygSelection(element: Pick<ExcalidrawTextElement, "id" | "originalText"> | null | undefined): { start: number; end: number } | null`
- `packages/excalidraw/components/App.text.ts` (U11, edit)
- `packages/excalidraw/actions/colorTargets.ts` (U12, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U13, edit)
- `packages/excalidraw/data/restore.ts` (U14, edit)
- `packages/excalidraw/clipboard.ts` (U15, edit) — import: `import { serializeAsClipboardJSON, parseClipboard, createPasteEvent, parseDataTransferEvent } from "../clipboard";`
  - `function serializeAsClipboardJSON(elements: readonly NonDeletedExcalidrawElement[], files: BinaryFiles | null): string`
  - `function parseClipboard(event: ClipboardEvent, isPlainPaste: boolean | undefined): Promise<ParsedClipboard>`
- `packages/excalidraw/CHANGELOG.md` (U16, edit)
- `packages/element/tests/textStyleRanges.test.ts` (U17, create)
- `packages/element/tests/textWrapping.test.ts` (U18, edit)
- `packages/excalidraw/tests/colorTargets.test.ts` (U19, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U20, edit)
- `packages/excalidraw/tests/textStyleRanges.test.tsx` (U21, create)
