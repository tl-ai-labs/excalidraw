## Conventions

- TypeScript strict, ESM; Prettier 2 via @excalidraw/prettier-config (double quotes, trailing commas, 2-space indent, 80 cols); eslint-plugin-prettier enforces it, max-warnings 0.
- Import order: package aliases (@excalidraw/common, @excalidraw/math, @excalidraw/element) first, then relative imports, then `import type` statements grouped last, blank line between groups (eslint import/order).
- Inside packages/element/src import sibling modules relatively (./textRanges); outside packages/element import from "@excalidraw/element" and types from "@excalidraw/element/types".
- AGENTS.md: never use the document/window globals in new code; use app.ownerDocument / app.ownerWindow, an element's ownerDocument, or svgRoot.ownerDocument.
- AGENTS.md: combine object types with Merge<Base, Overrides> from "@excalidraw/common/utility-types", never Omit<...> & {...}.
- Elements are immutable: change them only through mutateElement / scene.mutateElement / newElementWith, never by assignment.
- A text element with no style ranges must not have the styleRanges key at all (not even undefined): add it with a conditional spread `...(ranges ? { styleRanges: ranges } : {})`.
- UI strings go through t("labels.<key>") and only packages/excalidraw/locales/en.json gets new keys.
- Tests: vitest globals (describe/it/expect), vi from "vitest"; jsdom with vitest-canvas-mock (measureText width = text.length * fontSize/10 roughly); UI tests render <Excalidraw /> via ../tests/test-utils and drive it with API/UI/Keyboard helpers from tests/helpers.
- Never call yarn test:update; never add snapshot assertions to existing tests; new tests assert values directly rather than toMatchSnapshot.

## Decisions

