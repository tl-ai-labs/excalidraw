## Conventions

- TypeScript strict mode everywhere; no `any` except where the surrounding code already casts (e.g. untrusted input in restore.ts is typed `unknown` and narrowed).
- Formatting is prettier through eslint-plugin-prettier (80 columns, double quotes, trailing commas, 2-space indent); the eslint check runs `--fix` first, so never hand-align code.
- Import groups, separated by blank lines: external packages, then `@excalidraw/*` value imports, then `import type` blocks, then relative imports. Across packages import through the `@excalidraw/common` / `@excalidraw/element` / `@excalidraw/element/types` aliases; inside `packages/element/src` import siblings relatively (`./textStyleRanges`). Type-only imports use `import type`.
- Elements are immutable by convention: change them only through `newElementWith(el, updates)` or `scene.mutateElement(el, updates)` so `version`/`versionNonce` bump; a `styleRanges` change always writes a brand-new array of brand-new range objects, never an in-place edit.
- Text style offsets are UTF-16 code-unit offsets into `originalText` (the same units as `textarea.selectionStart`), half-open `[start, end)`.
- A stored range object carries only the style keys that are set: `color` and/or `backgroundColor` are omitted when unset, never `null` or `undefined` in stored data.
- Every colour painted on canvas or written to SVG goes through `applyDarkModeFilter(color, theme === THEME.DARK)` (canvas: `renderConfig.theme`; SVG: `renderConfig.theme`).
- SVG nodes are created with `svgRoot.ownerDocument.createElementNS(SVG_NS, name)` and filled with `setAttribute` / `textContent`; never the global `document`, never string-built markup.
- User-facing strings go through `t("labels.<key>")`; new keys are added to `packages/excalidraw/locales/en.json` only.
- Tests use vitest globals (`describe`, `it`, `expect`, `vi`). jsdom editor tests render `<Excalidraw handleKeyboardGlobally={true} />`, drive it with `API`, `Keyboard`, `UI`, `getTextEditor`, `updateTextEditor`, wrap state changes in `act`, read state from `window.h` (`h.elements`, `h.state`, `h.app`), and assert with `toEqual` / `toBe` on explicit values, not snapshots.
- No new dependencies; never touch `package.json`, `yarn.lock` or `packages/excalidraw/types/**`.

## Decisions

