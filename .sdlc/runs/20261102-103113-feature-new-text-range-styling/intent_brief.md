# Intent Brief — feature-new — Coloured and highlighted text ranges

The Context, Goal and Acceptance criteria text under "From the brief" is the person's brief, word for word. Where
anything else in this file or in any earlier proposal differs from it, the brief wins. Sections marked "Run
decisions" and "Run additions" are not part of the brief and must never be read as narrowing it.

## Context

### From the brief

Problem: a text element in Excalidraw has a single colour for all of its text, so a user cannot highlight a key word or colour one term in a label. Two of the most up-voted open requests (excalidraw/excalidraw#1126 with 144 votes, #5138 with 184). People work around it by splitting text into several elements, which breaks wrapping and alignment.

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker recolours all of it.
After: while editing, selecting "120ms" and choosing red or a yellow highlight shows that word alone in red or highlighted on the canvas and in the exported SVG.

### Run additions: what discovery found

- `.sdlc/baseline/stack-profile.md` holds the repo conventions and traps; notes 3 to 13 under "Notes for downstream
  codegen" apply to this job. The architect reads them.
- Baseline at HEAD `14bb42ed`, Node 24.18.0: `yarn test:app --watch=false` passes (149 files, 2,632 tests passed, 47
  skipped, 1 todo); `yarn test:typecheck` and `yarn test:code` pass.
- `reconcileElements` (`packages/excalidraw/data/reconcile.ts`) keeps one whole element by `version`, then lowest
  `versionNonce`, and `shouldDiscardRemoteElement` drops a remote update while the local user edits that element.
  It sees only the local and remote versions, with no common ancestor.

## Goal

### From the brief

What it needs: packages/element (a styled-range data model on text elements, wrapping and measurement that keep ranges aligned, canvas rendering per run, restore of old files with no ranges), packages/excalidraw (the text editor maps a DOM selection to character offsets, colour controls that apply to a range while editing, SVG export with tspans), and collaboration reconciliation. Ranges must survive text edits, line wrapping, bound-text containers, font changes and concurrent edits.

### Run decisions (made from the brief, shown at Gate 0)

- **Editor: keep the `<textarea>` and add a preview layer.** The After line needs the word to show in red while
  editing, which rules out no preview. The textarea's `selectionStart` and `selectionEnd` are the DOM selection the
  brief maps to character offsets, and jsdom can drive them, so nothing in the brief needs a contenteditable rewrite.
  While editing, the preview layer draws the styling, because the canvas hides the element being edited; the canvas
  paints it when editing ends.
- **Testing: unit plus jsdom integration in Vitest, with no browser check.** This is the form the brief's acceptance
  criteria take. The run adds tests for the "must survive" cases those criteria do not name: bound-text containers,
  font changes and concurrent edits. Canvas is asserted by draw calls, because `vitest-canvas-mock` paints no pixels.
- **Concurrent edits.** "Survive" is read as: when a text edit and a range edit race, the ranges of the losing
  version are carried onto the winning text; no client shows stale offsets; all clients converge. A removed range
  must not come back, and with no common ancestor a plain merge would resurrect it, so the design must solve this
  (for example with per-range identity). `reconcileElements` is public API and keeps its signature.
- **Highlight in SVG.** A `<tspan>` carries a text colour through `fill` but cannot carry a background, so a
  highlight exports as a `<rect>` behind the text.

### Gate 0 answers (the person's, as written, approved 2026-11-02)

Gate 0: approved, without reopening Gate 0.

1. Policy flash-agsdk-only-v38, auth vendor, intent feature-new. Accept the stack, the file scope and the off-limits list. Answer no to the .gitignore question.
2. Test command: yarn test:typecheck && yarn test:code && yarn test:app --watch=false. Run its three parts separately, so the later checks still run when an earlier one fails.
3. Concurrent edits: keep your reading of "survive" and do not narrow the brief to last-write-wins.
4. SVG highlights as a rect behind the text are fine.
5. Run constraint: work only from this branch's code and the brief. Do not look at the upstream excalidraw repo, its PRs or issues, upstream/master or master, and do not base anything on them. This binds every phase and every model, the Gemini worker included.

## Files in scope

- `packages/element/src/types.ts`
- `packages/element/src/newElement.ts`
- `packages/element/src/text*.ts` (`textElement`, `textMeasurements`, `textWrapping`, and any new range module)
- `packages/element/src/renderElement.ts`
- `packages/element/src/listMarker.ts`
- `packages/element/src/delta.ts`
- `packages/element/src/index.ts`
- `packages/element/tests/**`
- `packages/excalidraw/wysiwyg/**`
- `packages/excalidraw/components/App.text.ts`
- `packages/excalidraw/components/App.tsx`
- `packages/excalidraw/components/Actions.tsx`
- `packages/excalidraw/components/ColorPicker/ColorPicker.tsx`
- `packages/excalidraw/hooks/useTextEditorFocus.ts`
- `packages/excalidraw/actions/actionProperties.tsx`
- `packages/excalidraw/actions/actionProperties.test.tsx`
- `packages/excalidraw/actions/types.ts`
- `packages/excalidraw/actions/index.ts`
- `packages/excalidraw/renderer/staticSvgScene.ts`
- `packages/excalidraw/data/restore.ts`
- `packages/excalidraw/data/reconcile.ts`
- `packages/excalidraw/appState.ts`
- `packages/excalidraw/types.ts`
- `packages/excalidraw/locales/en.json`
- `packages/excalidraw/CHANGELOG.md`
- `packages/excalidraw/tests/**`

## Files off-limits

Project defaults from `.sdlc/project.json`:

- `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`,
  `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

Detected AI config:

- `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

Generated and build output:

- `dev-dist/**`, `coverage/**`, `html/**`, `packages/excalidraw/types/**`,
  `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`

Everything else is out of scope by not being listed, including `excalidraw-app/**` and every locale file except
`packages/excalidraw/locales/en.json` (Crowdin owns the rest).

## Acceptance criteria

### From the brief

Acceptance criteria: unit tests on the range model (insert and delete shifting, wrapping, restore of legacy text); jsdom tests that apply a colour to a selection in the editor and assert element data; SVG export tests asserting tspans with the right fill; yarn test:typecheck, yarn test:code and yarn test:app pass.

### Run additions

- Tests cover ranges surviving bound-text containers, font changes and concurrent edits.
- Canvas rendering per run is covered by draw-call assertions.
- Text elements with no ranges render and export as they do today, so no existing snapshot changes.
- `yarn test:app` is verified as `yarn test:app --watch=false`, since it otherwise stays in watch mode on a terminal.
  Verification never uses `yarn test:update`, which would rewrite snapshots and hide a regression.

## Non-goals

Run additions, none of which is in the brief. Each is out of scope because the brief does not ask for it, and the
brief wins over any of them.

- Per-range bold, italic, size or font family. A range carries a colour and a highlight only; the brief's "font
  changes" means changing the element's font, which ranges must survive.
- Replacing the `<textarea>` with a rich editor.
- Carrying styled ranges through the clipboard or copy-and-paste styles.
- Creating ranges through `convertToExcalidrawElements` (the element skeleton API).
