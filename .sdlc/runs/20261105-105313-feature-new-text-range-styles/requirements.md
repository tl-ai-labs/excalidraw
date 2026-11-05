# Requirements — Styled Ranges in Text Elements (Colour + Highlight)

- **Run ID:** `20261105-105313-feature-new-text-range-styles`
- **Mode:** `brownfield`
- **Intent:** `feature-new`
- **Policy:** `argon4-agsdk-only`
- **Auth mode:** `vendor`
- **Test command:** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (from repo root)

---

## Explicit Assumptions & Gate 0 Decisions

1. **Gate 0 — Concurrent edit resolution (frozen):** Concurrent edits to the same text element by multiple collaborators retain today's whole-element last-writer-wins reconciliation (`highest version wins`, discarding remote updates to an actively edited element). `packages/excalidraw/data/reconcile.ts` and `packages/element/src/delta.ts` are strictly off-limits.
2. **Gate 0 — Write contract (frozen):** Only the 32 allowlist entries in the brief's *Files in scope* may be created or modified; all 30 patterns in *Files off-limits* (including `excalidraw-app/**`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/data/reconcile.ts`, `packages/element/src/delta.ts`, non-English locale files, and AI/agent config files) must remain untouched.
3. **Gate 0 — Absent-when-empty representation:** When a text element has no styled ranges (or all ranges have been cleared/deleted), the new field on `ExcalidrawTextElement` is omitted (`undefined`) or kept absent rather than materialised as `[]`, so unstyled text elements remain byte-identical in JSON/memory to today's elements and existing snapshot files (`history.test.tsx.snap`, `regressionTests.test.tsx.snap`, `restore.test.ts.snap`, `export.test.ts.snap`) do not require regeneration unless required by a specific architectural choice.
4. **Assumption — Typing at range boundaries (extend rule):** When text is inserted strictly before a range (`pos <= range.start`), the range shifts right by the inserted length; when inserted strictly inside a range (`range.start < pos < range.end`), the range expands by the inserted length; when inserted at the end boundary of a range (`pos === range.end`), the architect defines and documents a deterministic boundary rule (defaulting to extending the preceding range when typing at `range.end`, or non-extending, tested consistently in `packages/element/tests/textStyles.test.ts`).
5. **Assumption — Removing a style via picker:** Selecting `transparent` in the highlight picker clears `highlight` on the selected character range. Selecting the element's base `strokeColor` in the stroke colour picker for a selected range clears the per-range `color` override (or normalises away ranges that no longer carry any active `color` or `highlight`).
6. **Assumption — Sticky note ink sync:** When editing a sticky note label with a collapsed caret (no selection), changing the stroke colour continues to sync the sticky note ink (`syncStickyNoteInk`). When a non-empty text selection is active in a sticky note label, changing the stroke colour or highlight applies only to the selected range in the label without altering the sticky note container's `strokeColor`.
7. **Assumption — Range offset units:** All range `start` and `end` offsets are UTF-16 code-unit indices (`0 <= start < end <= originalText.length`) matching JavaScript `String.prototype.slice` and `HTMLTextAreaElement.selectionStart` / `selectionEnd` on normalized (`\r\n` -> `\n`) text.

---

## In scope

