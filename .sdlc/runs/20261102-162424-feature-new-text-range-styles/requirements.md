# Requirements — feature-new — Per-range text colour and highlight

Run: `20261102-162424-feature-new-text-range-styles` · Intent: `feature-new` · Policy: `opus55-only` (estimated) · Scope: B
Source: `intent_brief.md` (Gate 0 approved 2026-11-02, scope B), `discovery.md`, `.sdlc/baseline/stack-profile.md`.
Reference only (not approved): run `20261102-144102-…`'s requirements, written under the narrower scope.

## Summary

A text element today has one colour (`strokeColor`) for all of its text. This feature adds an optional, ordered
list of styled ranges to a text element. Each range covers `[start, end)` of `originalText` and carries a text
colour, a highlight (background) colour, or both. While editing a text, the user selects part of it and applies a
colour or a highlight to that selection. The editor's current selection is kept in `AppState` (scope B). The
ranges are saved with the element, synced through normal collaboration, drawn on the canvas, and kept in SVG
export. Text that has no ranges behaves and serializes exactly as it does today.

Working names: element field `styleRanges`; AppState field `textEditorSelection`. The architect may rename either
in the change spec; every requirement below applies to the field by whatever name the spec gives it.

## In scope

1. A range model in a new module, `packages/element/src/textRanges.ts`: normalize, merge, apply a style to
   `[start, end)`, shift ranges on a text edit, split ranges onto wrapped lines, validate on restore.
2. An optional range field on `ExcalidrawTextElement`, omitted when there are no ranges.
3. The editor's current text selection held in `AppState`, never exported, saved or sent to collaborators.
4. Applying a text colour or a highlight colour to that selection while a text element is being edited, and
   clearing either one, through the existing colour picker components.
5. Shifting and trimming ranges as the text changes while it is being edited.
6. Canvas rendering of styled runs and highlight rectangles, matching wrapping, alignment, dark mode and
   bound-text containers.
7. SVG export of styled runs as `<tspan>` elements with their own `fill`, and highlight `<rect>` elements behind
   the text.
8. Restore of saved ranges, and of legacy files that have none.
9. Collaboration through the existing whole-element reconciliation, with tests.
10. New UI strings in `locales/en.json`, and an "Unreleased" entry in `packages/excalidraw/CHANGELOG.md`.

## Out of scope

1. Styling beyond colour and highlight: bold, italic, underline, per-range font size or font family.
2. Showing per-range colour inside the editing textarea. The editor keeps plain text; styling shows on the canvas.
3. Character-level CRDT merging. Reconciliation stays whole-element, newest version wins.
4. PNG export changes beyond what canvas rendering already gives.
5. Any change under `excalidraw-app/**`, including the collab transport.
6. Locales other than `en.json` (Crowdin supplies them).
7. Applying a range style to a text element that is selected but not being edited.
8. Bidi-exact positioning of runs inside one line that mixes RTL and LTR text (Q1).

## Constraints

- C-1. Write contract (frozen at Gate 0): only the 33 allowlisted paths may change. That includes, for scope B,
  `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts`, `packages/excalidraw/components/App.tsx`
  and `packages/excalidraw/components/ColorPicker/**`. `packages/common/**`, `excalidraw-app/**` and
  `packages/excalidraw/types/**` are not writable.
