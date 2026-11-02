# Requirements — feature-new — Coloured and highlighted ranges inside a text element

Run: `20261102-feature-new-rich-text-spans` · intent `feature-new` · policy `opus55-plus-flash38` · auth `estimated`
Source: `intent_brief.md` (Gate 0 approved 2026-11-02). Base commit `14bb42ed`.

## In scope

1. A new optional field `styleRanges` on `ExcalidrawTextElement` holding colour and highlight runs, with offsets into `originalText`.
2. A pure range module (`packages/element/src/textStyleRanges.ts`): normalise, merge, apply a style to a range, shift and trim on text edits, map ranges onto wrapped lines.
3. Canvas rendering of each run with its own fill colour, and a highlight rectangle behind runs that carry a background colour.
4. SVG export of each run as a `<tspan>` with its own `fill`, and a highlight `<rect>` behind runs that carry a background colour.
5. In the WYSIWYG text editor: map the textarea selection to character offsets; while a non-empty selection is active, the stroke-colour and background-colour actions apply to that range only; typing and deleting keep the ranges in sync.
6. Restore of saved and pasted scenes: legacy text elements with no ranges restore unchanged; malformed, out-of-bounds or empty ranges are clamped or dropped.
7. Undo and redo of a range change through the existing element delta.
8. Collaboration: ranges ride on the element's `version`/`versionNonce`; reconciliation stays whole-element.
9. Ranges survive line wrapping, bound-text containers, font changes and text edits.
10. Every range colour goes through `applyDarkModeFilter` on canvas and SVG when the theme is dark, exactly as the element's own colours do.
11. A `CHANGELOG.md` entry for the new element field; `.sdlc/` added to `.gitignore`.

## Out of scope

1. Bold, italic, underline, per-range font size or font family.
2. Character-level CRDT merge of concurrent text edits (last-writer-wins per element stays).
3. Rich-text paste from HTML or Markdown.
4. Any change to `excalidraw-app/**`, the collab transport or Firebase storage format.
5. PNG export changes beyond what follows from canvas rendering.
6. New UI controls: the existing stroke and background colour pickers are reused.

## Functional requirements

### Module: element data model (`packages/element`)

- **FR-1** `ExcalidrawTextElement` gains `styleRanges?: readonly TextStyleRange[]`, where `TextStyleRange = { start: number; end: number; strokeColor?: string; backgroundColor?: string }`. Offsets are UTF-16 indices into `originalText`, half-open `[start, end)`. The type is exported and documented with a JSDoc. An absent field, or an empty array, means "no runs": the element renders exactly as today.
- **FR-2** `newTextElement` accepts an optional `styleRanges` option and stores it normalised; when not given, the field is omitted or `[]` (one consistent choice, stated in the design) so existing snapshots change only where the design says so.
- **FR-3** `normalizeStyleRanges(ranges, textLength)` returns ranges that are clamped to `[0, textLength]`, have `start < end`, carry at least one colour, are sorted by `start`, do not overlap, and are merged when adjacent ranges carry identical styles.
- **FR-4** `applyStyleToRange(ranges, start, end, style, textLength)` sets `strokeColor` and/or `backgroundColor` on `[start, end)`, splitting existing ranges at the boundaries so a later style wins only inside the selection, then normalises. Setting a colour equal to the element's base colour (or `null`/"transparent" for background) clears that property on the range.
- **FR-5** `shiftStyleRangesForEdit(ranges, prevText, nextText)` (or an equivalent taking the edit offset, deleted length and inserted length) shifts ranges after an insertion or deletion, grows a range when text is inserted strictly inside it, trims a range partly covered by a deletion, and drops a range a deletion covers entirely.
- **FR-6** `getStyleRunsForLines(originalText, wrappedText, ranges)` maps ranges onto the wrapped lines: for every wrapped line it returns the runs `{ text, strokeColor?, backgroundColor? }` that concatenate to the line's text. Characters removed or inserted by wrapping (trailing spaces, line breaks) do not shift later runs.
- **FR-7** When a text element re-wraps (container resize, font family or font size change, `refreshTextDimensions`), its `styleRanges` stay keyed to `originalText` and remain correct.
- **FR-8** `newElementWith` / `mutateElement` / duplication copy `styleRanges` such that a duplicate's ranges are not shared by reference in a way that later mutation can corrupt (the array is readonly and replaced, never mutated in place).

### Module: canvas rendering (`packages/element`)

- **FR-9** `renderElement` draws a text element with no runs exactly as today (one `fillText` per line). With runs, it draws each run of each line with its own `fillStyle` at the x offset of the run's measured position, honouring `textAlign` (left, center, right) of the whole line.
- **FR-10** A run with `backgroundColor` gets a filled rectangle the width of the run and the line height, drawn before the run's text.
- **FR-11** In dark theme, run colours (stroke and background) go through `applyDarkModeFilter`, as the element's base `strokeColor` does.

### Module: SVG export (`packages/excalidraw`)