1. **IS-1 (Text range data model & normalisation):** Define an optional styled-ranges field on `ExcalidrawTextElement` (`packages/element/src/types.ts`) and implement pure range operations in `packages/element/src/textStyles.ts` (re-exported from `packages/element/src/index.ts`): normalisation (sort, drop empty/invalid ranges, clamp to `originalText.length`, merge adjacent identically styled ranges, return `undefined` when empty), style application (`color` and `highlight`), range shifting across arbitrary `oldText -> newText` edits, projection onto wrapped visual lines (`WrappedTextLine`), and per-line run splitting for `left`, `center`, and `right` alignments across both pure-LTR lines (`!hasRTLChars(line.text)`) and RTL / mixed-direction lines (`hasRTLChars(line.text)`).
2. **IS-2 (Range preservation across element lifecycle & text rewrites):** Accept and preserve styled ranges in `newTextElement`, `refreshTextDimensions`, and `packages/element/src/textElement.ts` updates; shift ranges whenever `originalText` is rewritten during editor normalisation (`textWysiwyg.tsx`), indentation/outdentation, and list-marker continuation/reversal (`packages/element/src/listMarker.ts`, `packages/excalidraw/components/App.duplicate.ts`).
3. **IS-3 (Canvas per-run rendering for LTR and RTL / mixed-direction text):** Render styled text elements on the HTML5 canvas (`packages/element/src/renderElement.ts`) per visual line as a sequence of styled runs: draw highlight `<rect>` backgrounds first, then draw glyph runs with their resolved `color` (or element `strokeColor`), filtered through `applyDarkModeFilter` in dark mode. For pure-LTR visual lines (`!hasRTLChars(line.text)`), runs are positioned by measuring the preceding line substring; for visual lines containing any RTL characters (`hasRTLChars(line.text)` is true, regardless of `isRTL(element.text)`), runs and highlight rects are positioned according to the architect's stated bidi-aware run-positioning design, while `isRTL(element.text)` continues to set the base direction (`dir="rtl"` on `context.canvas`), so that styled ranges colour and highlight the exact target characters for `left`, `center`, and `right` alignments.
4. **IS-4 (WYSIWYG editor live preview & selection persistence):** Render a live coloured/highlighted preview layer synchronized with the `<textarea>` in `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (matching font, wrapping, line height, alignment, zoom, scroll, and transform), expose live `originalText` selection offsets to actions via `packages/excalidraw/components/App.text.ts` (and `packages/excalidraw/types.ts` if needed), shift ranges on editor input/normalisation, and preserve the textarea selection and active edit session across colour/highlight picker interactions.
5. **IS-5 (Stroke colour range action & new highlight picker UI):** Update `actionChangeStrokeColor` in `packages/excalidraw/actions/actionProperties.tsx` so that when editing a text element with a non-empty selection (`selectionStart < selectionEnd`), it colours only the selected range while leaving `element.strokeColor` unchanged (and when the caret is collapsed, keeps existing whole-element behaviour). Register a new highlight action in `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`, and `packages/excalidraw/actions/index.ts`, render it while editing text in both full (`SelectedShapeActions`) and compact (`CompactShapeActions`, `MobileShapeActions` if applicable) panels in `packages/excalidraw/components/Actions.tsx`, and add English UI label(s) in `packages/excalidraw/locales/en.json`.
6. **IS-6 (Persistence, restore normalisation, and collaboration round-trip):** Carry and normalise the styled-ranges field in `packages/excalidraw/data/restore.ts` (`case "text":`), dropping malformed entries (negative offsets, `start >= end`, non-numbers, unknown keys, empty style objects), clamping offsets to `originalText.length`, and keeping the field absent for legacy/unstyled elements so saved files and remote `restoreElements -> reconcileElements` collaboration preserve ranges accurately.
7. **IS-7 (SVG export for styled runs and highlights in LTR and RTL / mixed-direction text):** Update `packages/excalidraw/renderer/staticSvgScene.ts` so lines with styled ranges emit `<rect>` elements behind the text for highlights and `<text>` with `<tspan>` children per colour run (with `applyDarkModeFilter` applied in dark mode), selecting the left-prefix path only when `!hasRTLChars(line.text)` and the architect's bidi-aware path whenever `hasRTLChars(line.text)` is true (with `isRTL(element.text)` used only for the base `direction` and `text-anchor`, as today), while lines/elements without ranges emit the exact same `<text>` markup as today.
8. **IS-8 (Unit, jsdom integration, restore/reconcile, and SVG export tests & changelog):** Add comprehensive tests in `packages/element/tests/textStyles.test.ts`, `packages/element/tests/textWrapping.test.ts`, `packages/element/tests/textElement.test.ts`, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`, `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/data/reconcile.test.ts`, and `packages/excalidraw/tests/scene/export.test.ts`, plus an `## Unreleased` entry in `packages/excalidraw/CHANGELOG.md`.

---

## Out of scope

1. **OOS-1:** Character-level (CRDT or Operational Transformation) merging of concurrent edits to the same text element (`packages/excalidraw/data/reconcile.ts` is off-limits; whole-element last-writer-wins remains).
2. **OOS-2:** Custom history delta logic in `packages/element/src/delta.ts` (off-limits; history relies on immutable array replacement).
3. **OOS-3:** Typography or rich-text attributes beyond `color` and `highlight` (no bold, italic, underline, strikethrough, per-range font size, per-range font family, or per-range hyperlinks).
4. **OOS-4:** A floating inline formatting toolbar inside or above the canvas WYSIWYG text editor.
5. **OOS-5:** Rich-text HTML clipboard paste (pasting into a text editor continues to insert plain text and shift existing ranges as normal text input).
6. **OOS-6:** PNG or clipboard-image export changes or PNG-specific test suites beyond what the shared canvas renderer in `packages/element/src/renderElement.ts` automatically provides.
7. **OOS-7:** Any modifications to `excalidraw-app/**`, `packages/excalidraw/components/App.tsx`, or non-English locale files (`packages/excalidraw/locales/*.json` other than `en.json`).
8. **OOS-8:** Styled ranges on any non-text elements other than `ExcalidrawTextElement` (standalone text, bound text in containers, sticky note labels, and arrow labels are `ExcalidrawTextElement` and are in scope).

---

## Functional requirements per module

### Module 1: Range Data Model & Operations (`packages/element/src/types.ts`, `packages/element/src/textStyles.ts`, `packages/element/src/index.ts`)

