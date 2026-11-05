# Requirements — Rich Text Inline Colour & Highlight Ranges (`20261105-000000-feature-new-rich-text-spans`)

## In scope

1. **Data model for styled character ranges on text elements** (`packages/element/src/types.ts`, `packages/element/src/newElement.ts`, `packages/element/src/textStyleRanges.ts`, `packages/element/src/index.ts`):
   - Extend `ExcalidrawTextElement` (and `ExcalidrawElementSkeleton` / `newTextElement` options) with a persisted list of styled character ranges (`{ start: number; end: number; strokeColor?: string; backgroundColor?: string }`), where `start` and `end` (`0 <= start < end <= originalText.length`) are 0-based, end-exclusive UTF-16 code-unit offsets into `element.originalText`.
2. **Pure range model operations** (`packages/element/src/textStyleRanges.ts`, `packages/element/src/textWrapping.ts`, `packages/element/src/index.ts`):
   - Normalise ranges against `originalText` length (default missing/undefined ranges to `[]`, clamp out-of-bounds indices to `[0, originalText.length]`, drop empty/inverted or unstyled ranges, resolve overlaps, sort by `start`, and merge adjacent ranges with identical `strokeColor` and `backgroundColor`).
   - Apply a `strokeColor` or `backgroundColor` style change to a `[start, end)` selection range in `originalText` (splitting partially overlapping existing ranges, updating the selected slice, clearing `backgroundColor` when set to `"transparent"` or `strokeColor` when matching the element's base `strokeColor`, and merging adjacent identical ranges).
   - Shift existing ranges when `originalText` is edited by computing the edit span between previous `originalText` and next `originalText` (shifting ranges after an insertion/deletion, expanding/shrinking ranges when edits occur inside them, and dropping ranges completely deleted by an edit).
   - Map `originalText` ranges onto wrapped visual lines produced by `getWrappedTextLines` (`packages/element/src/textWrapping.ts`) and slice each wrapped line into ordered visual runs `{ text: string; start: number; end: number; strokeColor?: string; backgroundColor?: string }`, including ranges that cross soft or hard line-wrap boundaries.
3. **Interactive WYSIWYG selection styling and edit maintenance** (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/colorTargets.ts`, `packages/element/src/textElement.ts`, `packages/excalidraw/locales/en.json`):
   - Track the active textarea character selection (`selectionStart`, `selectionEnd`) while editing a text element (standalone, shape-bound label, or sticky-note label) so that clicking a swatch or picking a colour in the properties panel does not lose the active text selection.
   - The initial full-text auto-select (`editable.select()`) performed automatically when opening the editor does **not** count as an active inline range selection; an inline range selection is active only when `0 <= selectionStart < selectionEnd <= originalText.length` is established via `initialSelection` or by a selection action after the editor opens.
   - When `appState.editingTextElement` has an active inline range selection (`selectionStart < selectionEnd`), `actionChangeStrokeColor` and `actionChangeBackgroundColor` apply the chosen `strokeColor` or highlight `backgroundColor` to the selected `[selectionStart, selectionEnd)` range in `originalText` instead of recolouring the entire text element or its sticky-note / bound container.
   - When `appState.editingTextElement` has no active inline range selection (including right after opening the editor via double-click or initial full-text auto-select, or whenever the caret is collapsed `selectionStart === selectionEnd`), picking a colour applies the existing element-wide and sticky-note colour target semantics in `packages/excalidraw/actions/colorTargets.ts` and `packages/excalidraw/actions/actionProperties.tsx`.
   - Expose inline highlight (`backgroundColor`) colour controls in `packages/excalidraw/actions/actionProperties.tsx` when editing a text element so users can apply and clear (`"transparent"`) inline text highlights.
   - Preserve and shift styled character ranges as the user types, inserts, pastes, or deletes text in the WYSIWYG editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`), and keep character-offset ranges intact across element-wide font family, font size, text alignment, and bound-container resize reflows (`packages/element/src/textElement.ts`, `packages/excalidraw/actions/actionProperties.tsx`).
4. **Canvas 2D rendering of styled runs and highlights** (`packages/element/src/renderElement.ts`, `packages/element/src/textMeasurements.ts`):
   - In `drawElementOnCanvas` for `ExcalidrawTextElement`, when an element has styled ranges, slice each wrapped visual line into runs, measure each run's horizontal offset and width via `getLineWidth` (`packages/element/src/textMeasurements.ts`) accounting for `textAlign` (`left`, `center`, `right`) and RTL direction, draw a highlight rectangle (`ctx.fillRect`) behind each run that has a non-transparent `backgroundColor`, and draw each run's text (`ctx.fillText`) with `run.strokeColor ?? element.strokeColor` (applying `applyDarkModeFilter` when `renderConfig.theme === THEME.DARK`).
   - When an element has no styled ranges, preserve the fast per-line `ctx.fillText` path.
5. **Static SVG export of styled runs and highlights** (`packages/excalidraw/renderer/staticSvgScene.ts`):
   - In `renderElementToSvg` for `ExcalidrawTextElement`, when a line contains styled runs, emit `<rect>` elements for runs with a non-transparent `backgroundColor` positioned behind the `<text>` node and emit `<tspan>` children (with `fill` set to the run's `strokeColor`, filtered via `applyDarkModeFilter` when `exportWithDarkMode` is enabled) inside the line's `<text>` node.
   - When an element has no styled ranges, preserve the existing `<text>` output structure so legacy SVG snapshots remain unchanged.
6. **Persistence, restore normalisation, duplication, skeleton conversion, clipboard, undo/redo, and collaboration** (`packages/excalidraw/data/restore.ts`, `packages/excalidraw/data/reconcile.ts`, `packages/excalidraw/clipboard.ts`, `packages/element/src/duplicate.ts`, `packages/element/src/transform.ts`, `packages/element/src/delta.ts`):
   - Normalise styled ranges in `restoreElement` (`packages/excalidraw/data/restore.ts`) so legacy scenes without ranges restore with `[]` and malformed/out-of-bounds ranges are clamped or discarded against `originalText.length`.
   - Deep-copy and preserve styled ranges through `duplicateElement` / `deepCopyElement` (`packages/element/src/duplicate.ts`), `convertToExcalidrawElements` (`packages/element/src/transform.ts`), `ElementsDelta` undo/redo (`packages/element/src/delta.ts`), Excalidraw clipboard copy/paste (`packages/excalidraw/clipboard.ts`), and version-based collaboration reconciliation (`packages/excalidraw/data/reconcile.ts`).

---

## Out of scope

1. Per-span font family, font size, bold, italic, underline, or strikethrough formatting (font metrics remain uniform across the entire `ExcalidrawTextElement`).
2. Replacing the `<textarea>` WYSIWYG editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`) with a `contenteditable` or rich-DOM editor, or introducing third-party rich-text editor dependencies.
3. Markdown shortcuts or inline markup syntax inside text elements (the literal string in `originalText` and `text` remains plain text).
4. Changes to `excalidraw-app/**`, `packages/**/package.json`, `yarn.lock`, build/CI pipelines, or new dependencies.
5. Modifying files outside the frozen write contract specified in `intent_brief.md`.

---

## Functional requirements per module

### Module 1: Element Types, Factories & Range Model (`@excalidraw/element`)

- **FR-1 (Text style range type & element schema)** — `packages/element/src/types.ts`, `packages/element/src/newElement.ts`, `packages/element/src/index.ts`:
  - Define and export `TextStyleRange` with shape `{ readonly start: number; readonly end: number; readonly strokeColor?: string; readonly backgroundColor?: string }`.
  - Add `textStyleRanges?: readonly TextStyleRange[]` to `ExcalidrawTextElement` in `packages/element/src/types.ts` and accept optional `textStyleRanges` in `newTextElement` (`packages/element/src/newElement.ts`), normalising provided ranges against `originalText` and defaulting to `[]`.
- **FR-2 (Range normalisation)** — `packages/element/src/textStyleRanges.ts`, `packages/element/src/index.ts`:
  - Provide a pure normalisation function (e.g., `normalizeTextStyleRanges(ranges, textLength)`) that:
    1. Returns `[]` when `ranges` is `undefined`, `null`, not an array, or `textLength <= 0`.
    2. Clamps numeric `start` and `end` to integer code-unit bounds `[0, textLength]` and drops any entry where `start >= end` or where neither a valid non-empty `strokeColor` nor a valid non-empty, non-`"transparent"` `backgroundColor` is present.
    3. Resolves overlapping ranges deterministically (later ranges override earlier ranges on the overlapping sub-interval for the specified style properties while preserving non-overridden style properties on split sub-intervals).
    4. Sorts disjoint sub-intervals by ascending `start` and merges adjacent ranges (`prev.end === next.start`) when both `strokeColor` and `backgroundColor` are identical.
- **FR-3 (Applying style to a character selection)** — `packages/element/src/textStyleRanges.ts`:
  - Provide a pure function (e.g., `applyTextStyleRange(ranges, textLength, selection, style, elementStrokeColor?)`) that applies `{ strokeColor?: string; backgroundColor?: string }` to `[selection.start, selection.end)`:
    1. If `selection.start >= selection.end`, returns the normalised existing ranges unchanged.
    2. Splits any existing range that partially overlaps `[selection.start, selection.end)` at `selection.start` and/or `selection.end`, preserving unaffected prefix/suffix segments.
    3. Updates the style property (`strokeColor` or `backgroundColor`) across `[selection.start, selection.end)`, retaining any orthogonal property (e.g., applying `backgroundColor` preserves an existing `strokeColor` on the overlapping segment, and vice versa).
    4. Setting `backgroundColor: "transparent"` removes `backgroundColor` from the selected interval; setting `strokeColor` equal to the element's base `element.strokeColor` removes the per-range `strokeColor` override from the selected interval; segments with neither `strokeColor` nor `backgroundColor` left are omitted.
    5. Normalises and merges adjacent ranges with identical styles.
- **FR-4 (Shifting ranges on text edit)** — `packages/element/src/textStyleRanges.ts`:
  - Provide a pure function (e.g., `shiftTextStyleRangesOnEdit(ranges, prevText, nextText)`) that computes the minimal edit splice (`changeStart`, `deletedLength`, `insertedLength`) between `prevText` and `nextText` using common prefix and suffix matching, and updates each range `[start, end)`:
    1. Ranges strictly before `changeStart` (`end <= changeStart`) remain unchanged.
    2. Ranges strictly after `changeStart + deletedLength` (`start >= changeStart + deletedLength`) shift both `start` and `end` by `delta = insertedLength - deletedLength`.
    3. Ranges completely contained within the deleted span (`start >= changeStart && end <= changeStart + deletedLength`) are removed.
    4. Ranges that span across or partially overlap the edit adjust their `start` and/or `end` proportionally to the splice and are re-normalised against `nextText.length`.
- **FR-5 (Mapping ranges onto wrapped visual lines & runs)** — `packages/element/src/textStyleRanges.ts`, `packages/element/src/textWrapping.ts`:
  - Using `getWrappedTextLines(originalText, font, maxWidth, env)` from `packages/element/src/textWrapping.ts` (which returns `WrappedTextLine[]` with `{ text, start, end }` offsets into `originalText`), provide a helper (e.g., `getWrappedLineTextRuns(line, ranges)` or `getTextElementLineRuns(element, env)`) that slices each `WrappedTextLine` into contiguous visual runs `{ text: string; start: number; end: number; strokeColor?: string; backgroundColor?: string }` covering `[line.start, line.end)`.
  - Ranges that span across soft-wrap or hard-newline boundaries produce matching styled runs on every wrapped visual line they intersect; soft-wrap discarded break whitespace outside `[line.start, line.end)` does not corrupt subsequent line offsets.

### Module 2: Canvas Rendering (`@excalidraw/element`)

- **FR-6 (Canvas 2D run & highlight rendering)** — `packages/element/src/renderElement.ts`, `packages/element/src/textMeasurements.ts`:
  - In `drawElementOnCanvas` (`packages/element/src/renderElement.ts`), when rendering an `ExcalidrawTextElement`:
    1. If `element.textStyleRanges` is empty or undefined, render each line with a single `context.fillText` call as today.
    2. If `element.textStyleRanges` is non-empty, map `element.originalText` and `element.textStyleRanges` onto wrapped lines via `getWrappedTextLines` (matching the rendered lines in `element.text`).
    3. For each line and each run within the line, compute the horizontal starting offset using `getLineWidth` (`packages/element/src/textMeasurements.ts`) for the line prefix before the run (respecting `element.textAlign`: `"left"`, `"center"`, `"right"`, and RTL ordering when applicable) and the run's pixel width `getLineWidth(run.text, font, env)`.
    4. Pass 1 (background highlights): For every run with a non-empty, non-`"transparent"` `backgroundColor`, draw a filled rectangle (`context.fillRect(runX, lineTopY, runWidth, lineHeightPx)`) using `applyDarkModeFilter(run.backgroundColor, renderConfig.theme === THEME.DARK)` before drawing the line's glyphs.
    5. Pass 2 (glyph ink): Draw each run's text (`context.fillText(run.text, runDrawX, lineBaselineY)`) with `context.fillStyle = applyDarkModeFilter(run.strokeColor ?? element.strokeColor, renderConfig.theme === THEME.DARK)`.

### Module 3: Static SVG Export (`@excalidraw/excalidraw`)

- **FR-7 (SVG `<tspan>` and highlight `<rect>` export)** — `packages/excalidraw/renderer/staticSvgScene.ts`:
  - In `renderElementToSvg` (`packages/excalidraw/renderer/staticSvgScene.ts`), when exporting an `ExcalidrawTextElement`:
    1. If `element.textStyleRanges` is empty or undefined, emit the exact same `<g>` and `<text>` SVG nodes as existing behaviour.
    2. If `element.textStyleRanges` is non-empty, slice each visual line into runs and measure run horizontal positions and widths with `getLineWidth` and `getLineHeightInPx`.
    3. For each run with a non-empty, non-`"transparent"` `backgroundColor`, create an SVG `<rect>` node (`x`, `y`, `width`, `height`, `fill` filtered via `applyDarkModeFilter` when `exportWithDarkMode` is true) and append it to the text element's `<g>` group prior to the `<text>` node so highlights render behind glyphs.
    4. For any line that contains at least one run with a `strokeColor` override (or multiple runs), populate the line's `<text>` node with `<tspan>` child nodes for each run, setting the `fill` attribute on styled `<tspan>` nodes to the run's colour (filtered via `applyDarkModeFilter` when `exportWithDarkMode` is true).

### Module 4: WYSIWYG Editor, Selection Tracking & Colour Actions (`@excalidraw/excalidraw` & `@excalidraw/element`)

- **FR-8 (Textarea selection tracking & preservation across properties UI)** — `packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`, `packages/excalidraw/components/App.tsx`:
  - While the `.excalidraw-wysiwyg` `<textarea>` is mounted for `appState.editingTextElement`:
    1. Track the active character selection `[selectionStart, selectionEnd)` in `originalText` coordinates. The automatic full-text `editable.select()` executed on editor mount (when `autoSelect && !pendingInitialSelection`) does **not** count as an active inline range selection; an inline range selection becomes active only when `0 <= selectionStart < selectionEnd <= originalText.length` is set via `initialSelection` or changed after editor mount (via pointer/keyboard selection, `select` event, `selectionchange`, `setSelectionRange`, or updating `selectionStart`/`selectionEnd`).
    2. Ensure interacting with colour swatches, the custom colour picker popover, or colour input controls in the properties panel does not clear the tracked selection or prematurely submit/close the WYSIWYG editor, and keep the WYSIWYG editor synchronised with updated `textStyleRanges`.
    3. On textarea `input` events, update `textStyleRanges` on the live scene element and `appState.editingTextElement` by calling `shiftTextStyleRangesOnEdit(prevOriginalText, nextOriginalText)`.
- **FR-9 (Range-aware `actionChangeStrokeColor` and `actionChangeBackgroundColor`)** — `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/colorTargets.ts`, `packages/excalidraw/locales/en.json`:
  - In `actionChangeStrokeColor` and `actionChangeBackgroundColor` (`packages/excalidraw/actions/actionProperties.tsx`) and helper logic in `packages/excalidraw/actions/colorTargets.ts`:
    1. When `appState.editingTextElement` is active and there is an active inline range selection `[start, end)` (`0 <= start < end <= originalText.length`, excluding the untouched initial auto-select on editor mount), apply the selected `strokeColor` or `backgroundColor` to `textStyleRanges` on the editing text element via `applyTextStyleRange` (updating both the scene element and `appState.editingTextElement`) rather than mutating the element-level `strokeColor` or the sticky-note / container `backgroundColor`.
    2. When `appState.editingTextElement` has an active inline range selection `[start, end)`, the colour picker UI reflects the active selection's common `strokeColor` / `backgroundColor` (falling back to the element's `strokeColor` / `"transparent"`).
    3. When no text editor is active, or when `appState.editingTextElement` has no active inline range selection (immediately after opening the editor before any selection change, or when the caret is collapsed `start === end`), picking a colour applies existing element-wide and sticky-note colour target semantics in `packages/excalidraw/actions/colorTargets.ts` and `packages/excalidraw/actions/actionProperties.tsx` (updating `element.strokeColor` / sticky-note ink or sticky-note `backgroundColor` and the corresponding `currentItem*` `AppState` defaults).
    4. Render inline highlight (`backgroundColor`) colour picker controls within `packages/excalidraw/actions/actionProperties.tsx` while editing a text element so users can apply and clear (`"transparent"`) inline text highlights without altering `getShapeActionPredicates`.
- **FR-10 (Reflow and property-change range preservation)** — `packages/element/src/textElement.ts`, `packages/excalidraw/actions/actionProperties.tsx`:
  - Changing font family (`actionChangeFontFamily`), font size (`changeFontSize`), text alignment (`actionChangeTextAlign`), or resizing a text element / bound-text container (`redrawTextBoundingBox`, `handleBindTextResize`, `updateBoundElements` in `packages/element/src/textElement.ts`) re-wraps `originalText` into `text` without altering `originalText` or discarding `textStyleRanges`, so ranges automatically map onto the newly wrapped visual lines.

### Module 5: Restore, Duplication, Skeleton, Clipboard, Undo/Redo & Collaboration (`@excalidraw/excalidraw` & `@excalidraw/element`)

- **FR-11 (Scene restore & legacy compatibility)** — `packages/excalidraw/data/restore.ts`:
  - In `restoreElement` (`packages/excalidraw/data/restore.ts`), for text elements (`type === "text"`), normalise `element.textStyleRanges` against `originalText.length` using `normalizeTextStyleRanges`. Legacy elements without `textStyleRanges` default to `[]`, and elements with malformed or out-of-bounds ranges have their ranges clamped/cleaned without throwing or dropping the element.
- **FR-12 (Element lifecycle & transport fidelity)** — `packages/element/src/duplicate.ts`, `packages/element/src/transform.ts`, `packages/element/src/delta.ts`, `packages/excalidraw/clipboard.ts`, `packages/excalidraw/data/reconcile.ts`:
  - `deepCopyElement` and `duplicateElement` (`packages/element/src/duplicate.ts`) clone `textStyleRanges` arrays and range objects so mutating a duplicate never mutates the source element.
  - `convertToExcalidrawElements` (`packages/element/src/transform.ts`) forwards and normalises `textStyleRanges` when present on a text `ExcalidrawElementSkeleton`.
  - History delta calculation and application (`packages/element/src/delta.ts`), clipboard serialisation/paste (`packages/excalidraw/clipboard.ts`), and remote element reconciliation (`packages/excalidraw/data/reconcile.ts`) preserve `textStyleRanges` across undo/redo, copy/paste, and multiplayer sync.

---

## Non-functional requirements

- **NFR-1 (Backward compatibility of saved scenes and existing text elements)**:
  - Saved `.excalidraw` JSON files, library items, clipboard payloads, and embedded SVG/PNG scenes created prior to this feature (where `textStyleRanges` is absent on `ExcalidrawTextElement`) must load, render on Canvas, and export to SVG identically to existing behaviour (`textStyleRanges` normalised to `[]`).
  - Existing unit and integration snapshots for unstyled text elements (including `packages/excalidraw/tests/scene/export.test.ts` and `packages/excalidraw/tests/data/restore.test.ts`) must continue to pass without regression.
- **NFR-2 (Determinism and pure range operations)**:
  - All functions in `packages/element/src/textStyleRanges.ts` must be pure, side-effect-free, and deterministic: applying or shifting ranges must never mutate input arrays or range objects in place, and must always output canonical normalised ranges (sorted, clamped to `[0, originalText.length]`, non-overlapping, adjacent-merged).
- **NFR-3 (Rendering performance on unstyled text)**:
  - Text elements with empty `textStyleRanges` (`length === 0`) must skip per-run segmentation and width measurement loops during Canvas rendering (`packages/element/src/renderElement.ts`) and SVG export (`packages/excalidraw/renderer/staticSvgScene.ts`).
- **NFR-4 (Dark mode parity)**:
  - Both Canvas rendering (`packages/element/src/renderElement.ts`) and SVG export (`packages/excalidraw/renderer/staticSvgScene.ts`) must pass run `strokeColor` and `backgroundColor` through `applyDarkModeFilter` when dark mode is active, matching element-level dark-mode colour inversion.
- **NFR-5 (Strict write-scope and dependency hygiene)**:
  - Implementation must only touch files permitted by the run's frozen write contract in `intent_brief.md` and must not add external dependencies or modify `package.json` / `yarn.lock`.

---

## PII inventory

| Field | Sensitivity | Protection |
| --- | --- | --- |
| `ExcalidrawTextElement.text` / `ExcalidrawTextElement.originalText` | Low (user-authored diagram text; may incidentally contain user-entered names or notes) | Client-side only in scene state; existing Excalidraw local storage / end-to-end encrypted collaboration handling applies unchanged. |
| `ExcalidrawTextElement.textStyleRanges` (`start`, `end`, `strokeColor`, `backgroundColor`) | None (integer character indices and CSS colour strings) | Validated and clamped to `[0, originalText.length]` on restore (`packages/excalidraw/data/restore.ts`); no network transmission outside standard scene serialisation. |

---

## Role matrix

| Role | Resource | Action |
| --- | --- | --- |
| Canvas Editor User (`viewModeEnabled: false`) | `ExcalidrawTextElement` & `textStyleRanges` | Create, select text substrings in WYSIWYG editor, apply/clear inline `strokeColor` and `backgroundColor` highlights, edit text (shifting ranges), resize/reflow, duplicate, copy/paste, undo/redo, and export to Canvas/SVG. |
| View-Only User (`viewModeEnabled: true`) | `ExcalidrawTextElement` & `textStyleRanges` | View rendered inline text colours and background highlights on Canvas and export scene to SVG/PNG; cannot open WYSIWYG editor or mutate `textStyleRanges`. |
| Collaborator / Remote Peer (`reconcileElements`) | `ExcalidrawTextElement` & `textStyleRanges` | Receive and reconcile updated `ExcalidrawTextElement` versions containing `textStyleRanges` via `reconcileElements` (`packages/excalidraw/data/reconcile.ts`) and `restoreElements` (`packages/excalidraw/data/restore.ts`). |
| Programmatic Embedder (`@excalidraw/excalidraw` / `@excalidraw/element` consumer) | `ExcalidrawElementSkeleton` / `restoreElements` / `exportToSvg` / `exportToCanvas` | Pass `textStyleRanges` via `convertToExcalidrawElements` or `restoreElements` and render/export styled text runs via `exportToCanvas` and `exportToSvg`. |

---

## Acceptance criteria

All acceptance criteria are verified by executing:
```bash
yarn test:typecheck && yarn test:code && yarn test:app --watch=false
```

- **AC-1 (Applying and clearing inline `strokeColor` and `backgroundColor` ranges)**:
  - Unit tests in `packages/element/tests/textStyleRanges.test.ts` and integration tests in `packages/excalidraw/tests/textStyleRanges.test.tsx`, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`, and `packages/excalidraw/actions/actionProperties.test.tsx` verify that:
    1. Selecting a substring `[start, end)` in the WYSIWYG editor and applying a `strokeColor` or `backgroundColor` creates a normalised range on `element.textStyleRanges`.
    2. Applying a style to a selection that partially overlaps an existing range splits the existing range and merges adjacent ranges with identical styles.
    3. Applying `backgroundColor: "transparent"` clears the highlight on the selected range; applying `strokeColor` equal to `element.strokeColor` clears the per-range ink override; picking a colour right after opening the editor (under initial auto-select or a collapsed caret `start === end`) leaves `textStyleRanges` untouched and applies element-wide / sticky-note colour targets as verified in `packages/excalidraw/tests/colorTargets.test.ts` and `packages/excalidraw/tests/stickyNotes.test.tsx`.
- **AC-2 (Range shifting under text insertion, deletion, and replacement)**:
  - Unit tests in `packages/element/tests/textStyleRanges.test.ts` and editor tests in `packages/excalidraw/tests/textStyleRanges.test.tsx` / `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` verify that inserting, deleting, or replacing characters before a range shifts `[start, end)` by the character delta; editing inside a range expands or shrinks `end`; and deleting across an entire range removes it cleanly.
- **AC-3 (Wrapped-line mapping and reflow invariance)**:
  - Unit tests in `packages/element/tests/textStyleRanges.test.ts` and `packages/element/tests/textWrapping.test.ts` verify that ranges defined in `originalText` map accurately onto `WrappedTextLine[]` runs across both hard newlines (`\n`) and soft word-wrap breaks (where break-point spaces are stripped from visual lines), and remain bound to the same substrings when `maxWidth`, `fontSize`, or `fontFamily` changes.
- **AC-4 (Canvas 2D rendering of styled runs and highlight rects)**:
  - Tests in `packages/excalidraw/tests/textStyleRanges.test.tsx` and `packages/excalidraw/tests/export.test.tsx` / `packages/excalidraw/tests/scene/export.test.ts` verify that `drawElementOnCanvas` draws `fillRect` highlight rectangles behind runs with `backgroundColor` and calls `fillText` with each run's `strokeColor` (and dark-mode filtered colour when `theme === THEME.DARK`).
- **AC-5 (SVG export of `<tspan>` runs and highlight `<rect>` elements)**:
  - Tests in `packages/excalidraw/tests/textStyleRanges.test.tsx`, `packages/excalidraw/tests/export.test.tsx`, and `packages/excalidraw/tests/scene/export.test.ts` verify that `exportToSvg` / `renderElementToSvg` emits `<rect>` highlight elements and `<tspan fill="...">` run elements for text elements with `textStyleRanges` (including dark-mode filter support), while emitting unchanged `<text>` output for text elements without `textStyleRanges`.
- **AC-6 (Backward-compatible restore, normalisation, duplication, undo/redo, clipboard, and skeleton conversion)**:
  - Tests in `packages/excalidraw/tests/data/restore.test.ts`, `packages/element/tests/newElement.test.ts`, and `packages/element/tests/delta.test.tsx` verify that:
    1. Legacy saved text elements without `textStyleRanges` restore with `textStyleRanges: []`.
    2. Text elements with out-of-bounds (`start < 0`, `end > originalText.length`), inverted (`start >= end`), or overlapping ranges are normalised deterministically on `restoreElement`.
    3. `duplicateElement`, `convertToExcalidrawElements`, `ElementsDelta` (undo/redo), clipboard copy/paste, and `reconcileElements` preserve `textStyleRanges`.
- **AC-7 (Full workspace verification suite)**:
  - Running `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` completes with zero TypeScript errors, zero lint/code errors, and all unit and application tests passing.

---

## Open questions for HITL

None. The scope, data representation (`originalText` character offsets), rendering semantics (Canvas and SVG), editor interaction model, and file write boundaries are fully specified in the approved `intent_brief.md`.
