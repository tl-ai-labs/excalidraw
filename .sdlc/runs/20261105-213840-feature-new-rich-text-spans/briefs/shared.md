## Conventions

- Formatting is Prettier via @excalidraw/prettier-config (2-space indent, double quotes, trailing commas, 80 columns); eslint reports prettier/prettier as a warning and runs with --max-warnings=0, so every file must be prettier-clean.
- Import order (eslint import/order, enforced): builtin, external, then @excalidraw/** packages, then parent/sibling relative imports, with all `import type` lines last; a blank line between groups.
- Type-only imports use a separate `import type { ... }` statement (consistent-type-imports, separate-type-imports style).
- Inside packages/element import sibling modules relatively ("./textStyleRanges"); packages/excalidraw imports element code from "@excalidraw/element" and element types from "@excalidraw/element/types"; non-test files in packages/excalidraw never import from the "@excalidraw/excalidraw" barrel or ".."/"../index".
- jotai is imported only through packages/excalidraw/editor-jotai.ts (atom, editorJotaiStore, useAtomValue), never from "jotai" directly.
- Elements are immutable data: change them only through newElementWith(element, updates) or scene.mutateElement(element, updates); never assign to element fields.
- DOM access in packages/excalidraw goes through the editor's ownerDocument/ownerWindow (or svgRoot.ownerDocument), never the global document/window.
- TypeScript strict: no `any`, no non-null assertions on values that can be null at runtime; new public types are exported type aliases with a JSDoc line.
- Every style-range offset is a UTF-16 code-unit index into `originalText`, `start` inclusive and `end` exclusive; the wrapped `text` is never indexed by a range.
- UI strings are i18n keys rendered with t("labels.<key>"); keys are added to packages/excalidraw/locales/en.json only; no literal text in JSX.
- Comments are short and say why, in the repo's lower-case comment voice; keep existing comments of edited code intact.
- Tests run on vitest with globals (describe/it/expect; import `vi` from "vitest" only when mocking), jsdom and vitest-canvas-mock, where a text's measured width equals its string length in px; unit tests build elements with API.createElement from @excalidraw/excalidraw/tests/helpers/api and add style ranges with newElementWith; editor tests render <Excalidraw handleKeyboardGlobally={true} /> and read state from window.h.

## Decisions

- Range field name and shape: ExcalidrawTextElement gains `styleRanges?: readonly TextStyleRange[]`, where `TextStyleRange = Readonly<{ start: number; end: number; color?: string; highlight?: string }>`; `color` is the text colour, `highlight` the background colour; a stored range never carries a key whose value is undefined. (not `spans` with a nested `style` object; not offsets into the wrapped `text`) — Flat optional keys serialise compactly and offsets into originalText survive every re-wrap (FR-1, FR-10).
- Representation of no styling: A never-styled text has no `styleRanges` key at all; clearing the last range writes `styleRanges: []`; every reader tests `element.styleRanges?.length`; restore turns an empty or invalid array back into no key. (not writing `styleRanges: undefined`) — mutateElement and newElementWith skip undefined values, so a key cannot be unset through them, and plain text must serialise exactly as today (NFR-1).
- Where the editor selection lives: An editor-jotai atom `textEditorSelectionAtom` in packages/excalidraw/actions/colorTargets.ts holds `{ elementId, start, end } | null`; textWysiwyg writes it through editorJotaiStore, the colour actions read it with editorJotaiStore.get in perform and useAtomValue in their PanelComponents; AppState and appState.ts are not changed. (not an AppState field `editingTextSelection`; not a plain module variable without subscribers) — FR-20 only asks for app state if needed; the atom re-renders the colour panels on selection change without touching the persisted/collaborated state or the full-appState snapshots in history, regression and contextmenu tests.
- Where ranges are shifted while typing: textWysiwyg.tsx shifts the edited element's styleRanges itself, in its input handler before onChange, with scene.mutateElement(..., { informMutation: false, isDragging: false }); it keeps `styleRangesText`, the text the ranges are aligned to, and indent/outdent pre-shift one edit per tab and update that text so the input event that follows finds nothing to shift. (not shifting in App.text.ts updateElement; not shifting inside refreshTextDimensions) — App.text.ts is outside the allowlist and spreads the latest scene element, so ranges mutated just before onChange land in the same update; refreshTextDimensions cannot tell wrapped from original text.
- Mapping ranges onto wrapped lines: getStyledLines(originalText, text, ranges) aligns each wrapped line of `text` to `originalText` by string matching (a hard newline is stepped over once, whitespace dropped at a soft break is skipped), with no font measurement; textWrapping.ts and textMeasurements.ts are not edited. (not re-running getWrappedTextLines at render time) — Pure and measurement-free (NFR-3), and it maps exactly what was drawn, so stored ranges never change on re-wrap (FR-6, FR-10, FR-11).
- Run widths and positions: Canvas and SVG both measure each run with getLineWidth(run.text, getFontString(element), renderEnvironment) and place runs with getStyledRunPositions(widths, element.textAlign, element.width, isRTL(element.text)); an RTL line lays its runs right to left from the line's right edge. (not context.measureText on canvas and a different measure in SVG) — FR-28 requires both outputs to use the same measurement; one pure positioning helper keeps canvas and SVG highlights identical.
- Colour semantics of a range pick: A stroke pick on a non-empty editor selection that is not the whole text (a whole-text selection, which Enter-to-edit auto-selects, recolours the element as today; for a background pick this exception holds only on sticky-note labels, whose pick colours the note) applies `{ color }`, or `{ color: null }` when the colour equals the element's strokeColor; a background pick applies `{ highlight }`, or `{ highlight: null }` when isTransparent(color); the pick returns only the changed text element and `{ ...appState, ...appStateUpdates }` with CaptureUpdateAction.IMMEDIATELY and never writes strokeColor, backgroundColor, a container or a currentItem default. (not a separate clear-colour control) — Gate 1 resolved question 1 and FR-21 to FR-24.
- Highlight picker visibility while editing: When a range is selected and canChangeBackgroundColor (components/shapeActionPredicates.ts) is false for the edited text, the stroke-colour PanelComponent also renders renderAction("changeBackgroundColor") below its picker; sticky-note labels already show the background picker and get no second one. (not editing shapeActionPredicates.ts or Actions.tsx) — Both files are outside the allowlist, and the background picker is hidden for free and bound text today, yet FR-21/FR-23 need a highlight pick.
- Copy/paste styles and reconciliation: actionStyles.ts and data/reconcile.ts are not edited; FR-26 and FR-17 are pinned by tests. (not stripping styleRanges in actionCopyStyles; not a range-aware merge in reconcile.ts) — actionPasteStyles writes an explicit list of style keys that excludes styleRanges, and reconciliation already keeps the winning element whole, text and ranges together.
- Canvas cache invalidation: ExcalidrawElementWithCanvas records `styleRanges` (the element's array reference, or null) and generateElementWithCanvas regenerates when it differs. (not relying on a new element object per change) — An in-place scene.mutateElement of styleRanges keeps the WeakMap key, so the reference must be part of the cache key (FR-14).
- Restore sanitising: sanitizeStyleRanges(value, textLength): a non-array gives null; an entry is dropped unless it is an object with integer start and end; a colour key is kept only when it is a non-empty string; an entry with no colour key left is dropped; start and end are clamped into [0, textLength]; start >= end is dropped; the rest is normalised; an empty result gives null and restore deletes the key. — FR-15/FR-16 with one exact rule set the tests can pin.
- New UI strings: labels.rangeTextColor = "Selected text color" and labels.rangeHighlight = "Selected text highlight"; they replace the stroke/background picker labels (and full-mode headings) while a range is selected. — FR-25 asks the panel to tell a range pick from an element pick.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { TextStyleRange } from "@excalidraw/element/types";`
  - `type TextStyleRange(): Readonly<{ start: number; end: number; color?: string; highlight?: string }>`
- `packages/element/src/textStyleRanges.ts` (U02, create) — import: `import { applyTextStyle, diffText, getStyledLines, normalizeStyleRanges, shiftStyleRanges } from "@excalidraw/element";`
  - `type TextEdit(): { from: number; to: number; insertLength: number }`
  - `type TextStyleUpdate(): { color?: string | null; highlight?: string | null }`
  - `type StyledTextRun(): { text: string; start: number; color: string | null; highlight: string | null }`
  - `function normalizeStyleRanges(ranges: readonly TextStyleRange[], textLength: number): TextStyleRange[]`
  - `function applyTextStyle(ranges: readonly TextStyleRange[], start: number, end: number, style: TextStyleUpdate, textLength: number): TextStyleRange[]`
  - `function diffText(prevText: string, nextText: string): TextEdit | null`
  - `function shiftStyleRanges(ranges: readonly TextStyleRange[], edit: TextEdit, nextTextLength: number): TextStyleRange[]`
  - `function getStyledLines(originalText: string, text: string, ranges: readonly TextStyleRange[]): StyledTextRun[][]`
  - `function getStyledRunPositions(widths: readonly number[], textAlign: TextAlign, boxWidth: number, rtl: boolean): number[]`
  - `function getUniformRangeStyle(ranges: readonly TextStyleRange[], start: number, end: number, property: "color" | "highlight"): string | null`
  - `function sanitizeStyleRanges(value: unknown, textLength: number): TextStyleRange[] | null`
  - `function getStyleRangesClampUpdate(element: Pick<ExcalidrawTextElement, "styleRanges">, textLength: number): Partial<Pick<ExcalidrawTextElement, "styleRanges">>`
  - `function areStyleRangesEqual(a: readonly TextStyleRange[], b: readonly TextStyleRange[]): boolean`
- `packages/element/src/index.ts` (U03, edit)
- `packages/element/src/newElement.ts` (U04, edit)
  - `function newTextElement(opts: { text: string; originalText?: string; styleRanges?: ExcalidrawTextElement["styleRanges"]; ... } & ElementConstructorOpts): NonDeleted<ExcalidrawTextElement>`
  - `function refreshTextDimensions(textElement: ExcalidrawTextElement, container: ExcalidrawTextContainer | null, elementsMap: ElementsMap, text: string, maxWidth: number | undefined, renderEnvironment: RenderEnvironment | undefined): { text: string; x: number; y: number; width: number; height: number; autoResize?: false; styleRanges?: readonly TextStyleRange[] } | undefined`
- `packages/element/src/textElement.ts` (U05, edit)
- `packages/element/src/renderElement.ts` (U06, edit)
  - `field ExcalidrawElementWithCanvas.styleRanges(): ExcalidrawTextElement["styleRanges"] | null`
- `packages/excalidraw/data/restore.ts` (U07, edit)
- `packages/excalidraw/actions/colorTargets.ts` (U08, edit)
  - `type TextEditorSelection(): { elementId: ExcalidrawTextElement["id"]; start: number; end: number }`
  - `const textEditorSelectionAtom(): PrimitiveAtom<TextEditorSelection | null>`
  - `function getEditingTextRange(appState: Pick<AppState, "editingTextElement">, elements: readonly ExcalidrawElement[], selection: TextEditorSelection | null, property: ColorProperty): { element: ExcalidrawTextElement; start: number; end: number } | null`
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U09, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U10, edit)
- `packages/excalidraw/renderer/staticSvgScene.ts` (U11, edit)
- `packages/excalidraw/locales/en.json` (U12, edit)
- `packages/excalidraw/CHANGELOG.md` (U13, edit)
- `packages/element/tests/textStyleRanges.test.ts` (U14, create)
- `packages/element/tests/textElement.test.ts` (U15, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U16, edit)
- `packages/excalidraw/tests/data/reconcile.test.ts` (U17, edit)
- `packages/excalidraw/tests/export.test.tsx` (U18, edit)
- `packages/excalidraw/tests/textStyleRanges.test.tsx` (U19, create)
