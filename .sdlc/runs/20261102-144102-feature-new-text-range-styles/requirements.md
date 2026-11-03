# Requirements — feature-new — Per-range text colour and highlight

Run: `20261102-144102-feature-new-text-range-styles` · Intent: `feature-new` · Policy: `opus55-only` (estimated)
Source: `intent_brief.md` (Gate 0 approved 2026-11-02), `discovery.md`, `.sdlc/baseline/stack-profile.md`.

## Summary

A text element today has one colour (`strokeColor`) for all of its text. This feature adds an optional,
ordered list of styled ranges to a text element. Each range covers `[start, end)` of `originalText` and carries
a text colour, a highlight (background) colour, or both. While editing a text, the user selects part of it and
applies a colour or a highlight to that selection. The ranges are saved with the element, synced through normal
collaboration, drawn on the canvas, and kept in SVG export. Text that has no ranges behaves and serializes
exactly as it does today.

Working name for the field: `styleRanges` (the architect may rename it in the change spec; every requirement
below applies to the field by whatever name the spec gives it).

## In scope

1. A range model in a new module, `packages/element/src/textRanges.ts`. It covers normalization, merging,
   applying a style to `[start, end)`, shifting ranges on a text edit, splitting ranges onto wrapped lines, and
   validating ranges on restore.
2. An optional range field on `ExcalidrawTextElement`, omitted when there are no ranges.
3. Applying a text colour or a highlight colour to the current textarea selection while a text element is being
   edited, and clearing either one.
4. Shifting and trimming ranges as the text changes while it is being edited.
5. Canvas rendering of styled runs and highlight rectangles, including wrapping, alignment, dark mode and
   bound-text containers.
6. SVG export of styled runs as `<tspan>` elements with their own `fill`, and highlight `<rect>` elements behind
   the text.
7. Restore of saved ranges, and of legacy files that have none.
8. Collaboration through the existing whole-element reconciliation, with tests.
9. New UI strings in `locales/en.json`, and an "Unreleased" entry in `packages/excalidraw/CHANGELOG.md`.

## Out of scope

1. Styling beyond colour and highlight: bold, italic, underline, per-range font size or font family.
2. Showing per-range colour inside the editing textarea. The editor keeps plain text; styling shows on the canvas
   once editing ends.
3. Character-level CRDT merging. Reconciliation stays whole-element, and the newest version wins.
4. PNG export changes beyond what canvas rendering already gives.
5. Any change under `excalidraw-app/**`, which includes the collab transport.
6. Locales other than `en.json` (Crowdin supplies them).
7. Styling ranges from outside the editor, such as applying a range colour to a selected, non-editing element.
8. Bidi-exact positioning of runs inside one line that mixes RTL and LTR text (see Open questions, Q1).

## Constraints from the write contract and the repo

- C-1. Only the 29 allowlisted paths may change. `packages/excalidraw/types.ts`, `appState.ts`,
  `components/ColorPicker/**`, `components/App.tsx` and `packages/common/**` are **not** in the allowlist. This
  means:
  - The editor's current selection cannot live in `AppState`. The architect has to keep it somewhere the run is
    allowed to write. For example, a small selection store exported from `textWysiwyg.tsx` (or from
    `textRanges.ts`), keyed by the element id being edited, which the actions read.
  - The colour controls reuse the existing colour picker components as they are.
- C-2. Generated code follows `AGENTS.md`. It uses `app.ownerDocument` / `app.ownerWindow` (or the element's
  `ownerDocument`), never the `document` or `window` globals. Combined object types use
  `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`, never `Omit<…> & …`.
- C-3. Existing `__snapshots__/*.snap` files must not change. The field must not appear as a key on an element
  that has no ranges, not even as `undefined`, because pretty-format prints `undefined` keys.
- C-4. The checks are `yarn test:typecheck`, `yarn test:code` (eslint, max-warnings 0) and
  `yarn test:app --watch=false`. `yarn test:update` is never a check step.

## Functional requirements

### Range model (`packages/element/src/textRanges.ts`)

