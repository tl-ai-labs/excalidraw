# Requirements — feature-new — Per-range text colour and highlight

Run: `20261105-213840-feature-new-rich-text-spans` · Intent: feature-new · Source: `intent_brief.md`, `discovery.md`

A text element today has one `strokeColor` for all of its text. This feature lets a user select part of the
text while editing and give that part its own text colour, a highlight (background) colour, or both. The
styling is stored on the element, kept through editing, wrapping, containers, font changes and collaboration,
drawn on the canvas and written to SVG export.

## In scope

1. A styled-range data model on text elements (`packages/element`), with offsets counted against
   `originalText`.
2. Pure range operations: normalise, apply a style to a range, shift on insert/delete, clamp to a text
   length, and map ranges onto wrapped lines.
3. Canvas rendering of text colour and highlight per run, for free text and bound text.
4. Restore of saved scenes: legacy text with no ranges, and sanitising malformed ranges.
5. The text editor (`textWysiwyg.tsx`, still a `<textarea>`) maps its selection to `originalText` offsets and
   shifts ranges as the user types.
6. The stroke- and background-colour controls apply to the editor's selection as text colour and highlight.
7. SVG export writes `<tspan>` runs with their own fill, and highlight rectangles.
8. Collaboration: ranges travel with the element through reconciliation.
9. New English UI strings and a CHANGELOG entry.
10. Tests covering the above (see Acceptance criteria).

## Out of scope

1. Replacing the `<textarea>` with contenteditable or any rich-text editor; no live styled preview inside the
   editor.
2. Per-range bold, italic, underline, font family or font size.
3. Markdown, or pasting rich text from other apps (paste inserts plain text, as today).
4. Translations other than `en.json`.
5. Changes to the collab transport, `excalidraw-app/**`, any `package.json` or `yarn.lock`.
6. Per-range styling of non-text elements, or of text inside frames' names, embeddables or other UI text.

## Functional requirements

### Module: range model (`packages/element/src/textStyleRanges.ts`, `types.ts`)

- **FR-1** `ExcalidrawTextElement` gains one optional, readonly field holding an array of styled ranges. Each
  range has `start` and `end` (integer UTF-16 offsets into `originalText`, `0 <= start < end <=
  originalText.length`), and an optional text colour and an optional highlight colour; a range carries at
  least one of the two. The field is absent (or empty) on text with no styling.
- **FR-2** A normalise operation returns ranges that are sorted by `start`, non-overlapping, clamped to the
  text length, with zero-length or style-less ranges dropped and adjacent ranges of identical style merged.
  Every stored array is in normalised form.
- **FR-3** Applying a style to `[start, end)` sets only the given property (text colour or highlight) over that
  span and leaves the other property of any overlapped range as it was; ranges are split at the span's
  boundaries as needed. Applying "no highlight" (transparent) removes the highlight over the span; applying
  "no text colour" removes the text colour over the span, so that span falls back to the element's
  `strokeColor`.
- **FR-4** Shifting on edit: given a replacement of `[from, to)` in `originalText` by `n` characters, ranges
  entirely after the edit move by `n - (to - from)`; ranges entirely before are unchanged; ranges overlapping
  the deleted span shrink (and are dropped if empty); characters inserted strictly inside a range take that
  range's style, characters inserted at a range's boundary do not.
- **FR-5** A diff helper derives the single replacement `[from, to) -> n` between an old and a new
  `originalText` (common prefix and suffix), so any text change, not only editor keystrokes, can shift ranges
  (FR-4).
- **FR-6** Line mapping: given `originalText`, the wrapped `text` and the ranges, return for each wrapped line
  its runs (substring plus effective text colour and highlight). Mapping is correct when wrapping inserts line
  breaks, drops or keeps whitespace at the break, and when `originalText` already has hard newlines.
- **FR-7** The model and its helpers are exported from `packages/element/src/index.ts`.

### Module: element lifecycle (`newElement.ts`, `textElement.ts`, `textWrapping.ts`, `textMeasurements.ts`)

- **FR-8** `newTextElement` accepts the optional ranges and stores them normalised; without them the element
  has no range field, so elements without styling are shaped exactly as today.
- **FR-9** Any code path that sets a text element's `originalText` (editor update, `updateTextElement`, bound
  text refresh, API updates) keeps the ranges consistent with the new text: shifted per FR-4/FR-5 where the
  old text is known, otherwise clamped (FR-2).
