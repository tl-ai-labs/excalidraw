# Intent Brief — feature-new — Partial colour and highlight in text elements

Status: approved at Gate 0 (revision 2). Scope below is final and frozen. Auth mode: estimated. Policy: opus55-plus-sonnet55. Test command: `yarn test:app --watch=false`, with `yarn test:typecheck` and `yarn test:code`.

## Context

A text element in Excalidraw has a single colour for all of its text, so a user cannot highlight a key word or colour one term in a label. Two of the most up-voted open requests ask for this (excalidraw/excalidraw#1126 with 144 votes, #5138 with 184). People work around it by splitting text into several elements, which breaks wrapping and alignment.

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker recolours all of it.

After: while editing, selecting "120ms" and choosing red or a yellow highlight shows that word alone in red or highlighted on the canvas and in the exported SVG.

Facts from the code at 14bb42ed that shape the work:

- `originalText` is what the user typed and `text` is derived from it by wrapping (`packages/excalidraw/wysiwyg/textWysiwyg.tsx:263`).
- The editor is a plain `<textarea>` (`textWysiwyg.tsx:533`), which cannot draw coloured runs.
- Canvas draws each line with one `fillText` and one `fillStyle` (`packages/element/src/renderElement.ts:678-712`).
- SVG export writes one `<text>` per line with one `fill` (`packages/excalidraw/renderer/staticSvgScene.ts:815-833`).
- Reconciliation picks one whole element by `version`, then `versionNonce` (`packages/excalidraw/data/reconcile.ts:35-39`). Left as it is, the losing side's ranges are lost, so ranges need their own merge.
- Reconciliation also drops a remote element outright while the local user is editing it (`reconcile.ts:31`).
- Versions cannot tell a concurrent peer from one that is merely behind, so a plain union of ranges would bring cleared ranges back.
- Every collab path goes through `reconcileElements`: live socket and scene init (`excalidraw-app/collab/Collab.tsx:784`), Firebase save (`excalidraw-app/data/firebase.ts:225`) and app load (`excalidraw-app/App.tsx:352`). A merge inside it reaches all of them with no `excalidraw-app` source change.
- `Collab.tsx:782` runs `restoreElements` on remote elements before reconciling, so restore must keep whatever the merge depends on.
- `restore` keeps unknown fields without validating them.

## Goal

Let users colour or highlight part of a text element, with the styling saved, collaborated, rendered on canvas and kept in SVG export.

- `packages/element`: a styled-range data model on text elements, wrapping and measurement that keep ranges aligned, canvas rendering per run, restore of old files with no ranges.
- `packages/excalidraw`: the text editor maps a DOM selection to character offsets, colour controls apply to a range while editing, SVG export uses tspans.
- Collaboration reconciliation merges ranges from both sides of a concurrent edit, so a range is not lost because its element lost the version comparison.
- Ranges survive text edits, line wrapping, bound-text containers, font changes and concurrent edits.

Needs: element data only. No new endpoint, storage backend, background job or retry logic. Save, undo and sync carry the field through the existing element pipeline.

Decisions:

1. Range offsets index `originalText`, never the wrapped `text`.
2. The field is optional and absent on text with no ranges. Unstyled text keeps its existing canvas and SVG output byte for byte, so no existing snapshot changes.
3. `restore` validates ranges: it leaves legacy text alone, and clamps or drops out-of-bounds or malformed ranges.
4. Colouring with a selection applies to the range. Colouring with no selection keeps today's behaviour and changes the base colour, leaving range overrides in place.
5. Concurrent edits: the element's text still resolves to one winner, as it does today, but ranges are merged. `reconcileElements` keeps its signature and runs the merge on both of its outcomes, remote taken and remote discarded, including the mid-edit discard. The merge itself keeps the winner's `version` and `versionNonce`, so it starts no broadcast of its own. The existing `bumpElementVersions` step at `excalidraw-app/collab/Collab.tsx` still bumps a version tie after reconcile and rebroadcasts, so the merge must give the same result when repeated. The change plan sets the range identity and clear-tracking data that lets a stale peer be told from a concurrent one, for approval at Gate 2.
6. The `<textarea>` stays. The change plan states how a styled range shows while editing, for approval at Gate 2.

## Files in scope

Element package:

- `packages/element/src/types.ts`
- `packages/element/src/textStyleRanges.ts` (new; final name set by the plan)
- `packages/element/src/index.ts`
- `packages/element/src/newElement.ts`
- `packages/element/src/transform.ts`
- `packages/element/src/delta.ts`
- `packages/element/src/textElement.ts`
- `packages/element/src/textMeasurements.ts`
- `packages/element/src/textWrapping.ts`
- `packages/element/src/renderElement.ts`
- `packages/element/src/listMarker.ts`
- `packages/element/src/stickyNote.ts`

Editor package:

- `packages/common/src/constants.ts`
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`
- `packages/excalidraw/components/App.text.ts`
- `packages/excalidraw/components/App.clipboard.ts`
- `packages/excalidraw/components/Actions.tsx`
- `packages/excalidraw/actions/actionProperties.tsx`
- `packages/excalidraw/actions/actionStyles.ts`
- `packages/excalidraw/actions/actionBoundText.tsx`
- `packages/excalidraw/actions/actionTextAutoResize.ts`
- `packages/excalidraw/actions/types.ts`
- `packages/excalidraw/css/styles.scss`
- `packages/excalidraw/renderer/staticSvgScene.ts`
- `packages/excalidraw/renderer/staticScene.ts`
- `packages/excalidraw/scene/export.ts`
- `packages/excalidraw/data/restore.ts`
- `packages/excalidraw/data/reconcile.ts`
- `packages/excalidraw/locales/en.json`

Tests:

- `packages/element/tests/textStyleRanges.test.ts` (new)
- `packages/element/tests/textElement.test.ts`
- `packages/element/tests/textWrapping.test.ts`
- `packages/element/tests/delta.test.tsx`
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/data/reconcile.test.ts`
- `packages/excalidraw/tests/export.test.tsx`
- `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/tests/history.test.tsx`
- `packages/excalidraw/tests/helpers/api.ts`
- `excalidraw-app/tests/collab.test.tsx`

Docs:

- `dev-docs/docs/codebase/json-schema.mdx`
- `dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`
- `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx`
- `packages/excalidraw/CHANGELOG.md`

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs: `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Generated output: `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- Existing snapshots: `**/__snapshots__/**`
- Everything not listed in scope, including `excalidraw-app/` source and every locale other than `en.json`

## Acceptance criteria

1. Unit tests on the range model cover insert and delete shifting, wrapping, and restore of legacy text.
2. jsdom tests apply a colour to a selection in the editor and assert element data.
3. SVG export tests assert tspans with the right fill.
4. Reconcile tests on two diverged copies of one text element, from a common start, prove:
   - Different ranges: each client styles a different range, and both ranges end up on both clients.
   - Style against text edit: one client styles a range while the other inserts or deletes text elsewhere, and the range stays on the same characters in the winning text.
   - Text edit inside a range: the range shrinks or grows with its characters.
   - Both edit text: the text resolves to one winner. Losing-side ranges stay on characters that still exist in the winning text, and ranges whose characters are all gone are dropped.
   - Overlap: both clients style the same characters differently, and both end with the same result.
   - Cleared range: a range cleared on one client does not come back from a peer that was merely behind.
   - Order independence: merging local into remote and remote into local gives identical ranges, whichever side wins, and repeating a merge changes nothing.
   - Mid-edit: a remote update that arrives while the local user edits that text does not lose the remote ranges once the edit is committed.
   - Unstyled text: elements with no ranges reconcile exactly as they do today.
5. A test in `excalidraw-app/tests/collab.test.tsx` shows a remote update with ranges reaching the scene through the collab path, and ranges surviving a restore before reconcile.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

## Non-goals

- Merging the characters of two concurrent text edits. The text keeps its one winner; only ranges are merged.
- Merge guarantees for clients on a build without this feature. Ranges they leave misaligned are clamped by `restore`.
- Per-range font family, font size, bold or italic. Only colour and highlight.
- Replacing the `<textarea>` with a rich-text editor.
- Backend, Firebase rules or `excalidraw-app` source changes.
- Translating new strings. Crowdin manages locales from `en.json`.
