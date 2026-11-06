# Intent Brief — feature-new — Per-range text colour and highlight

## Context
A text element in Excalidraw has a single colour for all of its text, so a user cannot highlight a key
word or colour one term in a label. Two of the most up-voted open requests ask for it
(excalidraw/excalidraw#1126 with 144 votes, #5138 with 184). People work around it by splitting text into
several elements, which breaks wrapping and alignment.

Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour picker
recolours all of it.
After: while editing, selecting "120ms" and choosing red or a yellow highlight shows that word alone in red
or highlighted on the canvas and in the exported SVG.

Discovery (`.sdlc/runs/20261105-213840-feature-new-rich-text-spans/discovery.md`) found:
- `ExcalidrawTextElement` (`packages/element/src/types.ts` ~L253) has no range field. `text` holds the
  wrapped string and `originalText` holds what the user typed.
- The canvas draws each line in one `strokeColor` (`packages/element/src/renderElement.ts` ~L707) and
  caches the result per element.
- SVG export writes one `<text>` per line (`packages/excalidraw/renderer/staticSvgScene.ts` ~L816).
- The editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`) is a plain `<textarea>`.
- Collaboration (`packages/excalidraw/data/reconcile.ts`) reconciles whole elements by version.

## Goal
What it needs, in the user's words:

- **packages/element:**
  - a styled-range data model on text elements
  - wrapping and measurement that keep ranges aligned
  - canvas rendering per run
  - restore of old files with no ranges
- **packages/excalidraw:**
  - the text editor maps a DOM selection to character offsets
  - colour controls that apply to a range while editing
  - SVG export with tspans
- **Collaboration:** reconciliation.

Ranges must survive:
- text edits
- line wrapping
- bound-text containers
- font changes
- concurrent edits

Each range carries a text colour, a highlight (background) colour, or both. Offsets count against
`originalText`, so re-wrapping never moves them.

## Files in scope
packages/element:
- `packages/element/src/types.ts` (range type and the new optional field on `ExcalidrawTextElement`)
- `packages/element/src/textStyleRanges.ts` (new: range model; shifting on insert and delete; mapping
  ranges onto wrapped lines)
- `packages/element/src/newElement.ts`
- `packages/element/src/textElement.ts`
- `packages/element/src/textWrapping.ts`
- `packages/element/src/textMeasurements.ts`
- `packages/element/src/renderElement.ts`
- `packages/element/src/index.ts` (exports)

packages/excalidraw:
- `packages/excalidraw/data/restore.ts`
- `packages/excalidraw/data/reconcile.ts` (only if the version-based merge needs a change for ranges)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`
- `packages/excalidraw/actions/actionProperties.tsx`
- `packages/excalidraw/actions/actionStyles.ts`
- `packages/excalidraw/actions/colorTargets.ts`
- `packages/excalidraw/renderer/staticSvgScene.ts`
- `packages/excalidraw/appState.ts` and `packages/excalidraw/types.ts` (only if the editor's selection
  has to live in app state)
- `packages/excalidraw/locales/en.json` (new labels; English only)
- `packages/excalidraw/CHANGELOG.md`

Tests:
- `packages/element/tests/textStyleRanges.test.ts` (new)
- `packages/element/tests/textElement.test.ts`
- `packages/element/tests/textWrapping.test.ts`
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
- `packages/excalidraw/actions/actionProperties.test.tsx`
- `packages/excalidraw/tests/export.test.tsx`
- `packages/excalidraw/tests/data/reconcile.test.ts`
- `packages/excalidraw/tests/data/restore.test.ts`
- `packages/excalidraw/tests/textStyleRanges.test.tsx` (new, jsdom editor flow)
- snapshot folders: `**/__snapshots__/**`

## Files off-limits
- Project defaults from `.sdlc/project.json`: `.env*`, `.mcp.json`, `node_modules/**`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `dist/**`, `.sdlc/**`, `.git/**`.
- AI configs: `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`.
- Build output: `**/dist/**`, `build/**`, `**/build/**`, `dev-dist/**`, `coverage/**`.
- Generated files: `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`,
  `packages/excalidraw/subset/woff2/woff2-wasm.ts`.
- Crowdin-managed locales: `packages/excalidraw/locales/*.json` other than `en.json`.
- CI: `.github/workflows/**`.
- `yarn.lock` and all `package.json` files (no new dependency).
- `excalidraw-app/**` (collab syncs elements as they are; no app change expected).

## Acceptance criteria
1. Unit tests on the range model cover:
   - insert and delete shifting
   - wrapping
   - restore of legacy text that has no ranges
2. jsdom tests apply a colour to a selection in the editor and assert the element data.
3. SVG export tests assert `<tspan>` elements with the right fill.
4. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals
- Replacing the `<textarea>` editor with contenteditable or a rich-text editor (no live styled preview
  inside the editor is required).
- Per-range bold, italic, font family or font size.
- Markdown or paste of rich text from other apps.
- Translating the new strings into non-English locales.
- Changes to the collab transport or the excalidraw-app.

## Gate 0 decisions (approved 2026-11-05)
- Policy: opus55-plus-flash38; auth: estimated
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- `.gitignore` `.sdlc/` entry: declined (`.git/info/exclude` covers it in this clone)
- Allowlist and off-limits frozen as proposed above (write contract, 29 allowlist / 28 off-limits patterns)
