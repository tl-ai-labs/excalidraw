# Intent Brief — feature-new — Per-range text colour and highlight

## Context

Seed (user, verbatim): "Let users colour or highlight part of a text element, with the styling saved, collaborated, rendered on canvas and kept in SVG export."

Source brief: `ex-wt/prompts/EX-NF-11/brief.txt` (user-supplied; answers interview questions 2 and 3).

A text element in Excalidraw has a single colour (`strokeColor`) for all of its text, so a user cannot highlight a key word or colour one term in a label. Two of the most up-voted open requests ask for it (excalidraw/excalidraw#1126, 144 votes; #5138, 184 votes). People work around it by splitting text into several elements, which breaks wrapping and alignment.

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker recolours all of it.
After: while editing, selecting "120ms" and choosing red, or a yellow highlight, shows that word alone in red or highlighted, on the canvas and in the exported SVG.

Discovery findings that shape the design (see `discovery.md`, `.sdlc/baseline/stack-profile.md`):
- `ExcalidrawTextElement` (`packages/element/src/types.ts:253`) has no per-range field; `text` is the wrapped form of `originalText`, so ranges must be anchored to `originalText` offsets and mapped onto wrapped lines at render time.
- Canvas text is drawn per line with one `fillStyle` (`renderElement.ts` ~660–717), through `applyDarkModeFilter`, with RTL and center/right alignment handling and an element canvas cache.
- SVG export emits one `<text>` per line with one `fill` (`staticSvgScene.ts` ~780–845).
- The editor (`textWysiwyg.tsx`) is a plain `<textarea>`; it can report `selectionStart`/`selectionEnd` but cannot show per-range colour while editing.
- Collab reconciliation (`reconcile.ts`) is whole-element, newest version wins; ranges travel inside the element, so they stay consistent with the text they belong to.
- Many `__snapshots__/*.snap` files serialize whole elements: the new field must be optional and omitted when empty, so existing snapshots don't churn.
- `AGENTS.md` rules: use `app.ownerDocument`/`ownerWindow` rather than DOM globals; use `Merge<>` from `@excalidraw/common/utility-types` rather than `Omit & ...`.

## Goal

Add a styled-range model to text elements: an optional, ordered list of non-overlapping `{ start, end, color?, highlight? }` runs on `originalText` offsets. Users can apply a text colour or a highlight colour to the current selection while editing. The ranges are:
- **saved:** serialized with the element, and restored from old files with no ranges (field absent → no ranges, element unchanged);
- **collaborated:** carried in the element and synced through normal element reconciliation, so concurrent edits resolve to one consistent text-plus-ranges version;
- **rendered on canvas:** each line drawn as runs with their own fill or highlight rect, matching wrapping, alignment, dark mode and bound-text containers;
- **kept in SVG export:** `<tspan>` per run with the right `fill`, and highlight rects behind the runs.

Ranges must survive text edits (insert and delete shift or trim them), line wrapping, bound-text containers, font family and size changes, and concurrent edits.

## Files in scope

New files:
- `packages/element/src/textRanges.ts`: the range model (normalize, merge, apply a style to `[start, end)`, shift on edit diff, split onto wrapped lines, validate on restore)
- `packages/element/tests/textRanges.test.ts`: unit tests for the range model
- `packages/excalidraw/tests/textRangeStyles.test.tsx`: jsdom tests for the editor, export and restore paths

Edits (element package):
- `packages/element/src/types.ts`: optional range field on `ExcalidrawTextElement`
- `packages/element/src/index.ts`: export the range model
- `packages/element/src/textElement.ts`, `packages/element/src/textWrapping.ts`, `packages/element/src/textMeasurements.ts`: map ranges onto wrapped lines and measure run widths
- `packages/element/src/newElement.ts`: carry ranges through `newTextElement` and `refreshTextDimensions`
- `packages/element/src/renderElement.ts`: per-run canvas drawing and highlight rects
- `packages/element/src/mutateElement.ts` (only if the cache or version bookkeeping needs it)
- `packages/element/tests/textElement.test.ts`, `packages/element/tests/textWrapping.test.ts`

Edits (excalidraw package):
- `packages/excalidraw/data/restore.ts`: restore ranges; legacy files without them
- `packages/excalidraw/data/reconcile.ts` (only if a change is needed; tests go in `packages/excalidraw/tests/data/reconcile.test.ts`)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`: map the textarea selection to `originalText` offsets; shift ranges as the text changes while editing
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
- `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/types.ts`, `packages/excalidraw/actions/index.ts`: apply colour or highlight to the selected range while editing
- `packages/excalidraw/components/Actions.tsx`: show the range colour and highlight controls while a text is being edited
- `packages/excalidraw/renderer/staticSvgScene.ts`: `<tspan>` runs and highlight rects
- `packages/excalidraw/locales/en.json`: new UI strings
- `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/data/reconcile.test.ts`, `packages/excalidraw/tests/export.test.tsx`, `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/CHANGELOG.md`: an "Unreleased" entry (companion file)
- `**/__snapshots__/*.snap` under `packages/`: only where a new test adds a snapshot; existing snapshots should not change

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs detected: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Discovery additions: `.claude/**`, `.cursor/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `yarn.lock`
- `excalidraw-app/**`: the collab app syncs whole elements and needs no change; reconciliation is covered in the library

## Acceptance criteria

1. Unit tests on the range model: insert and delete shifting (before, inside, spanning and after a range), merging adjacent equal runs, splitting onto wrapped lines, and restore of legacy text with no ranges.
2. jsdom tests that open the text editor, select a substring, apply a text colour and a highlight, and assert the element's range data; ranges shift correctly when the text is then edited.
3. SVG export tests asserting `<tspan>` elements with the right `fill` for coloured runs and a highlight rect for highlighted runs; unstyled text exports exactly as before.
4. Ranges survive line wrapping, bound-text containers, font family and size changes, and reconciliation of concurrent edits (tested at the element and data level).
5. Existing snapshots are unchanged: the field is optional and omitted when empty.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals

- Rich styling beyond colour and highlight (bold, italic, underline, per-range font size or family).
- Showing per-range colour inside the editing textarea itself (styling shows on the canvas when editing ends; the editor keeps plain text).
- Character-level CRDT merging of concurrent edits; reconciliation stays whole-element, newest version wins.
- PNG export changes beyond what canvas rendering already gives; changes to `excalidraw-app` collab transport.

## Gate 0 decision

Approved 2026-11-02 as proposed, auth mode `estimated`, policy `opus55-only`. Test command: `yarn test:app --watch=false`, plus `yarn test:typecheck` and `yarn test:code`. The write contract is frozen with the "Files in scope" list as the allowlist (plus `packages/**/__snapshots__/*.snap`) and the "Files off-limits" list. The three scope decisions (plain-text editor while editing, whole-element reconciliation, colour and highlight only) are confirmed. `.gitignore` is unchanged.
