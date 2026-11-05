## Conventions

- Formatting uses Prettier (2-space indent, double quotes, trailing commas where valid, 80-char printWidth) and ESLint (--max-warnings=0).
- TypeScript strict mode is enabled; use type-only imports (import type { ... }) after value imports, separated by blank lines between external, @excalidraw/* workspace, and relative imports.
- Never mutate ExcalidrawElement instances directly in place; use newElementWith or scene.mutateElement so version and versionNonce bump for history and collaboration.
- All user-facing UI strings must be looked up through t("labels.*") from packages/excalidraw/i18n.ts and defined in packages/excalidraw/locales/en.json.
- Tests use Vitest and @testing-library/react with helpers from packages/excalidraw/tests/test-utils.ts, packages/excalidraw/tests/helpers/api.ts, and packages/excalidraw/tests/helpers/ui.ts.

## Decisions

- ExcalidrawTextElement styled ranges field name and empty representation: Optional field textStyles?: readonly TextRangeStyle[] where TextRangeStyle = Readonly<{ start: number; end: number; color?: string; highlight?: string }>, omitted (undefined / key not set) when empty (not Always setting textStyles: [] on every text element; not Indexing ranges into wrapped element.text instead of element.originalText) — Omitting textStyles when empty keeps unstyled text elements byte-identical in memory and serialized JSON, preserving existing test snapshots and backward compatibility while indexing by UTF-16 code-unit offsets into originalText survives wrapping and resizing.
- Boundary behavior when typing at the end of a styled range: Pure insertions at offset pos where range.start < pos <= range.end extend range.end by insertedLen; pure insertions at pos <= range.start shift both start and end right by insertedLen (not Leaving range.end unchanged when typing at pos === range.end) — Extending on insertion at range.end matches standard rich-text editor behavior where continuing to type at the end of a coloured or highlighted word continues that style.
- Clearing range colour or highlight and resolving overlapping ranges: Applying color === "transparent", null, or equal to element.strokeColor clears color on the selected span while preserving highlight; applying highlight === "transparent" or null clears highlight while preserving color; later ranges override earlier ranges per style attribute and adjacent identical ranges merge (not Storing redundant color entries equal to element.strokeColor or "transparent" in textStyles; not Clearing both color and highlight when only one attribute is reset) — Independent attribute clearing lets users remove highlight without losing text colour (or vice versa) and drops ranges that have neither attribute left.
- Per-line LTR vs bidi/RTL run positioning on Canvas and SVG: Use isRTL(element.text) only for element base direction, and branch run horizontal positioning per visual line on hasRTLChars(line.text): pure-LTR lines (!hasRTLChars(line.text)) use left-prefix getLineWidth measurement, while lines with hasRTLChars(line.text) segment into directional bidi runs, order them visually via UAX#9 level reversal relative to base direction, and accumulate getLineWidth across visual runs (not Branching run positioning on element-level isRTL(element.text) alone; not Relying solely on DOM Range.getBoundingClientRect() which returns zero widths in jsdom/non-DOM environments) — An LTR-first line containing RTL tokens has isRTL(element.text) === false but hasRTLChars(line.text) === true; per-line hasRTLChars detection with UAX#9 visual-order width accumulation produces accurate run x/width on both browser canvas and SVG export as well as Vitest/jsdom.
- WYSIWYG live preview of styled ranges and selection preservation across properties panel clicks: Render a synchronized mirror div (.excalidraw-wysiwyg-preview) behind the textarea with styled <span> runs while setting textarea color/-webkit-text-fill-color to transparent and caretColor to the dark-mode-filtered strokeColor when textStyles is non-empty, and cache the textarea selection range so clicking Stroke or Highlight pickers applies to the selected substring and restores the selection (not Replacing the textarea with a contentEditable div; not Only showing styled ranges after exiting the text editor) — Keeping the native textarea preserves all existing keyboard, IME, paste, list-marker, and test interactions while the synchronized mirror layer displays per-range colour and highlight live during editing.
- Highlight colour picker popup id isolation and sticky-note ink sync: Add "textHighlight" to AppState["openPopup"] in types.ts, map openPopup: "elementBackground" from ColorPicker's updateData to "textHighlight" in actionChangeTextHighlight.perform, and in actionChangeTextHighlight.PanelComponent pass ColorPicker an appState view that maps "textHighlight" <-> "elementBackground" (and maps a real "elementBackground" to "canvasBackground" so ColorPicker sees openPopup !== type), while in actionChangeStrokeColor bypassing element.strokeColor, currentItemStrokeColor, and syncStickyNoteInk when editingTextElement has a non-empty selection (start < end) (not Sharing appState.openPopup === "elementBackground" between actionChangeBackgroundColor and actionChangeTextHighlight; not Withholding actionChangeBackgroundColor while editing a sticky-note label (which breaks sticky-note background editing during label edit); not Using component-local useState for popup state without updating appState.openPopup) — ColorPicker.tsx (not on the allowlist) opens when appState.openPopup === type and accepts only ColorPickerType values; storing "textHighlight" in AppState["openPopup"] and translating at actionChangeTextHighlight's boundary lets both the sticky-note background picker and the text highlight picker render simultaneously with distinct popup ids so opening one never opens the other.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { ExcalidrawTextElement, TextRangeStyle } from "@excalidraw/element/types";`
  - `type TextRangeStyle(): Readonly<{ start: number; end: number; color?: string; highlight?: string }>`
  - `type ExcalidrawTextElement(): _ExcalidrawElementBase & Readonly<{ type: "text"; textStyles?: readonly TextRangeStyle[] }>`
- `packages/element/src/textStyles.ts` (U02, create) — import: `import { normalizeTextRanges, applyTextRangeStyle, getUniformTextRangeStyle, shiftTextRanges, shiftTextRangesAtOffset, splitTextIntoStyledSegments, getLineTextRuns, projectTextRangesOntoLines } from "@excalidraw/element";`
  - `type TextStyleSegment(): Readonly<{ text: string; start: number; end: number; color?: string; highlight?: string }>`
  - `type LineTextRun(): Readonly<{ text: string; start: number; end: number; color?: string; highlight?: string; x: number; width: number; direction: "ltr" | "rtl" }>`
  - `type WrappedLineWithRuns(): Readonly<{ line: WrappedTextLine; runs: readonly LineTextRun[] }>`
  - `function normalizeTextRanges(ranges: unknown, textLength: number, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function applyTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, textLength: number, selection: { start: number; end: number }, style: { color?: string | null; highlight?: string | null }, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function getUniformTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, start: number, end: number, key: "color" | "highlight"): string | null`
  - `function shiftTextRangesAtOffset(ranges: readonly TextRangeStyle[] | undefined, offset: number, deletedLength: number, insertedLength: number, nextTextLength: number): readonly TextRangeStyle[] | undefined`
  - `function shiftTextRanges(ranges: readonly TextRangeStyle[] | undefined, prevText: string, nextText: string): readonly TextRangeStyle[] | undefined`
  - `function splitTextIntoStyledSegments(text: string, ranges: readonly TextRangeStyle[] | undefined, offset: number | undefined): readonly TextStyleSegment[]`
  - `function getLineTextRuns(line: WrappedTextLine, ranges: readonly TextRangeStyle[] | undefined, opts: { font: FontString; elementWidth: number; textAlign: TextAlign; baseDirection: "ltr" | "rtl"; renderEnvironment?: RenderEnvironment }): readonly LineTextRun[]`
  - `function projectTextRangesOntoLines(originalText: string, ranges: readonly TextRangeStyle[] | undefined, opts: { font: FontString; maxWidth?: number; wrappedText?: string; elementWidth: number; textAlign: TextAlign; baseDirection: "ltr" | "rtl"; renderEnvironment?: RenderEnvironment }): readonly WrappedLineWithRuns[]`
- `packages/element/src/index.ts` (U03, edit) — import: `import { normalizeTextRanges, applyTextRangeStyle, getUniformTextRangeStyle, shiftTextRanges, shiftTextRangesAtOffset, splitTextIntoStyledSegments, getLineTextRuns, projectTextRangesOntoLines } from "@excalidraw/element";`
  - `function normalizeTextRanges(ranges: unknown, textLength: number, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function applyTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, textLength: number, selection: { start: number; end: number }, style: { color?: string | null; highlight?: string | null }, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function getUniformTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, start: number, end: number, key: "color" | "highlight"): string | null`
  - `function shiftTextRanges(ranges: readonly TextRangeStyle[] | undefined, prevText: string, nextText: string): readonly TextRangeStyle[] | undefined`
  - `function shiftTextRangesAtOffset(ranges: readonly TextRangeStyle[] | undefined, offset: number, deletedLength: number, insertedLength: number, nextTextLength: number): readonly TextRangeStyle[] | undefined`
  - `function splitTextIntoStyledSegments(text: string, ranges: readonly TextRangeStyle[] | undefined, offset: number | undefined): readonly TextStyleSegment[]`
  - `function getLineTextRuns(line: WrappedTextLine, ranges: readonly TextRangeStyle[] | undefined, opts: { font: FontString; elementWidth: number; textAlign: TextAlign; baseDirection: "ltr" | "rtl"; renderEnvironment?: RenderEnvironment }): readonly LineTextRun[]`
  - `function projectTextRangesOntoLines(originalText: string, ranges: readonly TextRangeStyle[] | undefined, opts: { font: FontString; maxWidth?: number; wrappedText?: string; elementWidth: number; textAlign: TextAlign; baseDirection: "ltr" | "rtl"; renderEnvironment?: RenderEnvironment }): readonly WrappedLineWithRuns[]`
- `packages/element/src/newElement.ts` (U04, edit) — import: `import { newTextElement } from "@excalidraw/element";`
  - `function newTextElement(opts: { text: string; originalText?: string; fontSize?: number; fontFamily?: FontFamilyValues; textAlign?: TextAlign; verticalAlign?: VerticalAlign; containerId?: ExcalidrawTextContainer["id"] | null; lineHeight?: ExcalidrawTextElement["lineHeight"]; autoResize?: ExcalidrawTextElement["autoResize"]; labelPosition?: ExcalidrawTextElement["labelPosition"]; baseFontSize?: ExcalidrawTextElement["baseFontSize"]; textStyles?: ExcalidrawTextElement["textStyles"]; renderEnvironment?: RenderEnvironment } & ElementConstructorOpts): NonDeleted<ExcalidrawTextElement>`
- `packages/element/src/textElement.ts` (U05, edit) — import: `import { redrawTextBoundingBox } from "@excalidraw/element";`
- `packages/element/src/listMarker.ts` (U06, edit) — import: `import { advanceDuplicatedListMarkers, applyListMarkerAdvances, type ListMarkerAdvance } from "@excalidraw/element";`
  - `type ListMarkerAdvance(): { elementId: ExcalidrawTextElement["id"]; prevOriginalText: string; nextOriginalText: string; contentStart: number; prevContainerSize: { width: number; height: number } | null; prevTextStyles?: ExcalidrawTextElement["textStyles"]; nextTextStyles?: ExcalidrawTextElement["textStyles"] }`
- `packages/element/src/renderElement.ts` (U07, edit) — import: `import { drawElementOnCanvas } from "@excalidraw/element";`
- `packages/excalidraw/locales/en.json` (U08, edit)
- `packages/excalidraw/css/styles.scss` (U09, edit)
- `packages/excalidraw/actions/types.ts` (U10, edit) — import: `import type { ActionName } from "../actions/types";`
  - `type ActionName(): string`
- `packages/excalidraw/types.ts` (U11, edit) — import: `import type { AppClassProperties, AppState } from "../types";`
  - `type AppState(): object`
  - `type AppClassProperties(): object`
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U12, edit) — import: `import { textWysiwyg } from "../wysiwyg/textWysiwyg";`
- `packages/excalidraw/components/App.text.ts` (U13, edit) — import: `import { AppText } from "./App.text";`
  - `class AppText(): AppText`
- `packages/excalidraw/actions/actionProperties.tsx` (U14, edit) — import: `import { actionChangeTextHighlight } from "./actionProperties";`
  - `const actionChangeTextHighlight(): Action`
- `packages/excalidraw/actions/index.ts` (U15, edit) — import: `import { actionChangeTextHighlight } from "../actions";`
  - `const actionChangeTextHighlight(): Action`
- `packages/excalidraw/components/Actions.tsx` (U16, edit)
- `packages/excalidraw/data/restore.ts` (U17, edit) — import: `import { restoreElement, restoreElements } from "../data/restore";`
- `packages/excalidraw/renderer/staticSvgScene.ts` (U18, edit) — import: `import { renderSceneToSvg } from "../renderer/staticSvgScene";`
- `packages/element/tests/textStyles.test.ts` (U19, create)
- `packages/element/tests/textWrapping.test.ts` (U20, edit)
- `packages/element/tests/textElement.test.ts` (U21, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U22, edit)
- `packages/excalidraw/tests/data/reconcile.test.ts` (U23, edit)
- `packages/excalidraw/tests/scene/export.test.ts` (U24, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (U25, edit)
- `packages/excalidraw/CHANGELOG.md` (U26, edit)