- Names: Element field `styleRanges?: readonly TextStyleRange[]` on ExcalidrawTextElement; type `TextStyleRange = Readonly<{ start: number; end: number; color?: string; highlight?: string }>` in packages/element/src/types.ts; AppState field `textEditorSelection: { elementId: string; start: number; end: number } | null`; actions `changeTextRangeColor` / `changeTextRangeHighlight` (exports actionChangeTextRangeColor / actionChangeTextRangeHighlight); en.json keys labels.textRangeColor = "Selection color", labels.textRangeHighlight = "Selection highlight". (not textRanges / richText field names; not a separate jotai store for the selection) — Requirements' working names, kept; Gate 0 put the selection in AppState.
- Where the range logic lives: All range maths, wrapped-line splitting and run layout (x offset and width per run) live in packages/element/src/textRanges.ts and are re-exported from @excalidraw/element; renderElement.ts and staticSvgScene.ts both call getStyledTextLines from it. textElement.ts, textWrapping.ts, textMeasurements.ts, mutateElement.ts and reconcile.ts are not edited. (not splitting helpers across textWrapping.ts / textMeasurements.ts; not duplicating the run layout in the SVG renderer) — One module for canvas and SVG keeps the two renderers identical and the change small; the split aligns wrapped text to originalText itself, so the wrapping code needs no change.
- No-ranges representation: No ranges = the styleRanges key is absent. Code that sets ranges goes through withStyleRanges(element, ranges), which returns a NEW element object (version and versionNonce bumped, as newElementWith does) carrying the normalized list, or the element without the key when the list is empty; it returns the same object when the normalized list is deep-equal to the current one. Readers treat undefined and [] the same (no ranges). (not styleRanges: [] or null as the empty value; not mutateElement in place) — Keeps existing snapshots byte-identical (C-3), and a new object identity is what invalidates elementWithCanvasCache (a WeakMap keyed by element), so no cache code changes.
- Editor-side shifting and selection tracking: Both live in packages/excalidraw/wysiwyg/textWysiwyg.tsx (App.text.ts, which owns handleTextWysiwyg, is not writable): editable.oninput shifts the latest scene element's ranges with shiftRangesForEdit before calling onChange, and textarea select/keyup/mouseup/input listeners write app.setState({ textEditorSelection }). handleSubmit sets it back to null. App.tsx is not edited. (not editing App.text.ts updateElement (outside the write contract); not wiring callbacks through App.tsx) — textWysiwyg already holds `app` and the textarea; App.text.ts's updateElement spreads the latest scene element, so ranges written to the scene before onChange are carried with the new text.
- Two extra colour pickers next to the stroke picker: ColorPicker gains an optional prop `popupId?: "textRangeColor" | "textRangeHighlight"`; when given it replaces `type` as the AppState.openPopup key (open state, toggles, close, memo comparison, data-openpopup). AppState.openPopup's union gains those two values. Selection color uses type "elementStroke" with topPicks [transparent, red, green, blue, yellow stroke shades]; Selection highlight uses type "elementBackground" with the default background picks. (not new ColorPickerType values (branches in Picker, TopPicks, colorPickerUtils); not reusing the stroke picker for the selection (Q3)) — Two pickers of the same type would otherwise open together with the stroke picker; one optional prop keeps the palette code untouched.
- Clearing a style: Picking COLOR_PALETTE.transparent ("transparent") in either selection picker clears that attribute on the selection (patch value null); any other string sets it. (not a separate clear button) — Matches how the background picker expresses none.
- Run layout and RTL: A styled line is laid out with absolute run positions: lineWidth = sum of run widths measured with getLineWidth in the element's font; lineStart = 0 (left), (element.width - lineWidth) / 2 (center), element.width - lineWidth (right). LTR lines place runs left to right from lineStart; a line for which isRTL(line text) is true places runs in logical order from the right edge (first run ends at lineStart + lineWidth). Each run is drawn left-anchored at its x (canvas textAlign "left"; SVG tspan x with text-anchor "start"). (not bidi-exact per-glyph positioning (out of scope 8)) — Q1 default approved at Gate 1.
- Highlight geometry: A highlighted run gets a rect at (run.x, lineIndex * lineHeightPx), width run.width, height lineHeightPx, filled with applyDarkModeFilter(highlight, isDark); drawn before any text of that line (canvas fillRect; SVG <rect> appended to the element's <g> before that line's <text>). — FR-18/FR-19: highlight sits behind the text and spans one line height.
- AppState snapshot update (Q4): textEditorSelection defaults to null, so pretty-format adds the line `  "textEditorSelection": null,` right before each top-level `  "textToolHover": null,` line in regressionTests/history/contextmenu .snap files; that insertion is a deterministic perl tooling step per file, never vitest -u / yarn test:update. (not vitest --update on the three files; not leaving the field out of getDefaultAppState) — Gate 1 approved exactly this one-key diff; a fixed text insertion cannot hide any other snapshot change.
- Undo and capture: Both selection actions return captureUpdate CaptureUpdateAction.IMMEDIATELY when they change the element and CaptureUpdateAction.EVENTUALLY when they only pass app-state updates (popup open/close) or do nothing; the editor's input-time shift is not captured separately (the existing submit capture records it). — Same contract as actionChangeStrokeColor; history then restores ranges like any other element property (FR-17).

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { TextStyleRange } from "@excalidraw/element/types";`
  - `type TextStyleRange(): Readonly<{ start: number; end: number; color?: string; highlight?: string }>`
- `packages/element/src/textRanges.ts` (U02, create) — import: `import { applyStyle, getStyledTextLines, restoreStyleRanges, shiftRangesForEdit, withStyleRanges } from "@excalidraw/element";`
  - `type StyledTextRun(): { text: string; color?: string; highlight?: string }`
  - `type StyledTextLine(): { runs: StyledTextRun[] }`
  - `type LaidOutTextRun(): StyledTextRun & { x: number; width: number }`
  - `type TextStylePatch(): { color?: string | null; highlight?: string | null }`
  - `function normalizeStyleRanges(ranges: readonly TextStyleRange[], textLength: number): TextStyleRange[]`
  - `function applyStyle(ranges: readonly TextStyleRange[], start: number, end: number, patch: TextStylePatch, textLength: number): readonly TextStyleRange[]`
  - `function shiftRangesForEdit(ranges: readonly TextStyleRange[], oldText: string, newText: string): readonly TextStyleRange[]`
  - `function restoreStyleRanges(value: unknown, originalText: string): TextStyleRange[] | undefined`
  - `function getStyleRanges(element: ExcalidrawTextElement): readonly TextStyleRange[]`
  - `function hasStyleRanges(element: ExcalidrawTextElement): boolean`
  - `function withStyleRanges(element: T extends ExcalidrawTextElement, ranges: readonly TextStyleRange[]): T`
  - `function splitRangesIntoLines(originalText: string, wrappedText: string, ranges: readonly TextStyleRange[]): StyledTextLine[]`
  - `function getStyledTextLines(element: ExcalidrawTextElement, env: RenderEnvironment | undefined): { runs: LaidOutTextRun[] }[] | null`
- `packages/element/src/index.ts` (U03, edit)
- `packages/element/src/newElement.ts` (U04, edit)
- `packages/element/src/renderElement.ts` (U05, edit)
- `packages/excalidraw/renderer/staticSvgScene.ts` (U06, edit)
- `packages/excalidraw/data/restore.ts` (U07, edit)
- `packages/excalidraw/types.ts` (U08, edit)
- `packages/excalidraw/appState.ts` (U09, edit)
- `packages/excalidraw/components/ColorPicker/ColorPicker.tsx` (U10, edit)
- `packages/excalidraw/locales/en.json` (U11, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U12, edit) — import: `import { actionChangeTextRangeColor, actionChangeTextRangeHighlight } from "../actions/actionProperties";`
  - `const actionChangeTextRangeColor(): Action<Partial<AppState> & { color?: string }>`
  - `const actionChangeTextRangeHighlight(): Action<Partial<AppState> & { color?: string }>`
- `packages/excalidraw/actions/types.ts` (U13, edit)
- `packages/excalidraw/actions/index.ts` (U14, edit)
- `packages/excalidraw/components/Actions.tsx` (U15, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U16, edit)
- `packages/element/tests/textRanges.test.ts` (U17, create)
- `packages/element/tests/textWrapping.test.ts` (U18, edit)
- `packages/element/tests/textElement.test.ts` (U19, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U20, edit)
- `packages/excalidraw/tests/data/reconcile.test.ts` (U21, edit)
- `packages/excalidraw/tests/textRangeStyles.test.tsx` (U22, create)
- `packages/excalidraw/tests/scene/export.test.ts` (U23, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (U24, edit)
- `packages/excalidraw/CHANGELOG.md` (U25, edit)
