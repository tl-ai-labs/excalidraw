# Intent Brief — feature-new — Styled ranges (partial colour / highlight) in text elements

## Context
A text element has one colour for all of its text (`strokeColor`), so a user cannot highlight a key word
or colour one term in a label. This covers two highly up-voted open upstream requests
(excalidraw/excalidraw#1126, #5138, as cited by the requester). Users currently work around it by
splitting text into several elements, which breaks wrapping and alignment.

Before: "Bid request timeout 120ms" draws in one colour; the colour picker recolours all of it.
After: while editing, selecting "120ms" and choosing red, or a yellow highlight, shows that word alone
in red or highlighted, both on the canvas and in exported SVG.

Discovery notes (see `discovery.md`, `.sdlc/baseline/stack-profile.md`):
- Text is edited in a plain `<textarea>` (`wysiwyg/textWysiwyg.tsx`); the selection must be mapped to
  character offsets.
- `text` is the wrapped form of `originalText`; range offsets must be defined against one of them
  (architect decides, and documents it) and stay aligned through wrapping.
- Collab reconcile (`data/reconcile.ts`) is whole-element last-writer-wins by `version`; changes must go
  through `mutateElement`/`newElementWith`; nested arrays must be replaced, never mutated in place
  (delta/store compare by reference).

## Goal
Add a styled-range data model to text elements (per-range text colour and background highlight), carried
through: the editor (DOM selection → character offsets, colour/highlight controls applying to the
selected range while editing), measurement/wrapping (ranges stay aligned), canvas rendering (per run),
SVG export (`<tspan>` fills plus highlight rects), restore of legacy files (no ranges → valid default),
copy/paste and undo/redo, and collaboration (ranges travel with the element and reconcile correctly).
Ranges must survive text edits (insert/delete shifting), line wrapping, bound-text containers, font
changes and concurrent edits.

## Files in scope
packages/element:
- `packages/element/src/types.ts` — styled-range type on `ExcalidrawTextElement`
- `packages/element/src/newElement.ts` — default/new field on text creation and refresh
- `packages/element/src/textElement.ts`, `textMeasurements.ts`, `textWrapping.ts` — keep ranges aligned
- `packages/element/src/renderElement.ts` — per-run canvas draw (+ highlight fill)
- `packages/element/src/mutateElement.ts`, `delta.ts` — only if the new field needs handling
- `packages/element/src/index.ts` — export helpers
- NEW `packages/element/src/textStyleRanges.ts` — range model helpers (shift on insert/delete, split, merge, clamp, apply)
- `packages/element/tests/**` — new `textStyleRanges.test.ts`, updates to textElement/textWrapping/newElement/delta tests, snapshots

packages/excalidraw:
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (+ `textWysiwyg.test.tsx`) — selection → offsets, ranges shift on input
- `packages/excalidraw/components/App.text.ts`, `components/App.tsx` — only where the editor is wired
- `packages/excalidraw/actions/actionProperties.tsx`, `actions/colorTargets.ts`, `actions/actionStyles.ts`, `actions/types.ts`, `actions/index.ts`, `actions/register.ts` — colour/highlight applied to a range while editing
- `packages/excalidraw/components/**` — highlight picker in the properties panel, only as needed
- `packages/excalidraw/renderer/staticSvgScene.ts` — `<tspan>` per run, highlight `<rect>`s
- `packages/excalidraw/data/restore.ts` — default and sanitize ranges for legacy and corrupt input
- `packages/excalidraw/data/reconcile.ts` — only if needed for ranges
- `packages/excalidraw/locales/en.json` — new labels
- `packages/excalidraw/CHANGELOG.md` — Unreleased entry
- `packages/excalidraw/tests/**` — restore, reconcile, scene/export, history, actionStyles, clipboard tests and their `__snapshots__`
- `packages/excalidraw/actions/*.test.tsx`, `packages/utils/tests/**` snapshots if affected

excalidraw-app:
- `excalidraw-app/tests/collab.test.tsx` and its snapshots — only if collab coverage needs it (no app source change expected)

## Files off-limits
Project defaults (`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus AI configs `CLAUDE.md`,
`AGENTS.md`, `.claude/**`, plus `yarn.lock`, `package.json` files (no new dependencies),
`packages/excalidraw/types/**` (generated), `dev-dist/**`, `coverage/**`, `.husky/**`.

## Acceptance criteria
1. Unit tests on the range model: insert and delete shift ranges correctly (before, inside, across, after); wrapping keeps ranges aligned to the right characters; legacy text with no ranges restores to a valid element that renders exactly as before.
2. jsdom tests: open the editor, select a substring, apply a colour (and a highlight); assert the element's range data.
3. SVG export tests assert `<tspan>`s with the right `fill` for styled runs (and a highlight rect where set).
4. Ranges survive font change, bound-text containers and concurrent edits (reconcile test).
5. The run's test command passes, exactly: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.

## Run settings (Gate 0)
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: `estimated`
- Policy: `opus55-plus-flash38-agsdk`
- `.gitignore`: not changed. `.sdlc/` is covered by the local `.git/info/exclude`, and the run's evidence is force-added at commit.

## Non-goals
- Bold/italic/size or other per-range typography (colour and highlight only).
- Replacing the textarea with a rich contenteditable editor (no live styled preview while typing beyond what the textarea allows).
- Per-field (CRDT-style) merge of concurrent range edits; element-level last-writer-wins stays.
- Changes to excalidraw-app collab transport or Firebase storage.
- Markdown/markup import syntax.

## Gate 0 outcome
Approved 2026-11-09 (auth mode `estimated`). Write contract frozen: 30 allowlist and 21 off-limits patterns, as listed above.
