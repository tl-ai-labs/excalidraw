## Conventions

- TypeScript strict mode with ES modules; use `import type` for type-only imports and keep `@excalidraw/common` / `@excalidraw/element` imports grouped before relative imports.
- Never leave `textRanges: undefined` or `textRanges: []` as an own property on any `ExcalidrawTextElement`; omit the `textRanges` key or `delete` it when empty so Vitest element and scene snapshots remain byte-for-byte identical.
- Do not add fields to `AppState` in `packages/excalidraw/appState.ts` or alter default toolbar/panel DOM when not editing text, preserving existing `appState` and UI snapshots.
- Use Vitest (`describe`, `it`, `expect`, `vi`) and `@excalidraw/excalidraw/tests/test-utils` (`render`, `act`, `waitFor`) for unit and integration tests without adding new `toMatchSnapshot` calls.
- Apply dark-mode colour transformation via `applyDarkModeFilter(color, theme === THEME.DARK)` from `@excalidraw/common` for both foreground text runs and background highlight rectangles in Canvas and SVG renderers.

## Decisions

- Live edit-time display mechanism for per-range text colour and highlight (FR-9, AC-3): Render `editingTextElement` on the static canvas when `editingTextElement.textRanges?.length` is non-empty by retaining it in `packages/excalidraw/scene/Renderer.ts` (`getRenderableElementsMap`) and folding `editingTextElement.versionNonce` into `canvasNonce` (`getRenderableElements`), while `packages/excalidraw/wysiwyg/textWysiwyg.tsx` sets `editable.style.color = "transparent"`, `editable.style.caretColor = applyDarkModeFilter(updatedTextElement.strokeColor, appState.theme === THEME.DARK)`, and `editable.dataset.textRanges = JSON.stringify(updatedTextElement.textRanges)`; in jsdom, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` deterministically asserts against `editor.style.color === "transparent"`, `JSON.parse(editor.dataset.textRanges!)`, and `h.app.renderer.getRenderableElements(...).elementsMap.get(textElement.id)?.textRanges` while `h.state.editingTextElement` is open. (not Replacing the `<textarea class="excalidraw-wysiwyg">` with a `contenteditable` div containing `<span>` nodes; not Rendering a mirrored HTML `<div>/<span>` overlay inside `.excalidraw-textEditorContainer` while keeping `editingTextElement` excluded from `Renderer.ts`) — (a) Normally `packages/excalidraw/scene/Renderer.ts` `getRenderableElementsMap` skips `editingTextElement` and `packages/excalidraw/wysiwyg/textWysiwyg.tsx` paints the `<textarea>` in a single inline `color`, which cannot render per-run colours or background highlights; replacing `<textarea>` with `contenteditable` would break `selectionStart`/`selectionEnd` code-unit indexing and existing `HTMLTextAreaElement` tests, and a DOM mirror overlay can drift from Canvas 2D `measureText`/`getWrappedTextLines` metrics, whereas letting the static canvas draw the styled runs beneath a transparent-text `<textarea>` reuses the exact canvas run renderer while keeping native `<textarea>` caret/selection and leaving unstyled text editing (`!textRanges?.length`) untouched. (b) In jsdom, `textWysiwyg.test.tsx` asserts deterministically while the editor is open that `editor.style.color` is `"transparent"`, `JSON.parse(editor.dataset.textRanges!)` matches the applied `TextRangeStyle[]`, and `h.app.renderer.getRenderableElements(...).elementsMap.get(textElement.id)?.textRanges` contains the live styled range.
- Representation and omission of `textRanges` on `ExcalidrawTextElement` (FR-1, NFR-1): Store styled spans in `textRanges?: readonly TextRangeStyle[]` where `TextRangeStyle = Readonly<{ start: number; end: number; color?: string; highlightColor?: string }>` over UTF-16 code-unit offsets of `originalText`, and omit or `delete` the `textRanges` own property whenever normalized ranges are empty. (not Initializing `textRanges: []` or `textRanges: undefined` as an own property on every `ExcalidrawTextElement`; not Indexing ranges against wrapped `element.text` instead of `originalText`) — Vitest snapshots serialize `"textRanges": undefined` if the key exists on the object; omitting and deleting the key when empty guarantees zero snapshot drift, and indexing against `originalText` keeps offsets stable across width/container re-wrapping.
- Applying range colour and highlight from WYSIWYG and properties actions (FR-4): Export `getWysiwygSelectionRange` and `syncWysiwygTextRangesStyle` from `packages/excalidraw/wysiwyg/textWysiwyg.tsx`, export `actionChangeHighlightColor` from `packages/excalidraw/actions/actionProperties.tsx`, and route `actionChangeStrokeColor`, `actionChangeBackgroundColor`, and `actionChangeHighlightColor` to update `[selectionStart, selectionEnd)` via `applyTextRangeStyle` whenever `appState.editingTextElement` has a non-empty selection (`selectionStart < selectionEnd`), while rendering a Highlight `ColorPicker` inside `actionChangeStrokeColor.PanelComponent` when editing non-sticky text. (not Enabling `getShapeActionPredicates.backgroundColor` for plain text elements while editing; not Storing WYSIWYG selection offsets in `AppState`) — `stickyNotes.test.tsx` explicitly asserts `getShapeActionPredicates(...).backgroundColor === false` when editing plain text, and `contextmenu`/`history` snapshots forbid new `AppState` keys; reading selection from the live `.excalidraw-wysiwyg` textarea and rendering the highlight picker in `actionChangeStrokeColor.PanelComponent` during plain-text editing satisfies both constraints.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { ExcalidrawTextElement, TextRangeStyle } from "./types";`
  - `type TextRangeStyle(): Readonly<{ start: number; end: number; color?: string; highlightColor?: string }>`
  - `type ExcalidrawTextElement(): _ExcalidrawElementBase & Readonly<{ type: "text"; ...; textRanges?: readonly TextRangeStyle[] }>`
