# Intent Brief — feature-new — Per-range text colour and highlight

## Context

A text element in Excalidraw has one colour (`strokeColor`) for all of its text, so a user cannot
highlight a key word or colour one term in a label. Two of the most up-voted open requests ask for it
(excalidraw/excalidraw#1126, 144 votes; #5138, 184 votes). People work around it by splitting text into
several elements, which breaks wrapping and alignment.

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker
recolours all of it.

After: while editing, selecting "120ms" and choosing red or a yellow highlight shows that word alone in
red or highlighted on the canvas and in the exported SVG.

What discovery found about the current code (`.sdlc/runs/20261106-152440-feature-new-text-range-styling/discovery.md`):

- Type: `packages/element/src/types.ts` (`ExcalidrawTextElement`); factory `newElement.ts`.
- `text` is the wrapped form of `originalText` (`textWrapping.ts`), so character offsets differ between
  the two. Ranges must be stored against `originalText` and mapped onto wrapped lines when drawn.
- Canvas: `packages/element/src/renderElement.ts` draws each line with one `fillText`, inside a
  per-element canvas cache.
- Editor: `packages/excalidraw/wysiwyg/textWysiwyg.tsx` is a plain `<textarea>` that draws the text
  being edited itself, in one colour set inline (`color:` from `strokeColor`). Its
  `selectionStart`/`selectionEnd` give the range to style.
- During editing, the static canvas skips the element being edited
  (`packages/excalidraw/scene/Renderer.ts`, `getRenderableElementsMap`: "it's rendered on remote only").
  So today nothing on the canvas shows the edited text while the editor is open.
- Style actions: `packages/excalidraw/actions/actionProperties.tsx` (stroke colour).
- Restore: `packages/excalidraw/data/restore.ts`. Collab: `packages/excalidraw/data/reconcile.ts`
  reconciles per element by version. History: `packages/element/src/delta.ts`.
- SVG export: `packages/excalidraw/renderer/staticSvgScene.ts` writes one `<text>` per line.
- Many snapshot files serialise whole elements. A field added to every text element would change
  snapshots across the suite.

The answers to the feature-new interview, taken from the user's brief:

1. **What it does:** lets a user colour or highlight a character range of a text element, with the
   styling saved, collaborated, rendered on canvas and kept in SVG export.
2. **What it needs:** a styled-range data model on text elements; wrapping and measurement that keep
   ranges aligned; canvas rendering per run; restore of old files with no ranges; the text editor mapping
   a DOM selection to character offsets; colour controls that apply to a range while editing; SVG export
   with `tspan`s; collaboration reconciliation.
3. **How it is tested:** unit tests on the range model, jsdom editor tests, and SVG export tests, with
   the study's fixed test command passing.

## Goal

A text element can carry styled ranges: a text colour and/or a highlight (background fill) colour over a
character span of its `originalText`. The ranges are:

- shown on the canvas **while the element is still being edited**. Selecting a word in the editor
  and choosing a colour or highlight shows that word coloured or highlighted straight away, without
  leaving the editor. The plan chooses how (e.g. letting the canvas draw the element being edited under a
  transparent-text textarea, or a styled layer kept aligned with the textarea) and states why;
- drawn on canvas run by run when not editing, aligned with wrapped lines;
- written to SVG export as `<tspan>`s with the right `fill`, with a highlight shape behind highlighted
  runs;
- saved in the scene JSON and restored, with files that have no ranges loading unchanged;
- synced to collaborators and reconciled like any other element property;
- kept correct across text edits (insert and delete shift or trim ranges), re-wrapping, bound-text
  containers, font family and size changes, undo/redo, and concurrent edits.

While a text element is being edited, the colour controls (stroke colour, plus a new highlight control)
apply to the textarea's selected range. With no selection, they keep today's behaviour and recolour the
whole element.

The range field is optional and is left off elements that have no ranges, so existing scenes and
existing snapshots serialise exactly as before.

## Files in scope

Confirmed at Gate 0 (approved 2026-11-06) and frozen in `.sdlc/local/write-contract.json`:
39 allowlist entries, 25 off-limits patterns. Run settings: auth mode `vendor`, policy
`argon4-plus-flash38`. Snapshot files not listed below are refused because they are not on the allowlist.

packages/element

- `packages/element/src/types.ts`: optional styled-range field on `ExcalidrawTextElement`
- `packages/element/src/textRanges.ts` (new): range model (normalise, merge, split, shift on
  insert/delete, map `originalText` offsets onto wrapped lines)
- `packages/element/src/newElement.ts`
- `packages/element/src/textElement.ts`: bound-text and container paths
- `packages/element/src/textWrapping.ts`
- `packages/element/src/textMeasurements.ts`
- `packages/element/src/renderElement.ts`: per-run `fillText` and highlight fill, plus a cache key
- `packages/element/src/delta.ts`: undo/redo of range changes
- `packages/element/src/index.ts`: export the new module
- `packages/element/tests/textRanges.test.ts` (new)
- `packages/element/tests/textElement.test.ts`
- `packages/element/tests/textWrapping.test.ts`

packages/excalidraw

- `packages/excalidraw/wysiwyg/**`: the editor (`textWysiwyg.tsx`, selection to offsets, shifting
  ranges as the text changes, the edit-time display), its test, and any new helper the edit-time
  approach needs
- `packages/excalidraw/scene/Renderer.ts`: only if the plan lets the canvas draw the element being
  edited
- `packages/excalidraw/renderer/staticScene.ts` and `packages/excalidraw/renderer/interactiveScene.ts`:
  only if that approach needs them
- `packages/excalidraw/css/styles.scss`: only if the edit-time approach needs a stylesheet rule
- `packages/excalidraw/components/App.text.ts`
- `packages/excalidraw/components/App.tsx`: only if the editor's selection has to reach the actions
  through the app
- `packages/excalidraw/types.ts` and `packages/excalidraw/appState.ts`: only if an app-state field
  carries the editor selection
- `packages/excalidraw/actions/actionProperties.tsx`: range-aware stroke colour and a highlight colour
  control
- `packages/excalidraw/components/icons.tsx`: highlight control icon, if one is needed
- `packages/excalidraw/locales/en.json`: labels for the new control
- `packages/excalidraw/data/restore.ts`: legacy files, and clamping or dropping bad ranges
- `packages/excalidraw/data/reconcile.ts`: only if reconciliation needs a change; tests are in scope
  either way
- `packages/excalidraw/renderer/staticSvgScene.ts`: `<tspan>` per run
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/data/reconcile.test.ts`
- `packages/excalidraw/tests/export.test.tsx`
- `packages/excalidraw/tests/scene/export.test.ts`
- `packages/excalidraw/CHANGELOG.md`: companion; the new element field is public API

excalidraw-app

- `excalidraw-app/tests/collab.test.tsx`: concurrent-edit coverage

Snapshots (gain-only: new entries for new tests; no existing entry may change)

- `packages/excalidraw/tests/__snapshots__/export.test.tsx.snap` (exists)
- `packages/excalidraw/tests/scene/__snapshots__/export.test.ts.snap` (exists)
- `packages/excalidraw/tests/data/__snapshots__/restore.test.ts.snap` (exists)
- `packages/element/tests/__snapshots__/textRanges.test.ts.snap` (new, if the tests use snapshots)
- `packages/excalidraw/tests/data/__snapshots__/reconcile.test.ts.snap` (new, if used)
- `excalidraw-app/tests/__snapshots__/collab.test.tsx.snap` (new, if used)
- the editor test's snapshot file falls under `packages/excalidraw/wysiwyg/**` (new, if used)

Every other snapshot file is outside the allowlist.

## Files off-limits

- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs detected: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- From discovery: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `dev-dist/**`, `coverage/**`,
  `packages/excalidraw/types/**` (generated), `yarn.lock`
- `.gitignore`: no change. `.sdlc/` is already excluded through this worktree's `.git/info/exclude`
- Everything else not on the allowlist, including `excalidraw-app/collab/**` source, `dev-docs/**`
  and every snapshot file not listed above

## Test command

The study's fixed command, word for word:

```
yarn test:typecheck && yarn test:code && yarn test:app --watch=false
```

It runs without `--update`, so a changed existing snapshot fails the run.

## Acceptance criteria

1. Unit tests on the range model: insert and delete shifting (before, inside, across and after a range),
   merge and split, mapping onto wrapped lines, and restore of legacy text with no ranges.
2. jsdom tests that open the editor, select a substring, apply a text colour and a highlight, and assert
   the element's stored ranges.
3. **Edit-time display:** with the editor still open, applying a colour or highlight to a selection makes
   that run visible as coloured or highlighted on the canvas, with no need to leave the editor. A
   jsdom test checks this through a hook the plan names: e.g. the element being edited is in the static
   canvas's renderable map with its ranges and the textarea text is transparent, or the styled layer
   holds a span with the right colour at the right offsets.
4. SVG export tests asserting `<tspan>`s with the right `fill` for coloured runs, and a highlight shape
   behind highlighted runs.
5. Ranges survive text edits, re-wrapping, a bound-text container resize, font family and size changes,
   undo/redo, and a concurrent remote edit (reconcile test).
6. Old scenes with no ranges load and render exactly as before. The range field is omitted when empty.
   **Existing snapshots do not change:** no existing entry in any `__snapshots__` file is modified or
   removed; snapshot files gain entries only for new tests.
7. `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` passes.

## Non-goals

- Other per-range styles: bold, italic, underline, font family or font size per range.
- Rich-text paste (HTML or Markdown colour carried in from the clipboard).
- Element skeleton API (`packages/element/src/transform.ts`) and its `dev-docs` page.
- Copy/paste-styles carrying ranges between elements.
- Changes to the collab transport (`excalidraw-app/collab/**`); collab is covered by the reconcile and
  collab tests only.
- A `.gitignore` change.