- **FR-10** Re-wrapping (container resize, width change, `autoResize` toggle, font family or font size
  change, line-height change) never changes the stored ranges; only their line mapping (FR-6) changes.
- **FR-11** Measurement of text dimensions is unchanged by ranges (colour does not change glyph metrics).

### Module: canvas rendering (`renderElement.ts`)

- **FR-12** A text element with ranges draws each wrapped line as consecutive runs: each run's highlight (if
  any) as a filled rectangle of line height behind the run's glyphs, then the run's text in its text colour
  (or the element's `strokeColor` when the run has none). Runs keep the alignment (left, center, right) and
  the vertical position the whole line has today.
- **FR-13** Text with no ranges takes the existing single-`fillText`-per-line path unchanged.
- **FR-14** The per-element canvas cache is invalidated when the ranges change, as it is for a text or colour
  change. Dark mode and element opacity apply to range colours the same way they apply to `strokeColor`.

### Module: restore and collaboration (`data/restore.ts`, `data/reconcile.ts`)

- **FR-15** Restoring a text element with no range field yields an element with no range field (legacy files
  load unchanged).
- **FR-16** Restoring a text element with a range field sanitises it: non-array values, ranges with
  non-integer or out-of-bound offsets, `start >= end`, and non-string colours are dropped or clamped, and the
  result is normalised (FR-2); an empty result means no range field.
- **FR-17** Reconciliation keeps a text element's ranges together with the text of the same version: the
  element that wins reconciliation contributes both its `originalText` and its ranges, so a peer never ends up
  with ranges from one version and text from another. `reconcile.ts` changes only if this does not already
  hold.

### Module: editor (`wysiwyg/textWysiwyg.tsx`, `components` wiring as needed)

- **FR-18** While a text element is being edited, the editor exposes its current selection as
  `[selectionStart, selectionEnd)` offsets into `originalText` (the textarea value is `originalText`), and
  that selection stays available to the colour controls when the user clicks them (clicking the properties
  panel must not lose it).
- **FR-19** Every change to the textarea value shifts the element's ranges per FR-4/FR-5 in the same update
  that changes `originalText`, so ranges follow typing, deleting, pasting, tab indent/outdent and undo inside
  the textarea.
- **FR-20** If app state has to hold the editor selection, it is added to `appState.ts` / `types.ts` as
  non-persisted, non-collaborated UI state.

### Module: colour controls (`actions/actionProperties.tsx`, `actionStyles.ts`, `colorTargets.ts`, `en.json`)

- **FR-21** With a text element in editing and a non-empty editor selection, picking a stroke colour applies it
  as the text colour of the selected range (FR-3), and picking a background colour applies it as the
  highlight of the selected range; the element's own `strokeColor`/`backgroundColor` and the current-item
  defaults are not changed by a range pick.
- **FR-22** With an empty editor selection, or when not editing, the colour controls behave exactly as today
  (element-level colour, current-item defaults). An element-level stroke colour change keeps existing range
  text colours (they are explicit overrides).
- **FR-23** For a bound text element being edited inside a container, a background pick with a non-empty
  selection highlights the range of the label text and does not change the container's background.
- **FR-24** A range pick is one history entry: undo restores the previous ranges, redo re-applies them.
- **FR-25** While a range is selected, the colour picker shows the range's colour when the whole selection has
  one value, and otherwise the element's colour; the panel labels the controls so the user can tell a range
  pick from an element pick (new strings in `en.json` only).
- **FR-26** Copy style / paste style (`actionStyles.ts`) does not copy ranges between elements (ranges are
  tied to the source text's offsets); pasting style onto a text element keeps the target's own ranges
  clamped to its text.

### Module: SVG export (`renderer/staticSvgScene.ts`)

- **FR-27** A text element with ranges exports each line as one `<text>` element holding one `<tspan>` per run,
  each tspan's `fill` set to the run's text colour (or the element's `strokeColor`), with dark-mode filtering
  applied as for the element fill today. Line alignment uses the same `text-anchor`/`x` as today.
- **FR-28** Each highlighted run exports a `<rect>` filled with the highlight colour, behind the line's text and
  covering the run's horizontal extent and the line height. Run widths come from the same text measurement
  the canvas uses.
- **FR-29** Text with no ranges exports exactly as today (existing export snapshots unchanged).

### Module: docs

- **FR-30** `packages/excalidraw/CHANGELOG.md` gets an "Unreleased" feature entry describing per-range text
  colour and highlight and the new optional element field.

## Non-functional requirements

- **NFR-1 Backward compatibility.** The field is optional. Files and elements without styling serialise byte-for-byte as
  today; existing snapshots of plain text must not change. Older clients that ignore the field still render
  the text in its `strokeColor`.
- **NFR-2 Performance.** No extra work per frame for text without ranges. Range operations are linear in the number of
  ranges plus text length.
- **NFR-3 Purity.** The model helpers are pure functions with no DOM or React dependency (they live in
  `packages/element`).
- **NFR-4 Type safety.** `yarn test:typecheck` passes under the strict config; no `any` in new public types.
- **NFR-5 Lint.** `yarn test:code` (eslint, max-warnings 0) passes.
- **NFR-6 Conventions.** Follow `AGENTS.md`/copilot rules carried by the stack profile: immutable element updates
  through `mutateElement`/`newElementWith`, `app.ownerDocument`/`app.ownerWindow` over globals, functional
  React.
- **NFR-7 Colour safety in SVG.** Colours written to SVG attributes go through the same path as `strokeColor`
  today (DOM attribute setters, never string-concatenated markup).

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | The feature stores colours and integer offsets only; text content is already part of the element. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Text element ranges | Create / change / remove while editing (FR-18–FR-24) |
| Collaborator (peer) | Text element ranges | Receives and edits them as part of the element (FR-17); same rights as the editor user |
| Viewer (view mode) | Text element ranges | Sees them rendered; cannot change them (colour controls hidden, as today) |

## Acceptance criteria

- **AC-1** Unit tests (`packages/element/tests/textStyleRanges.test.ts`) cover normalise (FR-2), apply style
  with splitting and independent text colour/highlight (FR-3), insert and delete shifting including boundary
  and overlap cases (FR-4), the diff helper (FR-5), and line mapping across soft wraps and hard newlines
  (FR-6).
- **AC-2** Restore tests (`packages/excalidraw/tests/data/restore.test.ts`) show a legacy text element without
  ranges restores with no range field, and malformed ranges are sanitised (FR-15, FR-16).
- **AC-3** Wrapping/element tests show that re-wrapping at a new width or font size leaves the stored ranges
  unchanged and maps them onto the new lines (FR-10), and that a bound text element keeps its ranges through
  a container resize.
- **AC-4** jsdom tests (`packages/excalidraw/tests/textStyleRanges.test.tsx` and/or `textWysiwyg.test.tsx`)
  open the editor, select a sub-range of the text, pick a stroke colour and a background colour, and assert
  the element's ranges hold the expected offsets and colours while `strokeColor`/`backgroundColor` are
  unchanged (FR-18, FR-21, FR-23); typing before the range shifts it (FR-19); undo restores the previous
  ranges (FR-24).
- **AC-5** A jsdom test shows that with no selection the stroke-colour pick still changes the element's
  `strokeColor` (FR-22).
- **AC-6** SVG export tests (`packages/excalidraw/tests/export.test.tsx`) assert a styled text element exports
  `<tspan>` elements with the expected `fill` per run and a `<rect>` for a highlighted run, and that plain text
  exports without `<tspan>` (FR-27–FR-29).
- **AC-7** A reconcile test (`packages/excalidraw/tests/data/reconcile.test.ts`) shows the winning version of a
  text element brings its own ranges with its own text (FR-17).
- **AC-8** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass, with no failure
  that was not already failing before the run.

## Assumptions

- **A-1** The highlight is drawn per run as a rectangle of the line's height (no padding, no rounded corners).
- **A-2** Text colour picks on a range use the stroke colour picker's palette; highlight picks use the
  background colour picker's palette, where "transparent" removes the highlight.
- **A-3** The editor keeps showing plain, single-colour text while editing (non-goal: no live styled preview);
  the styled result shows on the canvas once editing ends, and under the textarea where the canvas is visible.

## Resolved questions (Gate 1, approved 2026-11-05)

1. **No explicit "clear text colour" control for a range.** Picking the element's own stroke colour on a
   selected range is enough. The UI adds no extra control; picking a colour equal to the element's
   `strokeColor` clears the range's text colour (the model's "no text colour" operation, FR-3), so the span
   falls back to `strokeColor`.
2. **Copy style / paste style never carries ranges**, even when source and target text are identical (FR-26).