- `packages/element/src/textRanges.ts` (U02, create) — import: `import { isValidRangeColor, normalizeTextRanges, areTextRangesEqual, applyTextRangeStyle, computeTextEditDelta, shiftTextRangesOnEdit, getStyleForTextRange, projectTextRangesToLines } from "./textRanges";`
  - `type TextLineRun(): Readonly<{ text: string; start: number; end: number; color?: string; highlightColor?: string }>`
  - `type TextEditDelta(): Readonly<{ start: number; deleteCount: number; insertLength: number }>`
  - `function isValidRangeColor(color: unknown): color is string`
  - `function normalizeTextRanges(ranges: unknown, textLength: number): readonly TextRangeStyle[] | undefined`
  - `function areTextRangesEqual(a: readonly TextRangeStyle[] | undefined, b: readonly TextRangeStyle[] | undefined): boolean`
  - `function applyTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, textLength: number, start: number, end: number, style: { color?: string | null; highlightColor?: string | null }, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function computeTextEditDelta(prevText: string, nextText: string): TextEditDelta`
  - `function shiftTextRangesOnEdit(ranges: readonly TextRangeStyle[] | undefined, prevText: string, nextText: string): readonly TextRangeStyle[] | undefined`
  - `function getStyleForTextRange(ranges: readonly TextRangeStyle[] | undefined, start: number, end: number, defaultStrokeColor: string): { color: string; highlightColor: string }`
  - `function projectTextRangesToLines(originalText: string, wrappedText: string, ranges: readonly TextRangeStyle[] | undefined): readonly (readonly TextLineRun[])[]`
- `packages/element/src/newElement.ts` (U03, edit) — import: `import { newTextElement } from "./newElement";`
  - `function newTextElement(opts: object & ElementConstructorOpts): NonDeleted<ExcalidrawTextElement>`
- `packages/element/src/renderElement.ts` (U04, edit) — import: `import { renderElement, elementWithCanvasCache } from "./renderElement";`
  - `interface ExcalidrawElementWithCanvas(): ExcalidrawElementWithCanvas`
- `packages/element/src/delta.ts` (U05, edit) — import: `import { Delta, ElementsDelta } from "./delta";`
  - `class ElementsDelta(): ElementsDelta`
- `packages/element/src/index.ts` (U06, edit) — import: `import { isValidRangeColor, normalizeTextRanges, areTextRangesEqual, applyTextRangeStyle, computeTextEditDelta, shiftTextRangesOnEdit, getStyleForTextRange, projectTextRangesToLines } from "@excalidraw/element";`
  - `function normalizeTextRanges(ranges: unknown, textLength: number): readonly TextRangeStyle[] | undefined`
  - `function applyTextRangeStyle(ranges: readonly TextRangeStyle[] | undefined, textLength: number, start: number, end: number, style: { color?: string | null; highlightColor?: string | null }, baseStrokeColor: string | undefined): readonly TextRangeStyle[] | undefined`
  - `function shiftTextRangesOnEdit(ranges: readonly TextRangeStyle[] | undefined, prevText: string, nextText: string): readonly TextRangeStyle[] | undefined`
  - `function projectTextRangesToLines(originalText: string, wrappedText: string, ranges: readonly TextRangeStyle[] | undefined): readonly (readonly TextLineRun[])[]`
- `packages/excalidraw/locales/en.json` (U07, edit)
- `packages/excalidraw/scene/Renderer.ts` (U08, edit) — import: `import { Renderer } from "../scene/Renderer";`
  - `class Renderer(scene: Scene): Renderer`
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U09, edit) — import: `import { textWysiwyg, getWysiwygSelectionRange, syncWysiwygTextRangesStyle } from "../wysiwyg/textWysiwyg";`
  - `function getWysiwygSelectionRange(ownerDocument: Document | undefined): { start: number; end: number } | null`
  - `function syncWysiwygTextRangesStyle(element: ExcalidrawTextElement, theme: AppState["theme"], editableEl: HTMLTextAreaElement | null | undefined): void`
- `packages/excalidraw/components/App.text.ts` (U10, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U11, edit) — import: `import { actionChangeStrokeColor, actionChangeBackgroundColor, actionChangeHighlightColor } from "../actions/actionProperties";`
  - `const actionChangeHighlightColor(): Action`
- `packages/excalidraw/renderer/staticSvgScene.ts` (U12, edit)
- `packages/excalidraw/data/restore.ts` (U13, edit)
- `packages/excalidraw/data/reconcile.ts` (U14, edit) — import: `import { reconcileElements, shouldDiscardRemoteElement } from "../data/reconcile";`
  - `function reconcileElements(localElements: readonly OrderedExcalidrawElement[], remoteElements: readonly RemoteExcalidrawElement[], localAppState: AppState): ReconciledExcalidrawElement[]`
- `packages/element/tests/textRanges.test.ts` (U15, create)
- `packages/element/tests/textWrapping.test.ts` (U16, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (U17, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U18, edit)
- `packages/excalidraw/tests/data/reconcile.test.ts` (U19, edit)
- `packages/excalidraw/tests/scene/export.test.ts` (U20, edit)
- `excalidraw-app/tests/collab.test.tsx` (U21, edit)
- `packages/excalidraw/CHANGELOG.md` (U22, edit)
