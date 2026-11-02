# Requirements — Coloured and highlighted text ranges

Run `20261102-103113-feature-new-text-range-styling` · intent `feature-new` · HEAD `14bb42ed`

`intent_brief.md` is the source of truth. Its "From the brief" text and "Gate 0 answers" are the person's words and
win over anything here. This file adds testable shape; it never narrows them. "Must" statements describe behaviour;
the mechanism is the change spec's to choose unless the brief or a Gate 0 answer fixes it.

## Run constraint (Gate 0, answer 5, word for word)

> Run constraint: work only from this branch's code and the brief. Do not look at the upstream excalidraw repo, its
> PRs or issues, upstream/master or master, and do not base anything on them. This binds every phase and every model,
> the Gemini worker included.

## In scope

1. A styled-range data model on text elements: a character span carrying a text colour, a highlight colour, or both.
2. Wrapping and measurement that keep ranges aligned with the characters they style.
3. Canvas rendering per run, including exports that go through the canvas.
4. Restore of old files with no ranges, and of ranges read from files.
5. The text editor: a textarea selection mapped to character offsets, colour controls that apply to a range while
   editing, and a preview layer that shows the styling while the canvas hides the element being edited.
6. SVG export with `<tspan>` fills and a highlight `<rect>` behind the text.
7. Collaboration reconciliation: ranges survive text edits, line wrapping, bound-text containers, font changes and
   concurrent edits.
8. Unit, jsdom and draw-call tests for the above, a CHANGELOG entry, and UI strings in `en.json`.

## Out of scope

1. Per-range bold, italic, size or font family. A range carries a colour and a highlight only. "Font changes" means
   changing the element's font, which ranges must survive.
2. Replacing the `<textarea>` with a rich editor.
3. Carrying styled ranges through the clipboard or copy-and-paste styles.
4. Creating ranges through `convertToExcalidrawElements`.
5. Anything under `excalidraw-app/**`, and every locale file except `packages/excalidraw/locales/en.json`.
6. Narrowing concurrent edits to last-write-wins, at any gate or in any phase.

## Functional requirements

### packages/element — data model and text

- **FR-1 Range model.** A text element may hold styled ranges. Each range has a stable identity, a half-open character
  span, and a text colour and/or a highlight colour. Offsets address the element's source text, so that a re-wrap
  alone never changes them.
- **FR-2 Absent by default.** An element that has never had ranges carries no new key, in memory or on save. A new text
  element, and every legacy element, is byte-for-byte what it is today. An element whose ranges were all removed may
  carry a marker, which is what FR-19 needs.
- **FR-3 Text edits shift ranges.** Given the old text, the new text and the ranges, a pure function returns the ranges
  for the new text: insertion before a range shifts it, insertion inside extends it, deletion before shifts it,
  deletion inside shrinks it, and a range whose characters are all deleted styles nothing from then on, even if the
  same text is typed again. Behaviour at a range's two
  boundaries is defined once, in the change spec, and tested. The function handles replacing a selection, pasting,
  native textarea undo and any other change that only reveals old and new text.
- **FR-4 Range operations.** Applying a colour or highlight to a span adds to or changes the ranges without overlapping
  styles disagreeing: the result is one well-defined style at every character. Removing a style from a span removes it
  there, splitting a range where needed. Text colour and highlight are independent.
- **FR-5 Wrapping and measurement.** Ranges map to the lines of the wrapped text exactly, including where wrapping drops
  or adds characters, in explicit newlines, in list markers (`listMarker.ts`), and in fixed-width text. Colour and
  highlight are paint-only and never change an element's measured size.
- **FR-6 Canvas rendering per run.** A text element with ranges draws each line as runs, each in its own colour, with
  highlights behind the text. Runs sit where unstyled text would sit, for every `textAlign`, and for right-to-left
  text. Range colours get the same theme treatment as the element's `strokeColor`. Element opacity applies as today. A
  style-only change repaints: no stale canvas cache (stack profile, note 5).
- **FR-7 Bound-text containers.** Ranges survive binding, container resize and re-wrap, and every path that rewrites
  bound text. A range stays on the same characters however the container re-wraps them.
- **FR-8 Font changes.** Changing the element's font family or size keeps every range on the same characters, and
  re-wrapping that follows does too.
- **FR-9 History.** Undo and redo restore text and ranges together, and a range edit is an undoable step. No undo or
  redo leaves offsets that do not match the text.

### packages/excalidraw — editor, controls, export, restore

- **FR-10 Selection mapping.** While editing, the textarea's `selectionStart` and `selectionEnd` map to character
  offsets in the element's source text, across multi-line text and bound text.
- **FR-11 Colour on a selection.** With a non-empty selection while editing, the text colour control applies to that
  range alone, and the element's `strokeColor` is unchanged. The element data is updated, and the selection stays so
  the user can keep editing. This must work although the control takes focus from the textarea
  (`useTextEditorFocus`).
- **FR-12 Highlight on a selection.** With a non-empty selection while editing, a highlight control applies a highlight
  to that range alone, and the user can remove it again.
- **FR-13 No selection.** With an empty selection, or with the element selected and not being edited, the colour picker
  behaves as it does today: it sets `strokeColor`. Existing ranges keep their own colour.
- **FR-14 Removing a style.** A user can return a selection to the element's own colour and to no highlight, and that
  removal counts as removal for FR-19.
- **FR-15 Preview layer.** The textarea stays. While editing, a preview layer shows each range's colour and highlight,
  aligned character for character with the textarea, as the user types, scrolls and re-wraps. The canvas paints the
  styling when editing ends.
- **FR-16 Ranges follow typing.** Every edit in the textarea applies FR-3, so that the element data and the preview never
  show stale offsets.