- **FR-1 Range shape.** A range is `{ start: number; end: number; color?: string; highlight?: string }`. It
  covers `originalText` offsets in UTF-16 code units, which are the units of the textarea's
  `selectionStart`/`selectionEnd`. `start` is inclusive and `end` is exclusive. The type is exported from
  `@excalidraw/element`.
- **FR-2 Normal form.** A normalized range list is sorted by `start`. Ranges do not overlap. Every range has
  `0 <= start < end <= originalText.length` and at least one of `color` or `highlight`. Adjacent ranges whose
  styles are equal are merged into one. A normalize function turns any list into this form. A list that is empty
  after normalizing is represented as "no ranges", meaning the field is absent.
- **FR-3 Apply a style.** `applyStyle(ranges, start, end, patch)` sets or clears one attribute (`color` and/or
  `highlight`; `null` clears it) on `[start, end)`. It splits the existing ranges at `start` and `end` and leaves
  the other attribute untouched. Applying a colour to text that is already highlighted keeps the highlight. The
  result is normalized. An empty or inverted `[start, end)` returns the list unchanged.
- **FR-4 Shift on edit.** `shiftRangesForEdit(ranges, oldText, newText)` finds the edit as one replaced span,
  using the common prefix and suffix of the old and new text. It then updates the ranges:
  - A range wholly before the edit is unchanged. A range wholly after it moves by the length difference.
  - Deleted characters are removed from any range that covers them. A range left empty is dropped.
  - Text inserted strictly inside a range (`start < p < end`) extends that range. Text inserted at a range's
    `start` or `end` is not styled.
  - The result is normalized against `newText`.
- **FR-5 Split onto wrapped lines.** Given `originalText`, the wrapped `text` and the ranges, a function returns,
  for each wrapped line, its ordered runs `{ text, color?, highlight? }`. The runs of a line concatenate to
  exactly that line. Wrapping inserts line breaks and can drop whitespace at a break, so this function aligns the
  wrapped text to `originalText` and does not assume that the offsets match one-to-one.
- **FR-6 Validate on restore.** `restoreStyleRanges(value, originalText)` accepts unknown input. It keeps only
  entries whose `start` and `end` are finite integers and whose `color`/`highlight` are non-empty strings. It
  clamps each range to `[0, originalText.length]`, normalizes the list, and returns `undefined` when nothing
  valid is left.

### Element and data

- **FR-7 Element field.** `ExcalidrawTextElement` gains an optional, readonly range field (FR-1). `newTextElement`
  accepts it as an option and sets the key only when the normalized list is non-empty. `refreshTextDimensions`
  and the other text helpers carry the field through unchanged. Whenever these helpers change `originalText`,
  they clamp the ranges to the new text so that no range goes past its end.
- **FR-8 Restore.** `restore.ts` restores the field on text elements through FR-6. An element saved without the
  field, or with an invalid one, restores with no ranges and with no key added. Elements of other types never get
  the field.
- **FR-9 Collaboration.** Every change to the ranges goes through `mutateElement`/`newElementWith` (or the scene's
  equivalent), so the element's `version` and `versionNonce` change and reconciliation carries the ranges with
  the text they belong to. When two clients edit the same text concurrently, every client converges on one
  element version whose text and ranges come from the same edit. `reconcile.ts` changes only if a test shows that
  it has to.
- **FR-10 Duplicate, copy and paste.** Duplicating, copying and pasting a text element keeps its ranges, because
  the field is part of the element.

### Editor and actions

- **FR-11 Selection tracking.** While a text element is being edited, the editor records the textarea's current
  selection as `originalText` offsets, keyed by the edited element's id. The record is cleared when editing ends.
  The selection must still be readable after focus moves to the properties panel to pick a colour. Excalidraw's
  existing rule that keeps the editor open while the properties panel is used stays as it is.
- **FR-12 Shift while editing.** Each time the editor reports changed text, the ranges are shifted with FR-4
  against the previous `originalText`, and the shifted ranges are stored on the element together with the new
  text.
- **FR-13 Apply colour to the selection.** A new action applies a text colour to the recorded selection of the
  element being edited, through FR-3. It is available only while a text element is being edited and the
  selection is non-empty; otherwise it changes nothing. Choosing "none" clears the colour on the selection, and
  the text there falls back to the element's `strokeColor`.
