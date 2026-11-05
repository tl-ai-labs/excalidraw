# Intent Brief — feature-new — Styled ranges in text elements (colour + highlight)

> **Gate 0: approved, 2026-11-05.** The write contract is frozen (32 allowlist entries, 30 off-limits patterns).
> - Intent: `feature-new`.
> - Policy: `argon4-agsdk-only`.
> - Auth mode: `vendor`.
> - Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`, run from the repo root.
> - Concurrent edits: whole element wins (today's rule); `reconcile.ts` stays off-limits.
> - AI configs: off-limits. No `.gitignore` entry for `.sdlc/`, because `.git/info/exclude` already covers it.
> - The scope below is final as approved.

## Context

A text element has one `strokeColor` for all of its text. The colour picker recolours all of it.
Users cannot colour one term or highlight a key word in a label, so they split text into several
elements, which breaks wrapping and alignment. This is two of the most up-voted open upstream
requests: excalidraw/excalidraw#1126 (144 votes) and #5138 (184).

Seed description (verbatim, from the command): "Let users colour or highlight part of a text
element, with the styling saved, collaborated, rendered on canvas and kept in SVG export."

The person's full problem statement (pasted during the interview) is the source of the Goal and
Acceptance criteria below.

What the code does today (read during intake, `HEAD 14bb42ede`):

- `ExcalidrawTextElement` (`packages/element/src/types.ts:253`) carries `originalText` (what the user
  typed) and `text` (the wrapped copy, with soft `\n`s inserted). Canvas (`packages/element/src/renderElement.ts`
  ~L686–712) and SVG (`packages/excalidraw/renderer/staticSvgScene.ts` ~L792–826) both split `element.text`
  on `\n` and emit one `fillText` / one `<text>` per line, in a single `strokeColor`.
- `getWrappedTextLines()` (`packages/element/src/textWrapping.ts:409–420`) already returns each visual line
  with `start`/`end` offsets into the **original** text. Ranges stored against `originalText` can be
  projected onto wrapped lines through it.
- The editor is a plain `<textarea>` (`packages/excalidraw/wysiwyg/textWysiwyg.tsx:533`), and the canvas skips
  drawing the text being edited (`packages/excalidraw/scene/Renderer.ts:262–264`). A textarea can show only
  one colour, so coloured ranges are invisible while editing unless something else draws them.
- Clicking the properties panel does not close the editor (`temporarilyDisableSubmit`,
  `textWysiwyg.tsx` ~L1163, L1214–1227), and a textarea keeps `selectionStart`/`selectionEnd` after it loses
  focus. A colour pick can read the live selection without ending the edit.
- `actionChangeStrokeColor` (`packages/excalidraw/actions/actionProperties.tsx:366`) already targets the
  text being edited. Text elements have **no background picker**: `hasBackground` (`packages/element/src/comparisons.ts:3`)
  leaves out `"text"`. A highlight control is therefore new UI.
- Collaboration: remote elements go through `restoreElements` (`excalidraw-app/collab/Collab.tsx:782`)
  and then `reconcileElements` (`packages/excalidraw/data/reconcile.ts`). Restore rebuilds each element
  from a fixed field list, so a new field must be carried in `packages/excalidraw/data/restore.ts`, or file
  load and collaboration both silently drop it. Reconcile is whole-element: highest `version` wins, and a
  remote update to the text you are editing is discarded (`reconcile.ts:28–40`).
- History deltas (`packages/element/src/delta.ts`) compare a changed field by reference and shallow
  equality, so a new array field records in undo/redo with no delta code, as long as every change
  replaces the array instead of mutating it.
- Duplicate deep-copies elements (`packages/element/src/duplicate.ts:109`), so ranges copy with no change.
- `originalText` is rewritten outside the editor too: list-marker continuation
  (`packages/element/src/listMarker.ts`, `packages/excalidraw/components/App.duplicate.ts`) and the
  editor's own text normalisation (`textWysiwyg.tsx:853–866`). Ranges must be shifted on every such
  rewrite, not only on typing.

## Goal

**Before:** "Bid request timeout 120ms" is drawn in one colour, and the colour picker recolours all of it.
**After:** while editing, select "120ms" and choose red, or a yellow highlight. That word alone is red or
highlighted on the canvas, in the editor while typing, and in the exported SVG.

Agreed in the interview:

1. **How a user applies styles: the existing colour pickers.** While a text element is being edited and
   its textarea has a non-empty selection:
   - the **stroke colour** picker applies text colour to the selected characters only;
   - a new **highlight** picker, shown only while editing text, applies a highlight to the selected
     characters only. It reuses the existing colour-picker component and palette, and includes `transparent`
     to clear the highlight.

   With no selection (a collapsed caret), the stroke picker keeps today's behaviour and recolours the whole
   element. Picking a colour does not end the edit, and the textarea selection survives the pick.
2. **What the editor shows while typing: a coloured preview.** Coloured ranges stay visible while editing,
   for example as a styled mirror layer under a transparent-text textarea (`-webkit-text-fill-color`) with
   caret and native selection kept. The mirror must match the textarea's wrapping, font, line height,
   alignment, zoom and transform exactly. The architect picks the technique and states how alignment is
   kept.
3. **Tests: unit + integration** (see Acceptance criteria).

The data model, in principle. The architect owns the exact shape.

- A new optional field on text elements, a list of styled ranges in **code-unit offsets into
  `originalText`**, each carrying optional `color` and `highlight`. Ranges are kept normalised: sorted, no
  zero-length entries, adjacent equal-style ranges merged, clamped to the text length.
- An element with no ranges is byte-identical to today's elements: field absent or empty, and
  `strokeColor` is the colour of any unstyled character.
- Ranges survive:
  - **text edits** (insert/delete/replace shift or trim them, and typing at a range's end follows a
    rule the architect states);
  - **wrapping and re-wrapping** (projected per visual line through `getWrappedTextLines`, never stored
    against wrapped `text`);
  - **bound-text containers**, sticky notes included;
  - **font family and size changes** (offsets are font-independent; only layout re-runs);
  - **undo/redo**;
  - **duplicate, copy/paste, file save/load and collaboration**.
- **Concurrent edits** to the *same* text by two collaborators resolve exactly as plain text does today:
  whole element, highest version wins. Ranges travel with the text they index, so a winner's ranges always
  match its own text. No character-level merge (see Non-goals).
- Measurement is unchanged: colour and highlight do not change glyph widths, and `measureText` stays the
  source of width and height. Canvas draws each line as a sequence of runs, highlight rect first and then
  glyphs. A run's x comes from measuring the preceding substring in the same font, so per-run drawing stays
  aligned for `left`, `center` and `right` alignment.
- SVG export: a line with ranges becomes one `<text>` with `<tspan>` children, each with its own `fill`.
  Highlights become `<rect>`s behind the text at the same measured offsets. A line with no ranges is emitted
  exactly as today. Dark-mode export applies `applyDarkModeFilter` to range colours, as it does to `strokeColor`.

## Files in scope

New files:

- `packages/element/src/textStyles.ts` — range model: types re-exported from `types.ts`, normalise,
  apply-style-to-range, shift-on-edit (diff old→new text), project-onto-wrapped-lines, split-line-into-runs.
- `packages/element/tests/textStyles.test.ts` — unit tests for the range model.

Edited in `packages/element`:

- `packages/element/src/types.ts` — the new field and its range type on `ExcalidrawTextElement`.
- `packages/element/src/newElement.ts` — `newTextElement` accepts the field. `refreshTextDimensions` and
  the text-update path keep or shift ranges when `originalText` changes.
- `packages/element/src/textElement.ts` — wherever `originalText` is rewritten with the text, ranges are
  shifted with it.
- `packages/element/src/textWrapping.ts` — only if the run projection needs an additional export; offsets
  already exist.
- `packages/element/src/listMarker.ts` — list-marker continuation rewrites `originalText`; shift ranges to match.
- `packages/element/src/renderElement.ts` — per-run canvas drawing for text with ranges.
- `packages/element/src/index.ts` — export the new module.
- `packages/element/tests/textWrapping.test.ts`, `packages/element/tests/textElement.test.ts` — extended where
  wrapping or layout cases need range coverage.

Edited in `packages/excalidraw`:

- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` — expose the live selection as character offsets in
  `originalText`, shift ranges on input and normalisation, render the coloured preview layer, and keep
  selection across colour picks.