- **FR-17 SVG export.** A text element with ranges exports `<tspan>`s whose `fill` matches each run, on the right lines
  and at the right position for every `textAlign`. A highlight exports as a `<rect>` that comes before the text in
  document order. A text element with no ranges exports exactly as it does today.
- **FR-18 Restore.** A file with no ranges restores unchanged. Ranges in a file survive save and load. Malformed
  ranges (wrong types, out of bounds, inverted, an unusable colour, or stale against the text) are repaired or dropped,
  never thrown on, and never reach the renderer. Overlap between stored ranges is not malformed: it is the normal output
  of FR-4 and of merging, it stays as stored, and the fixed layer order resolves it, so that renderers only ever receive
  disjoint runs.

### Collaboration

- **FR-19 Concurrent edits.** When a text edit and a range edit race, the ranges of the losing version are carried onto
  the winning text. No client shows stale offsets. All clients converge to the same element whichever order they
  receive the versions in. A removed range must not come back. Reconcile sees only local and remote with no common
  ancestor, so the data model must make removal distinguishable from a range the other side simply had not seen.
- **FR-20 Public API unchanged.** `reconcileElements` keeps its signature, and elements with no ranges reconcile exactly
  as they do today. `excalidraw-app/**` does not change.
- **FR-21 Remote update while editing.** `shouldDiscardRemoteElement` drops a remote update while the local user edits
  that element. A range change or removal in the dropped update must not be lost for good, must not leave stale offsets
  in the editor, and must not break FR-19's convergence when editing ends.

### Release

- **FR-22 Types and exports.** The new types and helpers are exported through `packages/element/src/index.ts`.
- **FR-23 Strings and changelog.** New UI strings go in `packages/excalidraw/locales/en.json` only. An entry goes under
  Unreleased in `packages/excalidraw/CHANGELOG.md`, with no PR link and no invented PR number.

## Non-functional requirements

- **NFR-1 No regression.** Text with no ranges renders, measures, exports and reconciles as it does today, with no
  added per-frame cost worth measuring. No existing snapshot changes.
- **NFR-2 Untrusted input.** Ranges come from files and from other clients. Their colours reach SVG attributes and
  canvas state, so they never reach markup unescaped. Range counts and offsets must not be able to crash or hang
  rendering.
- **NFR-3 Determinism.** Merging is pure and symmetric: it reads no clock, random source or local-only state, so two
  clients with the same two versions compute the same element.
- **NFR-4 Repo conventions.** The change follows `.sdlc/baseline/stack-profile.md`, notes 3 to 13, and uses path aliases
  and existing patterns.
- **NFR-5 Scope.** Only the paths under "Files in scope" in `intent_brief.md` change.

## PII inventory

| Field | Sensitivity | Protection |
| --- | --- | --- |
| Styled ranges (offsets, colours, identity) | None. These fields hold no user content or user identity | Range identity must not encode a user, client or device id |
| A carried range's `origin.text` (the losing version's full text) | Same as the element's text content | Written only after a concurrent-edit race. Dropped by the next style action or text edit on that element |

Text content is handled as it is today, with one exception. After a concurrent-edit race, a range carried from the
losing version keeps that version's full text in its `origin` until the next style action or text edit on that element,
so text deleted on one client can stay in the saved element for that long. A deletion with no race leaves no old text in
the element.

## Role matrix

Excalidraw has no accounts or roles at this level. The one distinction this feature touches:

| Role | Resource | Action |
| --- | --- | --- |
| Editor | Text element ranges | Create, change and remove, while editing |
| View mode | Text element ranges | See them rendered; no editing or colour controls, as today |
| Remote collaborator | Text element ranges | Change them through reconcile, under FR-19 |

## Acceptance criteria

From the brief:

- **AC-1** Unit tests on the range model cover insert and delete shifting.
- **AC-2** Unit tests on the range model cover wrapping.
- **AC-3** Unit tests on the range model cover restore of legacy text.
- **AC-4** jsdom tests apply a colour to a selection in the editor and assert the element data.
- **AC-5** SVG export tests assert tspans with the right fill.
- **AC-6** `yarn test:typecheck` passes.
- **AC-7** `yarn test:code` passes.
- **AC-8** `yarn test:app --watch=false` passes.

Run additions:

- **AC-9** Tests cover ranges surviving bound-text containers: resize, re-wrap and text rewrite.
- **AC-10** Tests cover ranges surviving font family and font size changes.
- **AC-11** Tests cover concurrent edits: a text edit racing a range edit in both arrival orders, no stale offsets,
  convergence across clients, a removed range staying removed, and a remote update dropped while editing.
- **AC-12** Canvas rendering per run is covered by draw-call assertions, since `vitest-canvas-mock` paints no pixels.
- **AC-13** Text elements with no ranges render and export as they do today: no existing snapshot file changes.
- **AC-14** An SVG test asserts a highlight is a `<rect>` that comes before its text.
- **AC-15** A jsdom test asserts the preview layer shows the applied colour and highlight while editing, and stays
  aligned after typing.
- **AC-16** Tests cover undo and redo of a range edit and of a text edit on an element with ranges.
- **AC-17** Tests cover malformed ranges from a file, repaired or dropped without a throw.

The three commands run separately, so that the later checks still run when an earlier one fails. Verification never
uses `yarn test:update`, which rewrites snapshots and would hide a regression.

## Open questions for HITL

None. Both readings below were accepted by the person at Gate 1:

1. **Recolouring with no selection (FR-13), accepted.** Picking a colour with the element selected, or in the editor with
   no selection, changes the element's base colour and leaves ranges in their own colour.
2. **Removing a colour (FR-14), accepted.** A user needs a way back to the element's own colour on a selection. The brief
   does not name one. The change spec will choose the control, and it will be shown at Gate 2.