- Base string of range offsets: Offsets index `originalText`. Wrapping, re-measuring, font changes and container resizes rewrite only `text`, so ranges never move for them; renderers map ranges onto wrapped lines at draw time with `getTextStyleLineRuns`. (not Offsets into wrapped `text` (every re-wrap would have to remap ranges)) — Gate 1 default; `originalText` is exactly the textarea value, so selection offsets need no translation and wrapping cannot drift ranges.
- Field name, type and default: `ExcalidrawTextElement.styleRanges?: readonly TextStyleRange[]` with `TextStyleRange = Readonly<{ start: number; end: number; color?: string; backgroundColor?: string }>`, declared in `packages/element/src/types.ts`. Omit-when-empty: the key exists on an element only when it holds at least one range. `newTextElement` writes it only when the clamped input has a range; `restore.ts` writes it only when sanitising leaves a range (and strips any incoming key otherwise); App.text.ts and the colour actions remove the key with `withoutStyleRanges` when an edit or a clear leaves no range. A stored `styleRanges` is never `[]`. Readers treat a missing (or `undefined`) field as no ranges. (not Always present, `[]` by default (changes every created/restored text element and every committed snapshot that serialises one, breaking NFR-1 byte-identity and the frozen file scope); not A required field (breaks every text-element literal and skeleton in the repo and in host apps); not `null`-valued style keys (larger JSON, two spellings of unset)) — Gate 2 instruction: every existing element, scene and snapshot stays byte-identical; same optional-field precedent as `labelPosition?`.
- Where ranges shift while typing: `AppText.handleTextWysiwyg`'s `updateElement` (App.text.ts) computes `shiftRangesForEdit(element.styleRanges, element.originalText, nextOriginalText)` for every onChange and onSubmit, and writes `styleRanges` only when the helper returns a different reference. (not Shifting inside textWysiwyg's oninput with a caret hint (jsdom and programmatic value changes leave the caret at the end, and paste/indent/normalisation paths bypass it)) — One code path already receives the before and after `originalText` for typing, paste, indent, IME and submit; a common-prefix/suffix diff is exact for every edit except inserts that repeat a neighbouring character, where the result renders identically.
- Insert / delete semantics at range boundaries: Splice (offset o, deleted d, inserted i): start' = start < o ? start : start >= o + d ? start - d + i : o + i; end' = end <= o ? end : end >= o + d ? end - d + i : o; a range with start' >= end' is removed; the result is normalised. So an insert exactly at a range start shifts it, an insert exactly at its end does not extend it, an insert strictly inside grows it. (not Extending a range when typing at its end (rich-editor style)) — Deterministic and matches FR-3 wording (before shifts, inside grows, across trims, after untouched).
- Exposing the textarea selection to actions: `packages/excalidraw/actions/colorTargets.ts` holds a per-app registry (`WeakMap` keyed by the App instance) of a live selection source `{ elementId, read() }`, registered by `textWysiwyg` when the editor opens and cleared on cleanup, plus a listener set notified on selection-changing events. Actions call `getTextEditorSelection(app, appState)` at perform time; the highlight picker subscribes through `subscribeToTextEditorSelection`. (not A new AppState field (packages/excalidraw/types.ts and appState.ts are outside the allowlist and every appState snapshot would churn); not Querying `.excalidraw-wysiwyg` from the DOM inside actions (breaks with several editors on a page)) — Reads the selection at execution time (never a stale render closure, per resolveColorTarget's rule) and needs no React state for the textarea.
- Stroke colour with a text selection: While `getTextEditorSelection` returns a non-empty selection, `actionChangeStrokeColor` writes the colour to that range only: element `strokeColor`, sticky-note ink and the `currentItem*` defaults are left unchanged. Picking a colour equal to the element's `strokeColor` clears the range's `color`. With no selection or no open editor the existing code path runs untouched. — FR-8; clearing on the element colour keeps the data minimal and lets the run follow later element-colour changes.
- Highlight control: New action `actionChangeTextHighlight` (name `changeTextHighlight`, in actionProperties.tsx) whose PanelComponent renders the new `TextHighlightPicker`: a strip of five swatches from `DEFAULT_ELEMENT_BACKGROUND_PICKS` (`transparent` clears the highlight). It renders only while a text is being edited with a non-empty textarea selection, in the full and compact styles panels (not the mobile bar). Value shape `{ color: string | null }`; `null` or a transparent colour clears `backgroundColor`. (not Reusing `ColorPicker` with type `elementBackground` (its popup state collides with the background picker shown alongside it)) — Gate 1 default: a new compact highlight picker shown only while editing with a selection.
- Mapping ranges onto wrapped lines: `getTextStyleLineRuns(text, originalText, ranges)` walks the lines of `text` and aligns each to `originalText` without measuring: after a line ending at offset c, if `originalText` from c to its next `\n` is whitespace only, the next line starts after that `\n` (hard break), otherwise at the first non-whitespace character at or after c (soft break, trimmed whitespace skipped). If any line is not found at its aligned offset it returns `null`, and both renderers draw the element exactly as today. — O(n), no width needed (the wrap width is not stored), and a safe fallback for legacy or out-of-sync `text`.
- Right-to-left text: When `isRTL(element.text)` is true both renderers skip per-run drawing and draw the element exactly as today (ranges stay stored). — Per-run left-to-right placement is wrong for bidi text; out of scope to lay out bidi runs.
- Unchanged modules: `textWrapping.ts`, `textElement.ts`, `textMeasurements.ts`, `mutateElement.ts`, `delta.ts`, `data/reconcile.ts`, `actions/actionStyles.ts` and `actions/register.ts` are not edited. Delta compares top-level props shallowly and stores the whole array as the replaced value; reconcile is whole-element last-writer-wins; paste-styles copies an explicit property list that excludes `styleRanges`; `register()` already registers any action defined in actionProperties.tsx. — Offsets on `originalText` make wrapping/refresh no-ops for ranges; the jsdom tests pin undo/redo, reconcile and paste-styles behaviour instead.
- Colour sanitising: A colour is kept only when it is a string of 1 to 64 characters matching `/^[#a-z0-9(),.%\s/-]+$/i` and not containing `url(` (case-insensitive); otherwise the whole range entry is dropped. — NFR-7: only plain colour syntax ever reaches an SVG `fill` attribute.
- Snapshot churn: None expected: with omit-when-empty no existing element gains a key, so no committed snapshot changes. Nothing in this run regenerates snapshots: no unit or check runs `yarn test:update`, `vitest -u` or `--update`. If an existing snapshot still fails, it is left as is and listed at Gate 3 with the reason. (not A final `yarn test:update` tooling step (rewrites snapshots outside the allowlist, e.g. packages/element/src/__tests__/__snapshots__/transform.test.ts.snap and packages/common/src/__snapshots__/colors.test.ts.snap)) — Gate 2 instruction: no blanket snapshot refresh; NFR-1 byte-identity is proved by the unchanged snapshots passing.
- Environment variables: None added. — Pure client-side feature; no config surface.

## Files of this change

- `packages/element/src/types.ts` (U01, edit)
  - `type TextStyleRange(): Readonly<{ start: number; end: number; color?: string; backgroundColor?: string }>`
- `packages/element/src/textStyleRanges.ts` (U02, create) — import: `import { clampRanges, getTextStyleLineRuns } from "./textStyleRanges";`
  - `type TextStyleUpdate(): { color?: string | null; backgroundColor?: string | null }`
  - `type TextStyleRun(): { text: string; color: string | null; backgroundColor: string | null }`
  - `function normalizeRanges(ranges: readonly TextStyleRange[]): TextStyleRange[]`
  - `function clampRanges(ranges: readonly TextStyleRange[], textLength: number): TextStyleRange[]`
  - `function shiftRangesForSplice(ranges: readonly TextStyleRange[], offset: number, deletedCount: number, insertedCount: number): TextStyleRange[]`
  - `function shiftRangesForEdit(ranges: readonly TextStyleRange[] | undefined, prevText: string, nextText: string): readonly TextStyleRange[] | undefined`
  - `function applyStyleToRange(ranges: readonly TextStyleRange[], start: number, end: number, style: TextStyleUpdate): TextStyleRange[]`
  - `function sanitizeTextStyleRanges(input: unknown, textLength: number): TextStyleRange[]`
  - `function getTextStyleLineRuns(text: string, originalText: string, ranges: readonly TextStyleRange[] | undefined): TextStyleRun[][] | null`
  - `function withoutStyleRanges(element: T extends { styleRanges?: readonly TextStyleRange[] }): T`
- `packages/element/src/index.ts` (U03, edit)
  - `re-export applyStyleToRange(): see U02`
- `packages/element/src/newElement.ts` (U04, edit)
  - `function newTextElement(opts: { ...existing; styleRanges?: ExcalidrawTextElement["styleRanges"] } & ElementConstructorOpts): NonDeleted<ExcalidrawTextElement>`
- `packages/element/src/renderElement.ts` (U05, edit)
- `packages/excalidraw/actions/colorTargets.ts` (U06, edit)
  - `type TextEditorSelection(): { elementId: string; start: number; end: number }`
  - `type TextEditorSelectionSource(): { elementId: string; read: () => { start: number; end: number } }`
  - `function setTextEditorSelectionSource(app: object, source: TextEditorSelectionSource | null): void`
  - `function notifyTextEditorSelectionChange(app: object): void`
  - `function subscribeToTextEditorSelection(app: object, listener: () => void): () => void`
  - `function getTextEditorSelection(app: object, appState: Pick<AppState, "editingTextElement">): TextEditorSelection | null`
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U07, edit)
- `packages/excalidraw/components/App.text.ts` (U08, edit)
- `packages/excalidraw/components/TextHighlightPicker.tsx` (U09, create) — import: `import { TextHighlightPicker } from "../components/TextHighlightPicker";`
  - `component TextHighlightPicker(props: { app: AppClassProperties; appState: UIAppState; compact: boolean; onChange: (color: string) => void }): React.JSX.Element | null`
- `packages/excalidraw/actions/types.ts` (U10, edit)
- `packages/excalidraw/locales/en.json` (U11, edit)
- `packages/excalidraw/actions/actionProperties.tsx` (U12, edit)
  - `action actionChangeTextHighlight(): Action<{ color?: string | null }>`
- `packages/excalidraw/actions/index.ts` (U13, edit)
- `packages/excalidraw/components/Actions.tsx` (U14, edit)
- `packages/excalidraw/renderer/staticSvgScene.ts` (U15, edit)
- `packages/excalidraw/data/restore.ts` (U16, edit)
- `packages/excalidraw/CHANGELOG.md` (U17, edit)
- `packages/element/tests/textStyleRanges.test.ts` (U18, create)
- `packages/excalidraw/tests/textStyleRanges.test.tsx` (U19, create)