- `packages/excalidraw/components/App.text.ts` — the commit path (`updateElement`, ~L187–240) carries ranges
  through to the scene element and gives actions the editor's live selection.
- `packages/excalidraw/components/App.duplicate.ts` — list-marker advances that rewrite text keep ranges aligned.
- `packages/excalidraw/actions/actionProperties.tsx` — `actionChangeStrokeColor` applies to the selected range
  while editing with a non-empty selection. A new highlight action does the same for highlight.
- `packages/excalidraw/actions/types.ts`, `packages/excalidraw/actions/index.ts` — register the new action name.
- `packages/excalidraw/components/Actions.tsx` — show the highlight picker while editing text, in both the
  full and compact panels.
- `packages/excalidraw/types.ts` — only if `AppClassProperties` must expose the editor selection to actions.
- `packages/excalidraw/locales/en.json` — label(s) for the highlight control. Only `en.json`; other locales are
  synced by Crowdin.
- `packages/excalidraw/css/styles.scss` — styles for the editor's preview layer, if not set inline.
- `packages/excalidraw/data/restore.ts` — carry and normalise the field: drop malformed ranges, clamp to text
  length, absent stays absent for legacy files.
- `packages/excalidraw/renderer/staticSvgScene.ts` — `<tspan>` runs and highlight `<rect>`s.

Tests in `packages/excalidraw`:

- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` — jsdom integration (see Acceptance criteria).
- `packages/excalidraw/tests/data/restore.test.ts` — legacy and malformed restore cases.
- `packages/excalidraw/tests/data/reconcile.test.ts` — ranges survive the `restoreElements` → `reconcileElements`
  remote path.
- `packages/excalidraw/tests/scene/export.test.ts` — SVG `<tspan>` fills and highlight rects.
- Snapshot files, regenerated only if the field is materialised on every text element (the architect should
  prefer absent-when-empty so these stay unchanged): `packages/excalidraw/tests/__snapshots__/history.test.tsx.snap`
  (27 text elements), `packages/excalidraw/tests/__snapshots__/regressionTests.test.tsx.snap`,
  `packages/excalidraw/tests/data/__snapshots__/restore.test.ts.snap`, and
  `packages/excalidraw/tests/scene/__snapshots__/export.test.ts.snap`.

Companion docs:

- `packages/excalidraw/CHANGELOG.md` — an `## Unreleased` entry. The new element field is a public data-shape
  change for library users and file-format consumers.

## Files off-limits

- Project defaults from `.sdlc/project.json` `off_limits_default`: `.env`, `.env.*`, `.mcp.json`,
  `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`,
  `.sdlc/**`, `.git/**`.
- AI configs detected by discovery (default OFF-LIMITS): `.claude/settings.local.json`, `CLAUDE.md`,
  `AGENTS.md`, `.github/copilot-instructions.md`.
- Also proposed by discovery: `.env.local`, `.claude/**`, `CLAUDE.local.md`, `**/node_modules/**`,
  `**/dist/**`, `**/build/**`, `**/.next/**`, `excalidraw-app/dev-dist/**`, `coverage/**`,
  `packages/excalidraw/types/**`, and the generated `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`
  and `packages/excalidraw/subset/woff2/woff2-wasm.ts`.
- Ticket-specific:
  - `excalidraw-app/**`. Collaboration needs no app change, because the app already restores and reconciles
    whole elements through the package.
  - `packages/excalidraw/locales/*.json` except `en.json`.
  - `packages/excalidraw/data/reconcile.ts`. The whole-element merge stays as it is.
  - `packages/element/src/delta.ts`. History needs no special case for the new field.
  - `packages/excalidraw/components/App.tsx`. Changes go into its concern modules (`App.text.ts`,
    `App.duplicate.ts`) instead.

## Acceptance criteria

1. **Range model unit tests** (`packages/element/tests/textStyles.test.ts`):
   - insert before, inside, at the end of, and after a range, with the documented extend rule;
   - delete or replace that overlaps a range start, end or whole range;
   - normalise (merge adjacent equal styles, drop empties, clamp);
   - projection onto wrapped lines, including a range spanning a soft wrap and a hard `\n`, with trailing
     whitespace trimmed at a wrap boundary;
   - run splitting for `left`, `center` and `right` alignment;
   - restore of a legacy text element with no field, which comes back unchanged, plus malformed ranges
     (negative, past the end, unknown keys).
2. **jsdom integration tests** (`packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`):
   - type "Bid request timeout 120ms", select "120ms" in the textarea, pick a stroke colour, and assert
     element data holds exactly that range and colour, with `strokeColor` unchanged;
   - the same for highlight;
   - a collapsed-caret stroke pick still recolours the whole element;
   - typing before and inside the range after styling shifts it correctly;
   - a bound-text container case, and a sticky note label;
   - a font-size or font-family change keeps the ranges;
   - undo/redo restores the range state;
   - submitting and re-entering edit shows the ranges in the editor preview layer (asserted on its DOM).
3. **SVG export tests** (`packages/excalidraw/tests/scene/export.test.ts`):
   - a styled line exports as `<text>` with `<tspan>` children carrying the right `fill`;
   - a highlight exports as a `<rect>` behind the run;
   - an unstyled element's SVG is unchanged from today;
   - dark-mode export filters range colours.
4. **Collaboration and persistence:**
   - a text element with ranges round-trips through `restoreElements` and `reconcileElements` (remote path)
     and through serialize → restore (file path) with ranges intact;
   - concurrent edits of the same element resolve to one whole element whose ranges match its own text.
5. **Checks pass:** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false`. Snapshot updates
   are allowed only in the snapshot files listed in Files in scope, and only if the architect's field design
   requires them; any regenerated snapshot is called out in the final report.
6. **No regression for unstyled text:** canvas output, SVG output and element JSON for text with no ranges are
   identical to today.

## Non-goals

- Character-level (CRDT/OT) merging of concurrent edits to the same text element. Whole-element
  last-writer-wins stays.
- Bold, italic, underline, strikethrough, per-range font size or family, and links. The model should leave
  room for more style keys later, but only `color` and `highlight` ship.
- A floating toolbar inside the editor.
- Rich-text paste: keeping colours from HTML clipboard content. Pasting plain text into a styled element
  shifts ranges as typing does.
- PNG/clipboard-image export changes beyond what the shared canvas renderer already gives. Since PNG reuses
  canvas drawing, coloured runs should appear there with no extra work, but there is no PNG-specific test.
- Changes to `excalidraw-app/` or to non-English locale files.
- Styled ranges on non-text elements' labels other than bound text (arrow labels count as bound text and
  are covered).