- **FR-14 Apply highlight to the selection.** A new action does the same as FR-13 for the highlight colour.
  Choosing "none" (transparent) clears the highlight.
- **FR-15 Controls.** While a text element is being edited, `Actions.tsx` shows the two controls, "Selection
  color" and "Selection highlight" (the strings live in `en.json`), next to the existing text controls. They are
  hidden when no text is being edited. The existing stroke-colour control keeps its current behaviour: it
  recolours the whole element.
- **FR-16 Undo.** Changes to the ranges are recorded by the existing history like any other element property.
  Undoing after the edit is committed restores the earlier ranges.

### Rendering and export

- **FR-17 Canvas.** For a text element with ranges, each wrapped line is drawn as its runs (FR-5):
  - Each run is drawn at an x offset measured from the width of the text before it on that line, using the
    element's font.
  - A highlighted run first gets a filled rectangle the run's width wide and one line height tall, behind its text.
  - A run with no `color` uses the element's `strokeColor`.
  - Run colours and highlight colours go through the same dark-mode filter as `strokeColor`.
  - Left, center and right alignment, vertical alignment in containers, and the line-height maths all match
    unstyled text, so styled and unstyled versions of the same text put every character in the same place.
  - A line without ranges, and an element without ranges, is drawn exactly as today (one `fillText` per line).
  - The element canvas cache is invalidated when the ranges change.
- **FR-18 SVG export.** For a text element with ranges, each line's `<text>` holds one `<tspan>` per run, and a
  coloured run's `<tspan>` carries `fill="<color>"` (after the dark-mode filter when exporting in dark mode). A
  highlighted run gets a `<rect>` with `fill="<highlight>"` placed behind the line's `<text>`, using the run's
  measured x offset and width, the line's y position and the line height. An element without ranges produces
  exactly the same SVG markup as before.
- **FR-19 Wrapping, containers and font changes.** Ranges are anchored to `originalText`, so re-wrapping after a
  resize, binding the text to a container, or changing font family or font size leaves the ranges unchanged, and
  rendering re-measures the runs.

### Docs

- **FR-20 Changelog.** `packages/excalidraw/CHANGELOG.md` gets an "Unreleased" entry that describes the feature
  and the new optional element field.

## Non-functional requirements

- **NFR-1 Backward compatibility.** Files, clipboard data and collab payloads without the field load unchanged.
  Every existing snapshot stays byte-identical (C-3).
- **NFR-2 Forward compatibility.** An older client that loads an element with ranges ignores the field and draws
  the text in `strokeColor`. Nothing breaks.
- **NFR-3 Performance.** An element without ranges takes the existing code paths, with no extra measuring. For a
  styled line, the run widths are measured once per render of the element, not once per frame, because the
  element canvas cache covers this.
- **NFR-4 Type safety and lint.** Strict TypeScript and eslint pass with zero warnings. Code uses `Merge<>`
  rather than `Omit & …`, and owner-document APIs rather than DOM globals (C-2).
- **NFR-5 Untrusted input.** Ranges from files, clipboard data and collab payloads are validated by FR-6 before
  use. Colours are written into SVG only as attribute values through `setAttribute`, never into markup strings,
  so a crafted colour string cannot inject SVG or HTML.
- **NFR-6 Purity.** The range-model functions are pure. They never mutate their input arrays or objects.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | The feature stores colour strings and integer offsets into text the user already stores. It adds no new personal data, network calls or storage. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Any editor user (local or collaborator with edit rights) | Text element ranges | Create, change and clear them while editing the text |
| Viewer (view mode) | Text element ranges | Sees them rendered. The editor and the controls are unavailable, as for other properties today |

## Acceptance criteria

Each criterion names the test file that proves it.

- **AC-1 Shift on edit** (`packages/element/tests/textRanges.test.ts`). Unit tests cover FR-4 for an insert and a
  delete placed before, inside, spanning and after a range. They also cover inserting at a range's `start` and
  `end` (not styled), a delete that empties a range (the range is dropped), and a replacement.