- C-2. `AGENTS.md`: use `app.ownerDocument` / `app.ownerWindow` (or the textarea's `ownerDocument`), never the
  `document`/`window` globals; combine object types with `Merge<Base, Overrides>` from
  `@excalidraw/common/utility-types`, never `Omit<…> & …`.
- C-3. Existing `__snapshots__/*.snap` files must not change (subject to Q4 for the AppState field). The element
  field must not appear as a key on an element with no ranges, not even as `undefined`.
- C-4. Checks: `yarn test:typecheck`, `yarn test:code` (eslint, max-warnings 0), `yarn test:app --watch=false`.
  `yarn test:update` is never a check step.

## Functional requirements

### Range model (`packages/element/src/textRanges.ts`)

- **FR-1 Range shape.** A range is `{ start: number; end: number; color?: string; highlight?: string }` over
  `originalText` offsets in UTF-16 code units (the units of the textarea's `selectionStart`/`selectionEnd`);
  `start` inclusive, `end` exclusive. The type is exported from `@excalidraw/element`.
- **FR-2 Normal form.** A normalized list is sorted by `start`, non-overlapping, each range has
  `0 <= start < end <= originalText.length` and at least one of `color`/`highlight`, and adjacent ranges with equal
  styles are merged. A list empty after normalizing means "no ranges" (field absent).
- **FR-3 Apply a style.** `applyStyle(ranges, start, end, patch)` sets or clears (`null`) `color` and/or
  `highlight` on `[start, end)`, splitting existing ranges at the bounds and leaving the other attribute untouched
  (a colour applied to highlighted text keeps the highlight). Result normalized. An empty or inverted span returns
  the list unchanged.
- **FR-4 Shift on edit.** `shiftRangesForEdit(ranges, oldText, newText)` finds the edit as one replaced span from
  the common prefix and suffix, then: ranges wholly before are unchanged; ranges wholly after move by the length
  difference; deleted characters are removed from any covering range, and an emptied range is dropped; text
  inserted strictly inside a range (`start < p < end`) extends it; text inserted at a range's `start` or `end` is
  unstyled (Q2). Result normalized against `newText`.
- **FR-5 Split onto wrapped lines.** Given `originalText`, the wrapped `text` and the ranges, returns for each
  wrapped line its ordered runs `{ text, color?, highlight? }`, whose texts concatenate to exactly that line. The
  function aligns the wrapped text to `originalText` (wrapping inserts breaks and can drop whitespace at a break)
  rather than assuming offsets match one-to-one.
- **FR-6 Validate on restore.** `restoreStyleRanges(value, originalText)` accepts unknown input, keeps entries
  whose `start`/`end` are finite integers and whose `color`/`highlight` are non-empty strings, clamps to
  `[0, originalText.length]`, normalizes, and returns `undefined` when nothing valid is left.

### Element and data

- **FR-7 Element field.** `ExcalidrawTextElement` gains an optional, readonly range field (FR-1). `newTextElement`
  accepts it and sets the key only when the normalized list is non-empty. `refreshTextDimensions` and the other
  text helpers carry it through; whenever they change `originalText` they clamp the ranges to the new text.
- **FR-8 Restore.** `restore.ts` restores the field on text elements through FR-6. An element saved without the
  field, or with an invalid one, restores with no ranges and no key. Other element types never get the field.
- **FR-9 Collaboration.** Every change to the ranges goes through `mutateElement`/`newElementWith` (or the scene's
  equivalent), so `version`/`versionNonce` change and reconciliation carries the ranges with their text. Two
  clients editing one text concurrently converge on one version whose text and ranges come from the same edit.
  `reconcile.ts` changes only if a test shows it must.
- **FR-10 Duplicate, copy, paste.** Duplicating, copying and pasting a text element keeps its ranges.

### Editor selection in AppState (scope B)

- **FR-11 AppState field.** `AppState` gains a field holding the edited text's current selection as
  `{ elementId, start, end }` in `originalText` offsets, or `null`. Its storage config in `appState.ts` is
  `{ browser: false, export: false, server: false }`: it is never saved to local storage, never exported, never
  sent to collaborators. Its default is `null` in `getDefaultAppState()` (Q4).
- **FR-12 Selection tracking.** While a text element is being edited, the editor (`textWysiwyg.tsx`, wired through
  `App.tsx`) updates the field when the textarea's selection changes (select, keyup, mouseup, input). It is
  cleared when editing ends. It stays readable while focus moves to the properties panel to pick a colour; the
  existing rule that keeps the editor open while the properties panel is used is unchanged.
- **FR-13 Shift while editing.** Each time the editor reports changed text, the ranges are shifted with FR-4
  against the previous `originalText` and stored on the element with the new text.

### Actions and controls

- **FR-14 Apply colour to the selection.** A new action applies a text colour to the AppState selection of the
  element being edited, through FR-3. It applies only while a text element is being edited and the selection is
  non-empty; otherwise it changes nothing. "None" clears the colour on the selection (falls back to
  `strokeColor`).
- **FR-15 Apply highlight to the selection.** A new action does the same for the highlight colour; "none"
  (transparent) clears it.
- **FR-16 Controls.** While a text element is being edited, `Actions.tsx` shows two controls, "Selection color" and
  "Selection highlight" (strings in `en.json`), built from the existing `ColorPicker` components, next to the
  existing text controls, and hidden otherwise. The existing stroke-colour control keeps recolouring the whole
  element (Q3). After a pick, focus returns to the textarea with the same selection.
- **FR-17 Undo.** Range changes are recorded by the existing history like any other element property; undo after
  the edit is committed restores the earlier ranges. The AppState selection field is not recorded in history.

### Rendering and export

- **FR-18 Canvas.** For a text element with ranges, each wrapped line is drawn as its runs (FR-5): each run at an x
  offset measured from the width of the text before it on the line, in the element's font; a highlighted run first
  gets a filled rect one run wide and one line height tall behind its text; a run with no `color` uses
  `strokeColor`; run and highlight colours go through the same dark-mode filter as `strokeColor`; left, center and
  right alignment, container vertical alignment and line-height maths match unstyled text. A line or element
  without ranges is drawn exactly as today (one `fillText` per line). The element canvas cache is invalidated when
  the ranges change.
- **FR-19 SVG export.** For a text element with ranges, each line's `<text>` holds one `<tspan>` per run; a coloured
  run's `<tspan>` carries `fill` (dark-mode filtered when exporting dark). A highlighted run gets a `<rect>` with the
  highlight `fill` placed before the line's `<text>`, at the run's measured x offset and width, the line's y and
  the line height. An element without ranges produces exactly the same markup as before.
- **FR-20 Wrapping, containers, font changes.** Ranges are anchored to `originalText`, so re-wrapping on resize,
  binding to a container, or changing font family or size leaves them unchanged; rendering re-measures the runs.

### Docs

- **FR-21 Changelog.** `packages/excalidraw/CHANGELOG.md` gets an "Unreleased" entry describing the feature and the
  new optional element field.

## Non-functional requirements

- **NFR-1 Backward compatibility.** Files, clipboard data and collab payloads without the field load unchanged.
- **NFR-2 Forward compatibility.** An older client ignores the field and draws the text in `strokeColor`.
- **NFR-3 Performance.** An element without ranges takes the existing code paths with no extra measuring. A styled
  line's runs are measured once per element render, not per frame (the element canvas cache covers this).
  Selection tracking does not re-render the canvas scene when only the selection changes.
- **NFR-4 Type safety and lint.** Strict TypeScript and eslint pass with zero warnings; C-2 holds.
- **NFR-5 Untrusted input.** Ranges from files, clipboard and collab are validated by FR-6 before use. Colours
  reach SVG only as attribute values via `setAttribute`, never in markup strings.
- **NFR-6 Purity.** Range-model functions are pure and never mutate their inputs.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | Colour strings and integer offsets into text the user already stores. No new personal data, network calls or storage. The AppState selection is transient and never persisted or broadcast (FR-11). |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user (local, or collaborator with edit rights) | Text element ranges | Create, change, clear while editing the text |
| Viewer (view mode) | Text element ranges | Sees them rendered; editor and controls unavailable, as for other properties |

## Acceptance criteria

- **AC-1 Shift on edit** (`packages/element/tests/textRanges.test.ts`): FR-4 for insert and delete before, inside,
  spanning and after a range; insert at `start` and at `end` (unstyled); a delete that empties a range (dropped); a
  replacement.
- **AC-2 Merge and apply** (`packages/element/tests/textRanges.test.ts`): adjacent equal runs merge; overlapping
  input normalizes; a colour applied inside a highlighted range keeps the highlight and splits correctly; clearing
  both attributes removes the range; an empty selection changes nothing; inputs are not mutated.
- **AC-3 Split onto wrapped lines** (`textRanges.test.ts`, and `packages/element/tests/textWrapping.test.ts` where
  a wrapped text is needed): with a break inside a styled range and whitespace dropped at a break, each line's runs
  concatenate to the line and carry the right styles.
- **AC-4 Restore** (`textRanges.test.ts` and `packages/excalidraw/tests/data/restore.test.ts`): a legacy text
  element restores with no ranges and no key; invalid entries are dropped; out-of-bounds ranges are clamped; valid
  ranges round-trip.
- **AC-5 Editor apply** (`packages/excalidraw/tests/textRangeStyles.test.tsx`): open the editor, type, select a
  substring, assert the AppState selection field, apply a text colour with the new action, assert the element's
  ranges; apply a highlight to an overlapping selection and assert the merged list.
- **AC-6 Editor shift** (`textRangeStyles.test.tsx` and/or `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`):
  after AC-5, typing before the range moves it and deleting part of it trims it; once editing ends the committed
  element carries the shifted ranges and the AppState selection field is cleared.
- **AC-7 Controls** (`textRangeStyles.test.tsx`): "Selection color" and "Selection highlight" render while a text is
  being edited and are absent otherwise.
- **AC-8 SVG export** (`packages/excalidraw/tests/scene/export.test.ts` and/or
  `packages/excalidraw/tests/export.test.tsx`): a coloured run exports a `<tspan>` with the right `fill`; a
  highlighted run exports a `<rect>` with the highlight `fill` before its `<text>`; an unstyled element exports the
  same markup as before.
- **AC-9 Wrapping, containers, font changes** (`packages/element/tests/textElement.test.ts` and/or
  `textRangeStyles.test.tsx`): ranges are unchanged after re-wrap, binding into a container, and a font family or
  size change, and the split onto lines still covers the same characters.
- **AC-10 Concurrent edits** (`packages/excalidraw/tests/data/reconcile.test.ts`): reconciling two concurrent
  versions of one text element with differing text and ranges gives the same winner on both sides, carrying the
  ranges that belong to its text.
- **AC-11 Canvas** (`textRangeStyles.test.tsx`, vitest-canvas-mock): a styled element calls `fillText` once per run
  with the run's `fillStyle` and `fillRect` for a highlighted run; an unstyled element calls `fillText` once per
  line.
- **AC-12 Selection not persisted** (`textRangeStyles.test.tsx`): the AppState selection field is absent from
  exported/serialized app state (`clearAppStateForLocalStorage`, export and `serializeAsJSON` paths).
- **AC-13 Snapshots.** No existing `__snapshots__/*.snap` file changes, except as Q4 resolves for the AppState
  field; a new snapshot is added only by a new test.
- **AC-14 Checks.** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass, except failures
  already present before the run.
- **AC-15 Undo** (`textRangeStyles.test.tsx`): after a range colour is applied and the edit committed, undo
  restores the earlier ranges.

## Open questions for HITL

- **Q1. RTL lines.** Proposed default: a line detected as RTL draws its runs from the right edge in logical order —
  correct for an all-RTL line, approximate for mixed RTL/LTR (Out of scope 8). Acceptable?
- **Q2. Inserting at a range edge.** Proposed default: text typed at a range's `start` or `end` is unstyled (FR-4).
  Alternative: extend the range at its end, as word processors usually do. Keep the default?
- **Q3. Control placement.** Proposed default: two new pickers, "Selection color" and "Selection highlight", shown
  only while editing; the stroke picker keeps recolouring the whole element. Alternative: make the stroke picker
  apply to the selection when one exists. Keep separate controls?
- **Q4. AppState field vs. snapshots.** Three existing snapshot files
  (`tests/__snapshots__/regressionTests.test.tsx.snap`, `history.test.tsx.snap`, `contextmenu.test.tsx.snap`; 133
  snapshots) serialize the full appState, so a new field with a default in `getDefaultAppState()` would add one
  line to each of them. Proposed default: give it a `null` default and accept a reviewed update of those three
  files that adds only that one key (`git diff` of each must show nothing else; checked by the senior reviewer),
  and relax C-3/AC-13 for that key alone. Alternative: declare it optional and leave it out of
  `getDefaultAppState()`; this avoids churn only in tests that never edit text, since React's `setState` merges
  and cannot remove a key once set, so tests that edit text would snapshot it as `undefined` and churn anyway,
  less predictably. Keep the proposed default?
