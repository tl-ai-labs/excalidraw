# Requirements — feature-new — Styled ranges (partial colour / highlight) in text elements

Run: `20261109-120000-feature-new-text-styling` · Intent: `feature-new` · Brief: `intent_brief.md`

A text element today has one colour (`strokeColor`) for all of its text. This feature adds per-range
text colour and per-range background highlight to text elements (standalone and bound/container text),
carried through editing, wrapping, canvas rendering, SVG export, restore, copy/paste, undo/redo and
collaboration.

## In scope

1. A styled-range data model on `ExcalidrawTextElement`: an ordered list of non-overlapping character
   ranges, each carrying an optional text colour and/or an optional highlight (background) colour.
2. Pure range-model helpers in a new module `packages/element/src/textStyleRanges.ts`: shift on insert /
   delete, apply a style to a range (split / merge), clamp to a text length, normalise (sort, drop empty,
   merge adjacent equal runs), and map ranges to per-line runs of wrapped text.
3. Element creation and refresh (`newTextElement`, `refreshTextDimensions` / wrapping helpers) carry and
   keep the ranges aligned.
4. The WYSIWYG editor maps the textarea selection (`selectionStart`/`selectionEnd`) to character offsets,
   and shifts ranges as text is inserted or deleted while editing.
5. The stroke-colour action, and a new highlight action/control, apply to the selected range while the
   editor is open with a non-empty selection; with no selection (or editor closed) the existing
   element-wide behaviour is unchanged.
6. Canvas rendering draws each line as runs: per-run fill colour, highlight rectangle behind styled runs.
7. SVG export emits `<tspan>` runs with the run's `fill`, and `<rect>` highlights behind highlighted runs.
8. Restore of legacy and corrupt input yields a valid element (no ranges → no `styleRanges` key; invalid / out-of-range
   / overlapping entries are dropped or clamped).
9. Copy/paste of elements, undo/redo and collaboration carry the ranges with the element.
10. English locale labels for the new control(s), and an Unreleased `CHANGELOG.md` entry.
11. Tests: unit (range model, wrapping), jsdom (editor + actions), SVG export, restore, reconcile/history.

## Out of scope

1. Bold / italic / size / font-family or any other per-range typography.
2. Replacing the `<textarea>` editor with a rich `contenteditable` editor; no live styled preview inside the
   textarea beyond what a textarea allows.
3. Per-field / CRDT-style merge of concurrent range edits — element-level last-writer-wins stays.
4. Changes to excalidraw-app collab transport, Firebase storage, or any app source.
5. Markdown / markup import syntax for styled text.
6. New npm dependencies, `package.json` or `yarn.lock` changes.
7. Copy/paste of styled ranges as rich text to or from external apps (HTML clipboard).

## Functional requirements

### Module: element model (`packages/element`)

- **FR-1** `ExcalidrawTextElement` gains a readonly field holding styled ranges (name decided by the
  architect, e.g. `styleRanges`), each range `{ start, end, color?, backgroundColor? }` with `start < end`,
  half-open `[start, end)`. Offsets are defined against **one** of `originalText` or `text`; the architect
  decides which and documents it in the change plan (recommended: `originalText`, since wrapping rewrites
  `text`). The field is omitted when empty (Gate 2 revise): it is written only when
  the element has at least one range, a stored value is never `[]`, and readers treat a missing field as no ranges.
- **FR-2** `newTextElement` writes the field only when the passed value, normalised and clamped, leaves at
  least one range (Gate 2 revise); otherwise the key is absent. Every text
  element factory path and `newElementWith`/`mutateElement` usage keeps the array immutable (a new array
  on change, never in-place mutation).
- **FR-3** `textStyleRanges.ts` exports pure helpers: `shiftRangesForEdit` (old text → new text, or offset +
  deleted count + inserted count), `applyStyleToRange` (split existing ranges at the boundaries, set/clear
  `color` and/or `backgroundColor`, merge equal neighbours), `clampRanges`, `normalizeRanges`, and a
  helper that yields per-line styled runs for the wrapped `text` given the offsets' base string.
  Insert/delete semantics: an edit before a range shifts it; inside a range grows/shrinks it; across a
  boundary trims it; a range reduced to zero length is removed; an edit after a range leaves it alone.
- **FR-4** Wrapping and re-measurement (`textWrapping.ts`, `textElement.ts`, `textMeasurements.ts`) keep
  ranges mapped to the same characters: after wrap at any width, the characters drawn in a styled colour
  are exactly the characters that were styled. Font family / size changes and container resizes do not
  move or drop ranges.
- **FR-5** `renderElement.ts` draws text lines run by run when ranges are present: each run's fill is the
  run's `color` or the element `strokeColor`; a highlighted run gets a filled rectangle behind it of the
  run's measured width and the line height. With no ranges the draw path and output are unchanged. The
  per-element canvas cache is invalidated when the ranges change (via version / new object).
- **FR-6** `packages/element/src/index.ts` exports the new helpers and types.

### Module: editor and actions (`packages/excalidraw`)

- **FR-7** `textWysiwyg.tsx` reads the textarea selection as character offsets in the documented base
  string, exposes it to actions while editing, and on each input shifts the element's ranges using the
  text before and after the change (FR-3). Submitting the editor keeps the ranges.
- **FR-8** `actionChangeStrokeColor` (via `colorTargets.ts` as needed): while a text element is being
  edited and the textarea has a non-empty selection, the chosen colour is applied to that range only
  (element `strokeColor` unchanged); otherwise behaviour is exactly as before.