- **FR-1 (Range types and element field):** `packages/element/src/types.ts` SHALL define a read-only styled text range type (e.g. `TextRangeStyle` / `StyledTextRange` with `start: number`, `end: number`, `color?: string`, `highlight?: string`) and add an optional readonly array field on `ExcalidrawTextElement` indexing UTF-16 code-unit offsets into `originalText`. Types and helper functions SHALL be implemented in `packages/element/src/textStyles.ts` and re-exported from `packages/element/src/types.ts` and `packages/element/src/index.ts`. *(Traces to: Brief §Goal, §Files in scope)*
- **FR-2 (Normalisation invariants):** `packages/element/src/textStyles.ts` SHALL provide a normalisation function that:
  1. Drops malformed or non-styled entries (where neither `color` nor `highlight` is a valid non-transparent style string, or where `start`/`end` are not finite numbers);
  2. Clamps `start` and `end` to `[0, textLength]` as integers and drops entries where `start >= end`;
  3. Resolves overlapping ranges deterministically (later-applied style overrides earlier style on overlapping sub-intervals) so the resulting list is strictly non-overlapping and sorted by `start` ascending;
  4. Merges adjacent ranges (`prev.end === next.start`) when their `color` and `highlight` values are identical;
  5. Returns `undefined` (or empty representation omitted on the element) when no styled ranges remain. *(Traces to: Brief §Goal, §Acceptance criteria 1)*
- **FR-3 (Applying colour and highlight to a selection range):** `packages/element/src/textStyles.ts` SHALL provide a function to apply a `color` or `highlight` update over `[selectionStart, selectionEnd]` in `originalText`:
  1. Applying a `color` sets `color` on `[selectionStart, selectionEnd]` while preserving any existing `highlight` on overlapping sub-ranges (and clearing `color` if the chosen colour equals `transparent` or matches the base `strokeColor`);
  2. Applying a `highlight` sets `highlight` on `[selectionStart, selectionEnd]` while preserving any existing `color` on overlapping sub-ranges;
  3. Applying `highlight: "transparent"` removes `highlight` from `[selectionStart, selectionEnd]` while retaining any `color` on those characters;
  4. Returns a newly allocated normalised array (never mutating the input array in place, so `packages/element/src/delta.ts` detects changes via reference/shallow comparison). *(Traces to: Brief §Context, §Goal 1, §Acceptance criteria 1 & 2)*
- **FR-4 (Shifting ranges on text edit):** `packages/element/src/textStyles.ts` SHALL provide a function that computes the edit diff between `prevOriginalText` and `nextOriginalText` (via common prefix and common suffix, or explicit edit bounds) and shifts/trims existing ranges accordingly:
  1. Characters inserted before a range (`insertPos <= range.start`) shift `range.start` and `range.end` right by the net inserted length;
  2. Characters inserted strictly inside a range (`range.start < insertPos < range.end`) expand `range.end` by the net inserted length;
  3. Characters inserted at `insertPos === range.end` follow the documented boundary rule (extending or preserving `range.end` consistently);
  4. Deletions or replacements overlapping the start, middle, end, or entirety of a range shrink, split/shift, or remove the affected range and re-normalise. *(Traces to: Brief §Goal, §Acceptance criteria 1)*
