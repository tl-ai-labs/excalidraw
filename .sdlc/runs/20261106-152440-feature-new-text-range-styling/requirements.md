# Requirements — Per-Range Text Colour and Highlight (`feature-new`)

- **Run ID:** `20261106-152440-feature-new-text-range-styling`
- **Mode / Intent:** `brownfield` / `feature-new`

---

## In scope

1. **Styled-range data model on text elements (`packages/element`):** An optional field on `ExcalidrawTextElement` storing character-offset ranges `[start, end)` relative to `originalText` with per-range text colour and/or highlight (background fill) colour, omitted (`undefined`) when empty.
2. **Range algebra and line-wrapping projection (`packages/element`):** Pure utilities in `packages/element/src/textRanges.ts` (exported from `packages/element/src/index.ts`) and integration with `textWrapping.ts`, `textMeasurements.ts`, and `textElement.ts` to normalize, merge, split, shift/trim ranges across text insertions and deletions, and map `originalText` offsets onto wrapped lines of `element.text`.
3. **WYSIWYG editor selection styling and live edit-time display (`packages/excalidraw`):** Reading `<textarea>` `selectionStart`/`selectionEnd` during text editing, applying text colour or highlight background fill to the selected substring via `actionProperties.tsx`, shifting ranges on live text edits, falling back to whole-element styling when no substring is selected, and rendering coloured/highlighted runs visibly on the canvas while the editor is still open.
4. **Static canvas per-run rendering (`packages/element`):** Drawing background highlight rectangles and per-run `fillText` calls in `packages/element/src/renderElement.ts` (with dark-mode filter support, alignment/RTL handling, and per-element canvas cache invalidation).
5. **SVG export (`packages/excalidraw`):** Rendering styled text runs in `packages/excalidraw/renderer/staticSvgScene.ts` as `<tspan>` elements with run-specific `fill` attributes and background highlight shapes behind highlighted runs.
6. **Persistence, restore, history deltas, and collaboration reconciliation (`packages/element`, `packages/excalidraw`, `excalidraw-app`):** Preserving valid ranges and clamping/dropping invalid ranges in `restore.ts`, tracking range deltas for undo/redo in `delta.ts`, reconciling concurrent edits in `reconcile.ts`, documenting the public field in `packages/excalidraw/CHANGELOG.md`, and covering collaborative editing in `excalidraw-app/tests/collab.test.tsx`.
7. **Automated tests (`packages/element`, `packages/excalidraw`, `excalidraw-app`):** Unit, jsdom editor, SVG export, restore, reconcile, and collab tests within the Gate 0 allowlist passing under `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.

---

## Out of scope

1. Other per-range typography or styling attributes: bold, italic, underline, strikethrough, font family, or font size per range.
2. Rich-text clipboard paste (parsing HTML or Markdown colour/highlight styles on paste).
3. Element skeleton API (`packages/element/src/transform.ts`) and `dev-docs/**` documentation pages.
4. Copy/paste-styles transferring per-range styles from one element to another.
5. Changes to collaboration transport source files (`excalidraw-app/collab/**`); collaboration is verified through element reconciliation and `excalidraw-app/tests/collab.test.tsx`.
6. Any change to `.gitignore` or any file outside the 39-entry Gate 0 allowlist (including non-allowlisted `__snapshots__` files, `.env*`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `packages/excalidraw/types/**`, and `yarn.lock`).

---

## Functional requirements per module

### Module: `packages/element`

- **FR-1 (Text range data model & optionality):** `ExcalidrawTextElement` (`packages/element/src/types.ts`) shall include an optional styled-range field representing 0-indexed character spans `[start, end)` (`0 <= start < end <= originalText.length`) over `originalText`, where each span specifies a text colour and/or a highlight (background fill) colour. When a text element has no styled ranges, the field must be `undefined` (omitted from serialized element objects, including in `newTextElement` in `packages/element/src/newElement.ts`).
- **FR-2 (Range normalization, merge, and split):** `packages/element/src/textRanges.ts` (re-exported from `packages/element/src/index.ts`) shall normalize range lists so that:
  - Ranges are sorted by `start` offset, clamped to `[0, originalText.length]`, and non-overlapping.
  - Empty spans (`start >= end`) or spans with neither text colour nor highlight colour (or whose styles match the element default with no highlight) are removed, returning `undefined` (or an empty result converted to `undefined` on the element) when no styled spans remain.
  - Applying a text colour or highlight colour over an existing span splits or updates overlapping spans independently per style channel (so highlighting a subset of a coloured span preserves the text colour, and vice versa) and merges adjacent spans that have identical text colour and highlight values.
- **FR-3 (Range shifting and trimming on text edits):** `packages/element/src/textRanges.ts` shall provide an edit-adjustment function that updates ranges when text is inserted into, replaced within, or deleted from `originalText`:
  - Edits strictly before a range shift `[start, end)` by `delta = insertedLength - deletedLength`.
  - Edits strictly after a range leave `[start, end)` unchanged.
  - Deletions overlapping a range's boundary or spanning across a range trim or remove the affected portion; insertions strictly inside a range expand the range (`end += delta`); replacements spanning a range adjust offsets deterministically and drop any range whose length collapses to `0`.
- **FR-4 (Mapping `originalText` ranges onto wrapped lines):** `packages/element/src/textRanges.ts`, `textWrapping.ts`, `textMeasurements.ts`, and `textElement.ts` shall map `originalText` character ranges onto the wrapped lines of `element.text` across soft line wraps (accounting for whitespace consumed or split by `wrapText`), hard `\n` breaks, bound-text container resizing, and font family or font size changes.
- **FR-5 (Static canvas per-run text and highlight rendering):** `packages/element/src/renderElement.ts` shall draw text elements with styled ranges line by line and run by run:
  - For any run carrying a highlight colour, draw a background fill rectangle behind the run's horizontal extent and line box before painting the text glyphs, applying the dark-mode filter when dark mode is active.
  - For each run on a line, draw the substring with `ctx.fillText` at its measured x-offset (respecting `textAlign` and RTL direction) using the run's text colour (or the element's `strokeColor` if the run has no custom text colour), passed through the dark-mode filter when active.
  - Include the element's styled-range data in the per-element canvas cache invalidation signature (`elementWithCanvasCache` / `generateElementCanvas`) so style updates immediately refresh the cached canvas.
- **FR-6 (History delta tracking for undo/redo):** `packages/element/src/delta.ts` shall include the optional styled-range field in text element delta calculation and application so that adding, changing, or clearing range styles (as well as text edits that shift ranges) can be undone and redone cleanly, restoring `undefined` when ranges are undone to an unstyled state.

### Module: `packages/excalidraw`

- **FR-7 (WYSIWYG range selection and style application):** While a text element is open in the WYSIWYG editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`) and the `<textarea>` has a non-empty selection (`selectionStart < selectionEnd`), choosing a stroke colour or a highlight colour in `packages/excalidraw/actions/actionProperties.tsx` (with UI label entries in `packages/excalidraw/locales/en.json` and icon support in `packages/excalidraw/components/icons.tsx` if needed) shall apply that text colour or highlight background fill to the corresponding `[selectionStart, selectionEnd)` range in `originalText` while keeping the editor open.
- **FR-8 (Whole-element fallback with no active substring selection):** When a text element is selected on the canvas (editor closed), or when the WYSIWYG editor is open with a collapsed cursor (`selectionStart === selectionEnd`), the stroke colour and highlight controls shall apply to the whole text element just as today (updating `strokeColor` for text colour, or applying/clearing highlight across the element), without requiring a text range selection.
- **FR-9 (Live edit-time canvas display of styled runs):** While the WYSIWYG text editor is still open, selecting a word/substring and applying a text colour or highlight must display that run coloured or highlighted on the canvas immediately during editing, not only after closing the editor.
  - *Architectural freedom & plan requirement:* These requirements do not prescribe the specific rendering mechanism (for context, `packages/excalidraw/scene/Renderer.ts` currently skips `editingTextElement` in `getRenderableElementsMap` and `textWysiwyg.tsx` paints `<textarea>` text in a single inline `color:`). **The architecture plan (`plan.md`) must explicitly state which mechanism it chose (e.g., rendering the edited text element on the canvas beneath a transparent-text `<textarea>`, or rendering a synchronized styled layer aligned with the `<textarea>`), explain why that mechanism was chosen, and specify the deterministic hook that jsdom tests will assert against.**
- **FR-10 (Range maintenance during live editor typing):** When the user inserts, replaces, or deletes text in `textWysiwyg.tsx`, the editor shall compute the edit diff between the prior and updated `originalText`, shift/trim the element's styled ranges via `textRanges.ts`, and persist the updated ranges both during live editing and upon editor submission.
- **FR-11 (SVG export with `<tspan>` and highlight shapes):** `packages/excalidraw/renderer/staticSvgScene.ts` shall export text elements with styled ranges by:
  - Emitting background highlight shapes (e.g., `<rect>` elements positioned at the run's x/y coordinates and sized to the run's measured width and line height, with `fill` set to the highlight colour) behind highlighted runs.
  - Emitting `<tspan>` child nodes within each line's `<text>` element with `fill` set to the run's text colour for coloured runs.
  - Preserving the exact legacy SVG `<text>` output structure when a text element has no styled ranges.
- **FR-12 (Restore and legacy compatibility):** `packages/excalidraw/data/restore.ts` (`restoreElementWithProperties` `case "text"`) shall normalize styled ranges when loading scenes: valid ranges are preserved, out-of-bounds or malformed ranges are clamped or dropped, and if no valid ranges exist (including on all legacy scenes), the styled-range property is omitted (`undefined`).
- **FR-13 (Collaboration reconciliation and public API changelog):** `packages/excalidraw/data/reconcile.ts` (together with version increments on range mutations) shall reconcile text elements carrying styled ranges across remote updates. `packages/excalidraw/CHANGELOG.md` shall record the addition of the optional styled-range field on text elements.

### Module: `excalidraw-app`

- **FR-14 (Collaborative editing coverage):** `excalidraw-app/tests/collab.test.tsx` shall test collaborative synchronization and reconciliation of text elements with per-range text colour and highlight across concurrent edits.

---

## Non-functional requirements

- **NFR-1 (Snapshot invariance & backward-compatible serialization):** The styled-range property on `ExcalidrawTextElement` must be optional and omitted (`undefined`) when empty so that legacy scenes and existing text elements serialize identically to before. **No existing entry in any `__snapshots__` file may be modified or deleted.** Snapshot files on the allowlist may only gain new entries for newly added tests; non-allowlisted snapshot files must not change at all.
- **NFR-2 (Strict write-contract adherence):** All file creations and edits must stay strictly within the 39 allowlisted paths from Gate 0. All 25 off-limits patterns—including `.gitignore`, `.env*`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `packages/excalidraw/types/**`, `yarn.lock`, `excalidraw-app/collab/**`, and `dev-docs/**`—must remain unmodified.
- **NFR-3 (Codebase conventions & lint compliance):** Implementation must follow repository engineering rules (`AGENTS.md`, `.github/copilot-instructions.md`): immutable element mutations via `newElementWith` / `mutateElement`, use of `app.ownerDocument` / `app.ownerWindow` instead of global `document` / `window` where `app` context is available, use of `Merge` utility types where appropriate, strict TypeScript typing, and zero ESLint warnings (`yarn test:code`).
- **NFR-4 (Render cache efficiency):** Per-element offscreen canvas caching in `packages/element/src/renderElement.ts` must remain intact; unchanged text elements must reuse their cached canvas without redundant per-frame run layout calculations.
- **NFR-5 (Fixed verification command):** The complete verification suite must pass using the exact command:
  ```bash
  yarn test:typecheck && yarn test:code && yarn test:app --watch=false
  ```
  executed without `--update`.

---

## PII inventory

This feature introduces no personally identifiable information (PII). Styled ranges store only numeric character offsets (`start`, `end`) and CSS colour tokens (`color`, `highlightColor` / background fill) attached to diagram text elements.

| Field | Sensitivity | Protection |
| :--- | :--- | :--- |
| `ExcalidrawTextElement` styled ranges (`start`, `end`, text colour, highlight colour) | None (non-PII styling metadata) | Validated/clamped against `originalText.length` on restore; follows standard scene JSON serialization and end-to-end encrypted collab room transport unchanged. |

---

## Role matrix

Excalidraw is a client-side canvas editor with peer-to-peer / room-based collaboration.

| Role | Resource | Action | Behavior / Permission |
| :--- | :--- | :--- | :--- |
| **Local Editor User** | `ExcalidrawTextElement` (active WYSIWYG selection) | Select substring & apply text colour / highlight | Allowed; updates `[selectionStart, selectionEnd)` range in `originalText` and renders styled runs live while editing. |
| **Local Editor User** | `ExcalidrawTextElement` (no substring selected / element selected) | Apply text colour / highlight | Allowed; applies to the entire text element (preserving existing element-wide colour behavior). |
| **Local Editor User** | `ExcalidrawTextElement` (history stack) | Undo / Redo | Allowed; reverts or reapplies range styling and text edits via element deltas. |
| **Local Editor User** | Scene JSON / SVG Export | Save / Export SVG | Allowed; omits range field when empty in JSON; emits `<tspan>` and highlight shapes in SVG when ranges exist. |
| **Remote Collaborator** | `ExcalidrawTextElement` (remote scene update) | Sync & Reconcile (`reconcileElements`) | Allowed; reconciles incoming element versions carrying styled ranges and renders them on static canvas. |
| **Scene Importer / Viewer** | Legacy or external `.excalidraw` JSON | Load / Restore (`restoreElements`) | Allowed; loads legacy text elements without ranges unchanged (`undefined`) and clamps/drops malformed range entries. |

---

## Acceptance criteria

1. **AC-1 (Range model unit tests):** Running `yarn test:app --watch=false packages/element/tests/textRanges.test.ts packages/element/tests/textElement.test.ts packages/element/tests/textWrapping.test.ts` passes and covers:
   - Range normalization, merging adjacent identical ranges, and splitting overlapping ranges across independent text-colour and highlight channels;
   - Shifting and trimming ranges on character insertion and deletion before, inside, across boundaries of, and after a range;
   - Mapping `originalText` range offsets onto wrapped lines across soft wraps and explicit newlines;
   - Returning `undefined` (omitting the field) when no styled ranges remain.
2. **AC-2 (WYSIWYG range styling & whole-element fallback tests):** Running `yarn test:app --watch=false` on the WYSIWYG editor test suite (`packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`) passes and verifies:
   - Opening the editor on a text element, setting a non-empty selection (`selectionStart < selectionEnd`), and triggering the stroke colour and highlight colour actions stores the expected styled ranges on the element;
   - Triggering colour controls with no selection (`selectionStart === selectionEnd` or when the editor is closed) styles the whole element as before.
3. **AC-3 (Edit-time live canvas display & architectural rationale):**
   - The architecture plan (`plan.md`) states the chosen mechanism for displaying coloured and highlighted runs while the editor is open, explains why it was chosen, and names the jsdom verification hook;
   - A jsdom test in `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` opens the editor, selects a substring, applies a text colour and a highlight while keeping the editor open, and asserts via the plan's named hook that the run is visibly coloured/highlighted during editing (without closing the editor).
4. **AC-4 (SVG export tests):** Running `yarn test:app --watch=false packages/excalidraw/tests/export.test.tsx packages/excalidraw/tests/scene/export.test.ts` passes and asserts that exporting a text element with styled ranges produces `<tspan>` elements with the expected `fill` attribute for coloured runs and background highlight shapes behind highlighted runs, while unstyled text elements export unchanged.
5. **AC-5 (End-to-end durability across edits, layout, undo/redo, and collab):** Automated tests across `packages/element/tests/textElement.test.ts`, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`, `packages/excalidraw/tests/data/reconcile.test.ts`, and `excalidraw-app/tests/collab.test.tsx` pass and verify that styled ranges remain accurate across live text insertions/deletions, line re-wrapping, bound-text container resizing, font family and font size changes, undo/redo operations, and concurrent remote edits.
6. **AC-6 (Backward compatibility & existing snapshot invariance):**
   - `yarn test:app --watch=false packages/excalidraw/tests/data/restore.test.ts` passes, verifying that legacy text elements without ranges restore with the range field omitted (`undefined`) and invalid/out-of-bounds ranges are clamped or dropped;
   - No existing snapshot entry in any `__snapshots__` file is modified or removed (allowlisted snapshot files only gain entries for new tests), and `.gitignore` and all off-limits files have zero diff.
7. **AC-7 (Full verification suite):** Running the exact command `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` exits with status `0` with no `--update` flag.

---

## Open questions for HITL

None. All architectural and scope decisions were confirmed at Gate 0 and are incorporated above as binding requirements.