- **FR-12** `staticSvgScene` emits, for a line with runs, one `<text>` per line containing one `<tspan>` per run, each with its own `fill` (the element's stroke colour for unstyled runs), keeping the existing `<text>` attributes (`x`, `y`, `font-family`, `font-size`, `text-anchor`, `direction`, `dominant-baseline`).
- **FR-13** For a run with `backgroundColor`, the SVG gets a `<rect>` behind the line's text, positioned at the run's measured x offset and line y, width the run's measured width, height the line height, `fill` the run's background colour.
- **FR-14** In dark-theme export, run colours in SVG go through `applyDarkModeFilter`.
- **FR-15** A text element with no runs exports exactly as today (no `<tspan>`), so existing SVG snapshots are unchanged.

### Module: editor and actions (`packages/excalidraw`)

- **FR-16** The WYSIWYG editor exposes the current textarea selection as `{ start, end }` offsets into the element's `originalText` while editing (via a module-level accessor or App state; the design picks one).
- **FR-17** While the editor is open with a non-empty selection, `changeStrokeColor` applies the chosen colour to the selected range of the edited element's `styleRanges` instead of the whole element's `strokeColor`, and leaves the element's `strokeColor` unchanged.
- **FR-18** While the editor is open with a non-empty selection, `changeBackgroundColor` applies the chosen colour as the range's highlight instead of the element's (or its container's) `backgroundColor`.
- **FR-19** With no selection or an empty (collapsed) selection, both actions behave exactly as today.
- **FR-20** On every input event in the editor, `styleRanges` are shifted for the edit (FR-5) before the text update is committed, so typing before a range moves it and typing inside it grows it.
- **FR-21** The editor's textarea keeps showing plain text (the textarea cannot show colour); the canvas shows the runs once editing ends. Applying a range colour must not close the editor or lose the selection.

### Module: persistence, history and collaboration

- **FR-22** `restoreElement` keeps a valid `styleRanges` array, normalises it against `originalText.length` (FR-3), drops entries that are not objects, have non-finite or non-integer offsets, or carry no string colour, and leaves a legacy element with no field without one (or with the design's default).
- **FR-23** The element delta (`delta.ts`) records `styleRanges` changes so undo restores the previous ranges and redo re-applies them; an array value is compared and applied as a whole value.
- **FR-24** `reconcileElements` needs no special handling: a remote element with a higher `version` replaces the local one together with its `styleRanges`. A test proves this.

### Module: project housekeeping

- **FR-25** `packages/excalidraw/CHANGELOG.md` gets an entry under the unreleased section describing the new optional `styleRanges` field on text elements.
- **FR-26** `.gitignore` gains a `.sdlc/` line.

## Non-functional requirements

- **NFR-1** No new runtime dependency.
- **NFR-2** Rendering cost for a text element without runs is unchanged (the run path is taken only when `styleRanges` is non-empty).
- **NFR-3** TypeScript strict passes (`yarn test:typecheck`); ESLint passes with zero warnings (`yarn test:code`).
- **NFR-4** The range module is pure (no DOM, no canvas), so it is unit-testable in isolation.
- **NFR-5** Backward compatibility: scenes saved before this change open unchanged; scenes saved after it open in an older build with the extra field ignored.
- **NFR-6** Existing snapshot churn is limited to what the design states (if the field defaults to `[]`, snapshots of text elements gain `"styleRanges": []`; if it is omitted, none change).

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| `styleRanges[].strokeColor`, `.backgroundColor` | None — colour strings | Validated as strings at restore; emitted in SVG as attribute values through the existing attribute setter (no raw string concatenation into markup) |
| Text content (`originalText`) | User content, unchanged by this feature | Unchanged handling; runs are emitted as text nodes (`textContent`), never as markup |

No new personal data is collected, stored or transmitted.

## Role matrix

Excalidraw has no roles for element editing. Every user who can edit a scene can edit text ranges; a view-mode user cannot (the existing actions are already disabled in view mode).

| Role | Resource | Action |
|---|---|---|
| Editor (any collaborator) | text element `styleRanges` | create, update, delete via colour actions while editing |
| Viewer (view mode) | text element `styleRanges` | read (rendered) only |

## Acceptance criteria

- **AC-1** Unit tests on the range module cover: shift on insert before, inside and after a range; shift on delete before, overlapping and inside; deleting a range's text entirely drops it; overlapping and adjacent same-style ranges merge; applying a style over part of a range splits it.
- **AC-2** Unit tests map ranges onto wrapped lines, including a bound-text container that wraps at a width, and a font change that re-wraps the same text, with runs still matching the coloured substring.
- **AC-3** Restore tests: a legacy text element with no ranges restores unchanged; malformed (non-array, non-object entries, NaN offsets, missing colours) and out-of-bounds ranges are dropped or clamped.
- **AC-4** A jsdom test opens the editor on a text element, sets the textarea selection over a substring, applies a stroke colour and a background colour through the actions, and asserts `element.styleRanges` holds the right offsets and colours; then types before the range and asserts the range shifted.
- **AC-5** SVG export tests assert `<tspan>` elements with the correct `fill` for the coloured run, and a highlight `<rect>` for the background run; an element with no ranges exports with no `<tspan>`.
- **AC-6** A reconcile test shows that a remote element with a higher version brings its `styleRanges` with it.
- **AC-7** A delta/history test: undo of a range colour change restores the previous ranges, and redo re-applies them.
- **AC-8** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass (failures that existed before the run excepted, and reported).
- **AC-9** A dark-theme canvas or SVG test (or a unit check on the colour helper used) shows that range colours pass through `applyDarkModeFilter`.

## Resolved at Gate 1 (approved 2026-11-02, proposed defaults adopted)

1. **Default value — decided: omit when empty.** `styleRanges` is absent on elements with no runs (newTextElement does not set it; restore and normalisation return `undefined`, not `[]`, when no valid range remains). Existing snapshots do not change (NFR-6).
2. **Base-colour change — decided: runs keep their colours.** Changing the whole element's stroke or background colour with no active selection leaves `styleRanges` untouched (runs are explicit overrides).
3. **Bound text — decided:** with a non-empty editor selection the background-colour action highlights the range; with no selection it fills the container (or element) exactly as today.