- **AC-2 Merge and apply** (`packages/element/tests/textRanges.test.ts`). Unit tests cover FR-2 and FR-3:
  - adjacent equal runs merge;
  - overlapping input normalizes;
  - applying a colour inside a highlighted range keeps the highlight and splits the range correctly;
  - clearing both attributes removes the range;
  - an empty selection changes nothing;
  - the input list is not mutated.
- **AC-3 Split onto wrapped lines** (`packages/element/tests/textRanges.test.ts`, and
  `packages/element/tests/textWrapping.test.ts` where a wrapped text is needed). For wrapped text, including a
  break inside a styled range and whitespace dropped at a break, each line's runs concatenate to the line and
  carry the right styles.
- **AC-4 Restore** (`packages/element/tests/textRanges.test.ts` and
  `packages/excalidraw/tests/data/restore.test.ts`):
  - a legacy text element with no field restores with no ranges and no key;
  - invalid entries are dropped;
  - out-of-bounds ranges are clamped;
  - valid ranges round-trip.
- **AC-5 Editor apply** (`packages/excalidraw/tests/textRangeStyles.test.tsx`). A jsdom test opens the text
  editor, types text, selects a substring, applies a text colour with the new action, and asserts the element's
  ranges. It then applies a highlight to an overlapping selection and asserts the merged range list.
- **AC-6 Editor shift** (`packages/excalidraw/tests/textRangeStyles.test.tsx` and/or
  `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`). After the AC-5 setup, typing before the range moves it,
  and deleting part of it trims it. Once editing ends, the committed element carries the shifted ranges.
- **AC-7 Controls** (`packages/excalidraw/tests/textRangeStyles.test.tsx`). The "Selection color" and "Selection
  highlight" controls render while a text is being edited and are absent when no text is being edited.
- **AC-8 SVG export** (`packages/excalidraw/tests/scene/export.test.ts` and/or
  `packages/excalidraw/tests/export.test.tsx`):
  - a coloured run exports a `<tspan>` with the right `fill`;
  - a highlighted run exports a `<rect>` with the highlight `fill` placed before its `<text>`;
  - an element without ranges exports the same markup as before.
- **AC-9 Wrapping, containers and font changes** (`packages/element/tests/textElement.test.ts` and/or
  `packages/excalidraw/tests/textRangeStyles.test.tsx`). Ranges are unchanged after the text is re-wrapped
  (resized), bound into a container, and given a new font family or font size, and the split onto lines still
  covers the same characters.
- **AC-10 Concurrent edits** (`packages/excalidraw/tests/data/reconcile.test.ts`). Reconciling two concurrent
  versions of one text element whose texts and ranges differ gives the same winner on both sides, and the
  winner's ranges are the ones that belong to its text.
- **AC-11 Canvas** (`packages/excalidraw/tests/textRangeStyles.test.tsx`, using vitest-canvas-mock).
  Rendering a styled element calls `fillText` once per run with the run's `fillStyle`, and calls `fillRect` for
  a highlighted run. An unstyled element still calls `fillText` once per line.
- **AC-12 Snapshots unchanged.** Every existing `__snapshots__/*.snap` file is unchanged (`git diff` shows no
  existing snapshot modified). A new snapshot may be added only by a new test.
- **AC-13 Checks.** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass, except for
  failures that were already present before the run.
- **AC-14 Undo** (`packages/excalidraw/tests/textRangeStyles.test.tsx`). After a range colour is applied and the
  edit is committed, undo restores the element's earlier ranges.

## Open questions for HITL

- **Q1. RTL lines.** Proposed default: a line detected as RTL draws its runs from the right edge in logical order.
  This is correct for a line that is all RTL, and approximate for a line that mixes RTL and LTR. Full bidi
  positioning is out of scope (Out of scope 8). Is that acceptable?
- **Q2. Inserting at a range edge.** Proposed default: text typed at a range's `start` or `end` is unstyled
  (FR-4). The alternative is to extend the range at its end, as word processors usually do. Keep the proposed
  default?
- **Q3. Control placement.** Proposed default: two new pickers, "Selection color" and "Selection highlight", shown
  only while editing. The existing stroke colour keeps recolouring the whole element (FR-15). The alternative is
  to make the stroke picker apply to the selection when one exists. Keep separate controls?