- **FR-9** A text-highlight control (new action, or an extension of an existing one, registered in
  `actions/register.ts` / `actions/index.ts` / `actions/types.ts`) sets or clears `backgroundColor` on the
  selected range while editing. It appears in the properties panel only for text being edited with a
  selection (or as the architect decides, documented). Its labels are in `locales/en.json`.
- **FR-10** Copy/paste styles (`actionStyles.ts`) keeps today's behaviour for element-level properties and
  does not corrupt ranges on the target (ranges are not copied onto a different text, or are clamped).

### Module: export, data, collaboration (`packages/excalidraw`)

- **FR-11** `staticSvgScene.ts` emits, for a text line with styled runs, `<tspan>` children per run with the
  run's `fill` (default runs use the element colour), and a `<rect>` per highlighted run behind the text,
  positioned to the run's measured x-offset/width and the line box. Unstyled text exports exactly as before.
- **FR-12** `restore.ts` leaves the field absent for legacy text elements, and sanitises corrupt
  input: non-array → absent; entries with non-numeric/non-integer offsets, `start >= end`, no style property,
  or non-string colours are dropped; ranges are clamped to the base string length and normalised; the key is written only when at least
  one range survives, and is absent for legacy text (Gate 2 revise).
- **FR-13** Undo/redo restores ranges exactly (store/delta treat the array as a replaced value).
  Element copy/paste and duplication carry the ranges.
- **FR-14** Collaboration: the ranges travel with the element; reconcile keeps whole-element
  last-writer-wins by `version`, so the winning element's ranges win intact (no mixing).
- **FR-15** `CHANGELOG.md` gets an Unreleased "Features" entry.

## Non-functional requirements

- **NFR-1** Backward compatibility: files and scenes with no ranges load, render and export byte-identical
  canvas draw calls, SVG output and serialised element JSON to today (the field is omitted when empty, Gate 2
  revise, so no committed snapshot changes and nothing runs `yarn test:update` or `vitest -u`).
- **NFR-2** Immutability: nested arrays are never mutated in place; every change produces a new array and
  goes through `mutateElement` / `newElementWith` so `version`/`versionNonce` bump.
- **NFR-3** Performance: rendering text with no ranges takes the existing path; per-run drawing only when
  ranges exist. Range helpers are O(n) in the number of ranges.
- **NFR-4** Type safety: `yarn test:typecheck` passes under the repo's strict TS settings; follow
  `AGENTS.md` (`Merge<>` from `@excalidraw/common/utility-types`, `app.ownerDocument`/`ownerWindow`).
- **NFR-5** No new dependencies; no changes to `package.json`, `yarn.lock` or generated `types/**`.
- **NFR-6** Lint/format: `yarn test:code` (eslint) passes.
- **NFR-7** SVG output stays valid and safe: colour values written into `fill` attributes come only from
  sanitised strings (restore), set through DOM APIs (`setAttribute`), never string-concatenated markup.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Text content (`text`, `originalText`) — pre-existing | User content, may contain anything | Unchanged handling; ranges add no new content |
| `styleRanges` colours / offsets | None (presentation only) | Sanitised on restore (FR-12) |

No new PII is collected, stored or transmitted.

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user (local) | Text element styled ranges | create, change, clear, undo/redo, copy/paste |
| Collaborator (room peer) | Text element styled ranges | receive and send with the element (same as any element property) |
| Viewer (view mode) | Text element styled ranges | render only; no editing controls |

No new authorisation surface.

## Acceptance criteria

- **AC-1** Unit tests on the range model (`packages/element/tests/textStyleRanges.test.ts`): insert and
  delete shift ranges correctly for edits before, inside, across and after a range; zero-length ranges
  are removed; apply/split/merge/normalise/clamp behave as specified.
- **AC-2** Wrapping tests: after wrapping a styled text at several widths, the per-line runs cover exactly
  the originally styled characters (no drift at line breaks, including collapsed/trimmed whitespace).
- **AC-3** Restore tests: a legacy text element with no ranges restores to a valid element with no `styleRanges` key (not an empty
  list) and renders as before; corrupt range input is sanitised per FR-12.
- **AC-4** jsdom tests (`textWysiwyg.test.tsx` and/or action tests): open the editor, select a substring
  in the textarea, apply a stroke colour and a highlight; assert the element's range data, and that the
  element-wide `strokeColor` is unchanged; typing before the range shifts it.
- **AC-5** SVG export tests: a styled text exports `<tspan>`s with the right `fill` for styled runs and a
  `<rect>` for a highlighted run; unstyled text exports as before.
- **AC-6** Ranges survive a font-family change and a bound-text container (label inside a shape, wrapped);
  a reconcile test shows the winning element's ranges kept intact under concurrent edits; an undo/redo
  test restores ranges.
- **AC-7** The run's test command passes exactly:
  `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.

## Assumptions

- **A-1** Offsets are recommended against `originalText` (the user's text, unaffected by wrapping); the
  architect confirms or overrides and documents the choice.
- **A-2** The textarea itself shows plain text while editing (non-goal: rich editor); styled ranges appear
  on canvas once committed / on re-render, and the editor may keep the existing single-colour textarea.
- **A-3** (Gate 2 revise) No committed snapshot is expected to change; any that still changes is not updated and is
  listed at Gate 3 with the reason.

## Open questions for HITL

1. Field name and base string (A-1): accept the architect's choice, with `originalText` as the default?
2. Highlight UI: a new compact highlight colour picker in the properties panel shown only while editing a
   text with a selection — acceptable, or should it reuse the background-colour picker for that case?
