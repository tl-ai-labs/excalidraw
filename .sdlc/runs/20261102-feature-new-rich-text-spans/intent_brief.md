# Intent Brief — feature-new — Coloured and highlighted ranges inside a text element

## Context

A text element in Excalidraw has a single colour for all of its text, so a user cannot highlight a key
word or colour one term in a label. Two of the most up-voted open requests ask for this
(excalidraw/excalidraw#1126, 144 votes; #5138, 184 votes). People work around it by splitting text into
several elements, which breaks wrapping and alignment.

Today `ExcalidrawTextElement` (`packages/element/src/types.ts`) carries one `strokeColor`. Canvas drawing
(`renderElement.ts`) calls `fillText` once per wrapped line with one `fillStyle`. SVG export
(`staticSvgScene.ts`) emits one `<text>` per line. Collaboration reconciles whole elements by
`version`/`versionNonce` (`data/reconcile.ts`), so any new field travels with the element.

Seed description (user's words): "Let users colour or highlight part of a text element, with the styling
saved, collaborated, rendered on canvas and kept in SVG export."

## Goal

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker
recolours all of it.

After: while editing, the user selects "120ms" and chooses red or a yellow highlight. That word alone is
then shown in red, or highlighted, on the canvas and in the exported SVG.

What it needs:

- **packages/element**
  - A styled-range data model on text elements. A new optional field, for example
    `styleRanges: readonly { start, end, strokeColor?, backgroundColor? }[]`, with offsets into
    `originalText`.
  - Wrapping and measurement that keep ranges aligned.
  - Canvas rendering per run.
  - Restore of old files that have no ranges.
  - Undo and redo through the element delta.
- **packages/excalidraw**
  - The text editor maps a DOM selection to character offsets.
  - Colour controls apply to the selected range while editing.
  - SVG export with `<tspan>` per run, plus a highlight rect.
- **Collaboration reconciliation.** Ranges ride on the element version. Concurrent edits resolve
  whole-element, as all other fields do today.

Ranges must survive:

- text edits (insert and delete shift or trim ranges)
- line wrapping
- bound-text containers
- font changes
- concurrent edits

Colours go through `applyDarkModeFilter` on both the canvas and SVG paths.

## Files in scope

**packages/element**

- `packages/element/src/types.ts`: the new field and its type, with a JSDoc.
- `packages/element/src/textStyleRanges.ts` (**new**): range model, normalisation, shift on edit, and mapping
  of ranges onto wrapped lines.
- `packages/element/src/index.ts`: export the new module.
- `packages/element/src/newElement.ts`: default in `newTextElement`, and range handling in
  `refreshTextDimensions`.
- `packages/element/src/textWrapping.ts`: offset mapping from wrapped lines back to original offsets, if needed.
- `packages/element/src/textMeasurements.ts`: offset-preserving normalisation, if needed.
- `packages/element/src/textElement.ts`
- `packages/element/src/renderElement.ts`: per-run `fillText` and highlight `fillRect`.
- `packages/element/src/delta.ts`: undo/redo of the array field.
- `packages/element/src/duplicate.ts`, only if a deep copy is required.

**packages/excalidraw**

- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`: selection to offsets, keep ranges in sync on input.
- `packages/excalidraw/components/App.text.ts`, only if the editor needs to expose the selection.
- `packages/excalidraw/actions/actionProperties.tsx`: the stroke and background colour actions apply to the
  range when a text selection is active.
- `packages/excalidraw/actions/colorTargets.ts`
- `packages/excalidraw/renderer/staticSvgScene.ts`: `<tspan>` and highlight `<rect>`.
- `packages/excalidraw/data/restore.ts`: validate and clamp, default `[]` or undefined for legacy data.
- `packages/excalidraw/data/reconcile.ts`, only if needed. A test is expected even with no code change.
- `packages/excalidraw/locales/en.json`, if any new label is added.
- `packages/excalidraw/CHANGELOG.md`: companion entry for the new element field.

**Tests**

- `packages/element/tests/textStyleRanges.test.ts` (**new**)
- `packages/element/tests/textWrapping.test.ts`
- `packages/element/tests/newElement.test.ts`
- `packages/element/tests/delta.test.ts`
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/data/reconcile.test.ts`
- `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/tests/export.test.tsx`
- `**/__snapshots__/**`: snapshot updates from the new field.

**Optional**

- `.gitignore`: add `.sdlc/` (accepted at Gate 0).

Gate 0 (approved 2026-11-02): policy `opus55-plus-flash38`, auth `estimated`, test commands
`yarn test:typecheck`, `yarn test:code`, `yarn test:app --watch=false`. Contract frozen with this allowlist.

## Files off-limits

**Project defaults**

- `.env`, `.env.*`
- `.mcp.json`
- `.cursor/rules/**`
- `.claude/settings.local.json`
- `node_modules/**`, `dist/**`, `build/**`, `.next/**`
- `.sdlc/**`
- `.git/**`

**AI configs detected**

- `.claude/**`
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`

**Generated or build output**

- `packages/excalidraw/types/**`
- `dev-dist/**`
- `coverage/**`

**Not needed for this feature**

- `excalidraw-app/**`: the collab transport sends whole elements unchanged.
- `.github/workflows/**`
- `Dockerfile`, `docker-compose*`
- `vercel.json`
- `firebase-project/**`
- `examples/**`

## Acceptance criteria

1. Unit tests on the range model cover:
   - shifting on insert and on delete
   - deleting a range entirely
   - merging and normalising overlapping ranges
   - mapping ranges onto wrapped lines, including bound-text containers and a font change that re-wraps
2. Restore tests:
   - a legacy text element with no ranges restores unchanged
   - malformed or out-of-bounds ranges are clamped or dropped
3. Jsdom tests: a test opens the editor, sets a textarea selection over a substring, and applies a stroke
   colour and a background colour. It then asserts that `element.styleRanges` holds the right
   offsets and colours, and that typing before the range shifts it.
4. SVG export tests assert `<tspan>` elements with the correct `fill` for the coloured run, and a highlight
   rect for the background run.
5. A reconcile test shows that a remote element with a higher version brings its ranges with it.
6. Undo and redo of a range colour change restores the previous ranges.
7. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals

- Bold, italic, underline, per-range font size or font family. Colour and highlight only.
- Character-level CRDT merge of concurrent text edits. Last-writer-wins per element stays.
- Rich-text paste from HTML or Markdown.
- Changes to the excalidraw.com collab transport or Firebase storage format beyond the element field.
- PNG export changes beyond what follows from canvas rendering.