- **FR-5 (Projection onto wrapped lines and run splitting for LTR and bidi lines):** `packages/element/src/textStyles.ts` (with `packages/element/src/textWrapping.ts` if an additional export is needed) SHALL project ranges stored against `originalText` onto the visual lines returned by `getWrappedTextLines(originalText, font, maxWidth, env)`:
  1. Each visual line `[line.start, line.end)` (which excludes soft `\n` breaks and any trailing whitespace trimmed at a wrap boundary) is partitioned into contiguous runs covering `[0, line.text.length]`;
  2. The left-prefix measurement path SHALL be selected **only** for a visual line where `!hasRTLChars(line.text)` (`packages/common/src/utils.ts:397–402`), computing each run's horizontal geometry (`x`, `width`) by measuring the preceding line prefix (`line.text.slice(0, runStart)`) and the run substring in the element's font so that `left`, `center`, and `right` alignments align identically to whole-line `fillText`;
  3. Whenever `hasRTLChars(line.text)` is `true` for a visual line—regardless of what `isRTL(element.text)` returns (matching `packages/excalidraw/wysiwyg/textWysiwyg.tsx:669–677`, since `isRTL` in `packages/common/src/utils.ts:384–395` checks only the first directional character and returns `false` on LTR-first mixed text such as `"Price: ١٢٠ درهم"`)—the line SHALL take the bidi-aware path (the architect's stated RTL/mixed-direction rule; see FR-17), while `isRTL(element.text)` is used only for the base direction (`dir` on canvas and `direction` / `text-anchor` in SVG, as today). *(Traces to: Brief §Context, §Goal, §Acceptance criteria 1, Gate 1 revise)*

### Module 2: Element Construction, Layout & List-Marker Rewrites (`packages/element/src/newElement.ts`, `packages/element/src/textElement.ts`, `packages/element/src/listMarker.ts`, `packages/excalidraw/components/App.duplicate.ts`)

- **FR-6 (Constructor and dimension refresh preservation):** `newTextElement` in `packages/element/src/newElement.ts` SHALL accept the optional styled-ranges field (normalising it and omitting it when empty so newly created unstyled elements have no extra property key). `refreshTextDimensions` in `packages/element/src/newElement.ts` and text bounding-box/layout helpers in `packages/element/src/textElement.ts` SHALL preserve existing ranges when re-wrapping or resizing, and shift ranges whenever `originalText` changes. *(Traces to: Brief §Files in scope, §Acceptance criteria 2 & 6)*
- **FR-7 (List-marker continuation and reversal):** When `advanceDuplicatedListMarkers` or `applyListMarkerAdvances` in `packages/element/src/listMarker.ts` (invoked from `packages/excalidraw/components/App.duplicate.ts`) rewrites `originalText` (e.g., `1. item` -> `2. item` or `ix. item` -> `x. item` where marker length may change), it SHALL shift the element's styled ranges from `prevOriginalText` to `nextOriginalText` so styled words after the marker stay aligned with their characters across both advance (`"next"`) and undo/revert (`"prev"`). *(Traces to: Brief §Context, §Files in scope)*

### Module 3: Canvas Renderer (`packages/element/src/renderElement.ts`)

- **FR-8 (Per-run canvas text and highlight rendering):** In `packages/element/src/renderElement.ts`, when rendering an `ExcalidrawTextElement`:
  1. If the element has no styled ranges, it SHALL execute the existing fast path (`context.fillText` per line) with zero behavioural or visual change;
  2. `isRTL(element.text)` SHALL continue to be used only for the base direction on `context.canvas` (`dir="rtl"` vs `"ltr"` and temporary DOM attachment in `renderElement.ts` lines 661–676), as today;
  3. If the element has styled ranges, it SHALL project the ranges onto the visual lines and, for each visual line, select the left-prefix run-positioning path only when `!hasRTLChars(line.text)` and the bidi-aware path (see FR-17) when `hasRTLChars(line.text)` is `true` (whatever `isRTL(element.text)` returns):
     - First draw a filled rectangle (`context.fillRect`) for each run that has a `highlight`, using `applyDarkModeFilter(run.highlight, renderConfig.theme === THEME.DARK)`, spanning the run's horizontal `[runX, runX + runWidth]` and line vertical bounds;
     - Next draw each run's text (`context.fillText`) using `applyDarkModeFilter(run.color ?? element.strokeColor, renderConfig.theme === THEME.DARK)` so that pure-LTR, pure-RTL, and LTR-first or RTL-first mixed-direction lines colour and highlight the exact target characters for `left`, `center`, and `right` alignments. *(Traces to: Brief §Goal, §Files in scope, §Acceptance criteria 6, Gate 1 revise)*

### Module 4: WYSIWYG Editor & App Text Integration (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/css/styles.scss`)

- **FR-9 (Coloured & highlighted live preview while editing):** `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (and `packages/excalidraw/css/styles.scss` if CSS classes are used) SHALL render a live styled preview while editing a text element that has styled ranges (or when ranges are applied during the edit session):
  1. Coloured text runs and highlight backgrounds SHALL be visible in the editor DOM while typing and when re-entering edit mode on an already-styled text element;
  2. The preview layer SHALL match the `<textarea>`'s font, font size, line height, wrapping (`whiteSpace`, `wordBreak`, `overflowWrap`), `textAlign`, `dir`, dimensions, scroll position, zoom, and CSS transform (`translate`/`rotate`) while keeping the native caret and text selection visible. *(Traces to: Brief §Goal 2, §Files in scope, §Acceptance criteria 2)*
- **FR-10 (Range shifting during live typing, paste, and tab indent/outdent):** Whenever `editable.value` changes in `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (including normal typing, plain-text paste, `normalizeText` adjustments, and `Tab`/`Shift+Tab` indent/outdent), the editor SHALL shift the current styled ranges from the previous `originalText` to the normalized `editable.value` and pass the updated ranges through `onChange` / `updateElement` in `packages/excalidraw/components/App.text.ts` to update the scene element (including bound text and sticky note labels). *(Traces to: Brief §Context, §Goal, §Files in scope, §Acceptance criteria 2)*
- **FR-11 (Live selection exposure and preservation across picker interactions):** `packages/excalidraw/wysiwyg/textWysiwyg.tsx` and `packages/excalidraw/components/App.text.ts` (plus `packages/excalidraw/types.ts` if needed on `AppClassProperties`) SHALL expose the active editor's current selection offsets (`{ start: number; end: number }` into `originalText`) so property actions can read the live selection even when clicking a colour swatch or opening a compact popover moves focus away from the `<textarea>`. Applying a stroke colour or highlight from the properties panel SHALL NOT submit/close the editor, SHALL preserve the textarea's `[selectionStart, selectionEnd]`, and SHALL immediately refresh the editor's live preview layer. *(Traces to: Brief §Context, §Goal 1, §Files in scope, §Acceptance criteria 2)*

### Module 5: Property Actions, Styles Panel UI & Localization (`packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`, `packages/excalidraw/actions/index.ts`, `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/locales/en.json`)

- **FR-12 (Range-aware `actionChangeStrokeColor`):** In `packages/excalidraw/actions/actionProperties.tsx`, when `appState.editingTextElement` is active and the active text editor has a non-empty selection (`start < end`):
  1. `actionChangeStrokeColor` SHALL apply the chosen `color` only to the selected range `[start, end]` on the edited text element using the range model, leaving `element.strokeColor`, `appState.currentItemStrokeColor`, and any sticky note container `strokeColor` unchanged;
  2. When no text element is being edited, or when the active text editor has a collapsed caret (`start === end`), `actionChangeStrokeColor` SHALL retain its exact existing behaviour (recolouring the whole element's `strokeColor` and syncing sticky note ink when applicable);
  3. The stroke `ColorPicker` current value in `PanelComponent` SHALL reflect the active selection's uniform range `color` if all characters in the selection share one, or `element.strokeColor` otherwise. *(Traces to: Brief §Goal 1, §Files in scope, §Acceptance criteria 2)*
- **FR-13 (New text highlight action and picker UI):**
  1. Register a new action (e.g. `actionChangeTextHighlight` / name registered in `packages/excalidraw/actions/types.ts` and exported from `packages/excalidraw/actions/index.ts` and `packages/excalidraw/actions/actionProperties.tsx`) that reuses the `ColorPicker` component and element background colour palette, including `"transparent"` to clear a highlight;
  2. When invoked while editing a text element with a non-empty selection (`start < end`), the action SHALL apply or clear (`"transparent"`) the `highlight` on `[start, end]` of the edited text element and record the update with `CaptureUpdateAction.IMMEDIATELY`; when invoked with a collapsed caret (`start === end`), it SHALL be a safe no-op (not altering element `backgroundColor`);
  3. Render the highlight picker in `packages/excalidraw/components/Actions.tsx` in both the full styles panel (`SelectedShapeActions`) and compact styles panels (`CompactShapeActions` and `MobileShapeActions`) **only while editing a text element** (`Boolean(appState.editingTextElement)`), without enabling `hasBackground("text")` for non-editing text selection;
  4. Add the English translation label(s) for the highlight picker in `packages/excalidraw/locales/en.json` only. *(Traces to: Brief §Context, §Goal 1, §Files in scope, §Acceptance criteria 2)*

### Module 6: Restore, Persistence & Collaboration (`packages/excalidraw/data/restore.ts`)

- **FR-14 (Restore normalisation & backward compatibility):** In `packages/excalidraw/data/restore.ts` (`restoreElement`, `case "text":`), restore SHALL inspect the incoming text element's styled-ranges field:
  1. If the field is absent, `null`, `undefined`, or not an array, or normalises to zero valid ranges, the restored element SHALL omit the field (keeping legacy and unstyled elements unchanged);
  2. If the field is an array, restore SHALL filter out non-object entries, strip unknown property keys (keeping only `start`, `end`, and valid string `color` / `highlight`), clamp `start` and `end` to `[0, originalText.length]`, drop entries with negative/NaN/inverted bounds after clamping (`start >= end`), and merge adjacent identical ranges;
  3. If `opts?.deleteInvisibleElements && !text && !element.isDeleted` empties the text element, any ranges SHALL also be cleared/omitted;
  4. Elements restored via `restoreElements` and merged via `reconcileElements` (collaboration remote path) or loaded from serialized JSON files SHALL retain their normalised styled ranges. *(Traces to: Brief §Context, §Goal, §Files in scope, §Acceptance criteria 1 & 4)*

### Module 7: Static SVG Export (`packages/excalidraw/renderer/staticSvgScene.ts`)

- **FR-15 (SVG `<tspan>` runs and highlight `<rect>` elements):** In `packages/excalidraw/renderer/staticSvgScene.ts` (`case "text":`):
  1. When a text element has no styled ranges (or a given line has no styled runs), SVG export SHALL emit the exact same `<text>` node structure and attributes as today;
  2. `isRTL(element.text)` SHALL continue to be used only for the base direction (`direction="rtl"` vs `"ltr"`) and `text-anchor` (`"end"` when `textAlign === "right" || direction === "rtl"`, `"middle"` when `"center"`, else `"start"` in `staticSvgScene.ts` lines 808–814), as today;
  3. When a visual line has styled ranges, run positioning SHALL select the left-prefix path only when `!hasRTLChars(line.text)` and the architect's bidi-aware path when `hasRTLChars(line.text)` is `true` (whatever `isRTL(element.text)` returns; see FR-17):
     - For each run on the line with a `highlight`, emit an SVG `<rect>` appended to `node` **before** the line's `<text>` element so it renders behind the glyphs, positioned at the run's `x` (computed via the per-line `!hasRTLChars(line.text)` / `hasRTLChars(line.text)` rule and accounting for the element's `textAlign` and base `direction`) and the line's `y` top offset with the run's measured `width`, `lineHeightPx` height, and `fill` set to `applyDarkModeFilter(run.highlight, renderConfig.theme === THEME.DARK)`;
     - Emit one `<text>` element for the line (preserving `direction` and `text-anchor` from `staticSvgScene.ts` lines 808–814) containing `<tspan>` child elements for each run in logical order, where each `<tspan>` carries the run's substring and sets `fill` to `applyDarkModeFilter(run.color ?? element.strokeColor, renderConfig.theme === THEME.DARK)`. *(Traces to: Brief §Goal, §Files in scope, §Acceptance criteria 3 & 6, Gate 1 revise)*

### Module 8: Documentation (`packages/excalidraw/CHANGELOG.md`)

- **FR-16 (Changelog entry):** Add an entry under `## Unreleased` in `packages/excalidraw/CHANGELOG.md` documenting support for per-range text colour and highlight in text elements and noting the new optional field on `ExcalidrawTextElement`. *(Traces to: Brief §Files in scope)*

### Module 9: RTL & Mixed-Direction Text Rendering (`packages/element/src/textStyles.ts`, `packages/element/src/renderElement.ts`, `packages/excalidraw/renderer/staticSvgScene.ts`)

- **FR-17 (Per-line bidi-aware run positioning & rendering on canvas and SVG via `hasRTLChars`):**
  1. **Per-line selector (`hasRTLChars(line.text)` vs `isRTL(element.text)`):** `isRTL(text)` (`packages/common/src/utils.ts:384–395`) tests only whether the *first* strong directional character is RTL (`RE_RTL_CHECK = ^[^LTR]*[RTL]`), whereas `hasRTLChars(text)` (`packages/common/src/utils.ts:397–402`) tests whether the text contains *any* RTL character and may be laid out bidirectionally (as `packages/excalidraw/wysiwyg/textWysiwyg.tsx:669–677` already uses for caret placement). Therefore:
     - `isRTL(element.text)` SHALL be used **only** for the element's base direction: setting `dir` on `context.canvas` (`renderElement.ts:661–676`) and setting `direction` and `text-anchor` on `<text>` in SVG export (`staticSvgScene.ts:808–814`), as today;
     - Per-visual-line run positioning SHALL select the simple LTR left-prefix measurement path **only** when `!hasRTLChars(line.text)`, and SHALL select the bidi-aware path whenever `hasRTLChars(line.text)` is `true` (covering both RTL-first lines and LTR-first mixed-direction lines such as `"Price: ١٢٠ درهم"` where `isRTL` is `false` but `hasRTLChars` is `true`).
  2. **Architectural decision required:** Because measuring the logical left prefix (`line.text.slice(0, runStart)`) is valid only when `!hasRTLChars(line.text)`, the architect MUST explicitly state how runs and highlight rectangles are positioned for visual lines where `hasRTLChars(line.text)` is `true` across `left`, `center`, and `right` alignments and under both base directions (`isRTL(element.text)` `true` or `false`).
  3. **Canvas accuracy:** On canvas (`packages/element/src/renderElement.ts`), styled ranges on any line where `hasRTLChars(line.text)` is `true` (both pure RTL and LTR-first / RTL-first mixed-direction text) SHALL colour and highlight the exact characters indexed by `[range.start, range.end)` in `originalText` without breaking bidi shaping/directionality or alignment.
  4. **SVG accuracy:** In SVG export (`packages/excalidraw/renderer/staticSvgScene.ts`), `<tspan>` children and background highlight `<rect>` elements on any line where `hasRTLChars(line.text)` is `true` SHALL colour and highlight the exact characters indexed by `[range.start, range.end)` in `originalText`, accounting for the element's base `direction` and `text-anchor` (`"start"`, `"middle"`, or `"end"`). *(Traces to: Gate 1 revise, Brief §Goal, §Acceptance criteria 1 & 3)*

---

## Non-functional requirements

- **NFR-1 (Zero regression & byte-identical unstyled elements):** Text elements without styled ranges MUST produce byte-identical serialized JSON, identical in-memory element shapes (field absent/`undefined` when empty), identical canvas rendering calls, and identical SVG DOM output to existing elements so existing snapshot files remain valid without needless churn. *(Traces to: Brief §Goal, §Acceptance criteria 5 & 6)*
- **NFR-2 (Immutability & undo/redo compatibility):** All updates to `ExcalidrawTextElement` and its styled-ranges array MUST be immutable (`Readonly`, replacing the array reference via `newElementWith` or `mutateElement` rather than mutating in place) so `packages/element/src/delta.ts` captures undo/redo history deltas without modifying `delta.ts`. *(Traces to: Brief §Context, §Files off-limits, §Acceptance criteria 2)*
- **NFR-3 (Performance & zero measurement overhead for unstyled text):** Unstyled text elements MUST bypass range projection and per-run measurement during canvas rendering, SVG export, and WYSIWYG editing. For styled text, glyph width/height measurement (`measureText`) MUST remain unchanged because `color` and `highlight` do not alter font metrics. *(Traces to: Brief §Goal)*
- **NFR-4 (Codebase & lint conventions):** All new and modified code MUST adhere to repository conventions in `.sdlc/baseline/stack-profile.md`:
  - Use `app.ownerDocument` / `app.ownerWindow` instead of global `document` / `window`;
  - Import across packages strictly via `@excalidraw/*` path aliases with ESLint-compliant import group ordering;
  - Use named `export const` functions (no default exports) and `import type` for type-only imports;
  - Pass `yarn test:typecheck` (`tsc`), `yarn test:code` (`eslint --max-warnings=0`), and `yarn test:app --watch=false` (`vitest`). *(Traces to: Brief §Gate 0, §Acceptance criteria 5)*
- **NFR-5 (Untrusted input safety on restore):** `restoreElement` in `packages/excalidraw/data/restore.ts` MUST sanitise arbitrary/malformed JSON input from loaded `.excalidraw` files or remote collaborators without throwing uncaught exceptions, stripping unknown keys and clamping out-of-bounds indices. *(Traces to: Brief §Files in scope, §Acceptance criteria 1 & 4)*

---

## PII inventory

This feature operates entirely client-side on diagram scene elements (`ExcalidrawTextElement`) within the `@excalidraw/element` and `@excalidraw/excalidraw` packages. It introduces no user accounts, telemetry payloads, cookies, or server databases.

| Field | Sensitivity | Protection |
|---|---|---|
| `ExcalidrawTextElement.originalText` / `text` (existing user-authored diagram text) | Low / User-defined content (may contain arbitrary text typed by a user into a diagram) | Held in client memory; serialized only when the user saves/exports a scene or uses host-provided encrypted collaboration (`excalidraw-app` E2EE is unchanged and off-limits). |
| `ExcalidrawTextElement.<styledRanges>` (`start`, `end`, `color`, `highlight`) | None (numeric character offsets and CSS colour strings) | Validated and normalised on `restoreElement` (unknown keys stripped, offsets clamped to `[0, originalText.length]`); travels with `ExcalidrawTextElement` under the same client/collaboration lifecycle. |

---

## Role matrix

Excalidraw is a client-side whiteboard library where permissions depend on the editor mode (`viewModeEnabled` vs. active editing) and collaboration state (`reconcileElements`).

| Role | Resource | Action | Permission / Behaviour |
|---|---|---|---|
| **Editor user (active text editing, non-empty selection)** | `ExcalidrawTextElement` styled ranges (`color`, `highlight`) | Apply / modify / clear range colour or highlight via Stroke or Highlight `ColorPicker`; edit text | **Allowed** — updates only the selected range `[start, end]`, preserves `element.strokeColor`, keeps editor open with selection intact, and records undo history. |
| **Editor user (active text editing, collapsed caret)** | `ExcalidrawTextElement` | Pick stroke colour / pick highlight colour | **Allowed (whole element for stroke / no-op for highlight)** — stroke colour picker updates whole-element `strokeColor` (and sticky note ink if applicable); highlight picker does not alter element `backgroundColor`. |
| **Editor user (not editing text, element selected)** | `ExcalidrawTextElement` | View styles panel / change stroke colour, font size, font family, alignment, duplicate, undo/redo | **Allowed** — stroke colour picker recolours whole-element `strokeColor`; highlight picker is hidden; font/size/alignment/duplicate/undo/redo preserve styled ranges. |
| **View-only user (`viewModeEnabled: true`)** | `ExcalidrawTextElement` (Canvas, SVG export) | View rendered canvas and export SVG | **Read-only** — sees styled text runs and highlights on canvas and in exported SVG (both light and dark mode); cannot open `textWysiwyg` or invoke style-mutating actions. |
| **Remote collaborator (`restoreElements` -> `reconcileElements`)** | `ExcalidrawTextElement` | Receive remote element update | **Allowed (whole-element LWW)** — incoming element ranges are normalised by `restoreElements` and accepted by `reconcileElements` if remote `version` wins and the element is not currently being edited locally. |

---

## Acceptance criteria

- **AC-1 (Range model unit tests — `packages/element/tests/textStyles.test.ts`):**
  - Automated unit tests verify inserting text before, strictly inside, at the end of, and after a styled range (following the documented boundary extend rule);
  - Automated unit tests verify deleting and replacing text that overlaps a range's start, interior, end, or entire span;
  - Automated unit tests verify normalisation: sorting unsorted ranges, splitting/overriding overlapping ranges, merging adjacent ranges with identical `color` and `highlight`, dropping zero-length or style-empty ranges, clamping offsets to `[0, originalText.length]`, and returning `undefined` when empty;
  - Automated unit tests verify projecting ranges onto wrapped lines via `getWrappedTextLines`, including ranges spanning a soft word-wrap break and a hard `\n`, with trailing whitespace trimmed at a wrap boundary;
  - Automated unit tests verify splitting projected lines into positioned runs for `left`, `center`, and `right` alignment across both pure-LTR lines (`!hasRTLChars(line.text)`) and bidi/RTL lines selected per visual line via `hasRTLChars(line.text)`, including both an RTL-first case and an LTR-first mixed-direction case (e.g. `"Price: ١٢٠ درهم"`, where `isRTL` is `false` but `hasRTLChars` is `true`), asserting that it takes the bidi-aware path and its runs cover and position the right characters.
  *(Verification: `yarn test:app --watch=false packages/element/tests/textStyles.test.ts` passes)*

- **AC-2 (Restore & malformed input tests — `packages/excalidraw/tests/data/restore.test.ts`):**
  - Restoring a legacy text element without the styled-ranges field returns an element with the field absent/unchanged;
  - Restoring a text element with malformed ranges (negative offsets, `start >= end`, offsets past `originalText.length`, non-array values, or unknown object keys) clamps valid ranges, strips unknown keys, and drops invalid ranges.
  *(Verification: `yarn test:app --watch=false packages/excalidraw/tests/data/restore.test.ts` passes)*

- **AC-3 (WYSIWYG jsdom integration tests — `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`):**
  - Typing `"Bid request timeout 120ms"`, selecting `"120ms"` in the `<textarea>`, and picking a stroke colour updates the text element data to hold that exact range `[20, 25]` and `color`, while `element.strokeColor` remains unchanged;
  - Selecting `"120ms"` and picking a highlight colour updates the text element data to hold that exact range `[20, 25]` and `highlight` (and picking `"transparent"` clears it);
  - Picking a stroke colour while editing with a collapsed caret (`selectionStart === selectionEnd`) recolours the whole element's `strokeColor`;
  - Typing characters before and inside the styled range after styling shifts and expands the range offsets accurately;
  - Styling ranges works inside a bound-text container (e.g. rectangle label) and on a sticky note label;
  - Changing font size or font family on a text element with styled ranges preserves the ranges;
  - Undo and redo (`actionUndo` / `actionRedo`) restore the element's range state across styling and text edits;
  - Submitting the editor and re-entering edit mode renders the styled ranges in the editor's live preview layer (asserted on the preview DOM nodes/styles).
  *(Verification: `yarn test:app --watch=false packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` passes)*

- **AC-4 (SVG export tests — `packages/excalidraw/tests/scene/export.test.ts`):**
  - Exporting a text element with a coloured range to SVG emits a `<text>` element with `<tspan>` children carrying the expected `fill` attributes;
  - Exporting a text element with a highlight range to SVG emits a `<rect>` element behind the `<text>` run with the expected `fill` and measured position/dimensions;
  - Exporting text elements where `hasRTLChars(line.text)` is `true`—covering both an RTL-first text element (`isRTL(element.text)` is `true`) and an LTR-first mixed-direction text element (e.g. `"Price: ١٢٠ درهم"`, where `isRTL(element.text)` is `false` but `hasRTLChars(line.text)` is `true`)—with coloured and highlighted ranges to SVG emits `<tspan>` children carrying the right `fill` for the styled characters and highlight `<rect>` elements positioned at the corresponding bidi-aware run positions (with `isRTL(element.text)` governing the base `direction` and `text-anchor`);
  - Exporting an unstyled text element produces SVG markup identical to today (a plain `<text>` per line without `<tspan>` or highlight `<rect>`);
  - Exporting a styled text element in dark mode (`exportWithDarkMode: true`) applies `applyDarkModeFilter` to both range `color` fills and `highlight` rect fills.
  *(Verification: `yarn test:app --watch=false packages/excalidraw/tests/scene/export.test.ts` passes)*

- **AC-5 (Collaboration & persistence round-trip tests — `packages/excalidraw/tests/data/reconcile.test.ts` & `restore.test.ts`):**
  - A text element with styled ranges round-trips through `restoreElements` -> `reconcileElements` (remote collaboration path) and through JSON serialize -> `restoreElements` (file save/load path) with its ranges intact;
  - Concurrent edits to the same text element by two collaborators resolve via `reconcileElements` to the winning whole element whose ranges match its own `originalText`.
  *(Verification: `yarn test:app --watch=false packages/excalidraw/tests/data/reconcile.test.ts` passes)*

- **AC-6 (Full verification suite & zero unstyled regressions):**
  - `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` exits with code 0 from the repo root;
  - No files outside the brief's *Files in scope* are modified, and no off-limits files are touched.

---

## Open questions for HITL

None. All product, scope, and Gate 0 architectural boundaries were resolved in the approved intent brief.
