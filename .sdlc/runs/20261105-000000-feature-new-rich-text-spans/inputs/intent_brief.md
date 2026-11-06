# Intent Brief — feature-new — Styled ranges (colour / highlight) inside text elements

## Context

Seed (user's words): "Let users colour or highlight part of a text element, with the styling saved,
collaborated, rendered on canvas and kept in SVG export."

User's problem statement (verbatim):

> Problem: a text element in Excalidraw has a single colour for all of its text, so a user cannot
> highlight a key word or colour one term in a label. Two of the most up-voted open requests
> (excalidraw/excalidraw#1126 with 144 votes, #5138 with 184). People work around it by splitting text
> into several elements, which breaks wrapping and alignment.
>
> Before: a text element such as "Bid request timeout 120ms" is drawn in one colour, and the colour
> picker recolours all of it.
>
> After: while editing, selecting "120ms" and choosing red or a yellow highlight shows that word alone
> in red or highlighted on the canvas and in the exported SVG.
>
> What it needs: packages/element (a styled-range data model on text elements, wrapping and measurement
> that keep ranges aligned, canvas rendering per run, restore of old files with no ranges),
> packages/excalidraw (the text editor maps a DOM selection to character offsets, colour controls that
> apply to a range while editing, SVG export with tspans), and collaboration reconciliation. Ranges must
> survive text edits, line wrapping, bound-text containers, font changes and concurrent edits.

Discovery: `.sdlc/runs/20261105-000000-feature-new-rich-text-spans/discovery.md`. Text is one colour
(`strokeColor`) per element today. The WYSIWYG editor is a plain `<textarea>` that returns plain text.
Canvas draws each line with `fillText`, and SVG writes one `<text>` per line with no `<tspan>`.
Collaboration reconciles whole elements by `version`.

## Goal

Add an optional, persisted list of styled character ranges to text elements. Each range holds
`{ start, end, strokeColor?, backgroundColor? }` as offsets into `originalText`. The ranges:

- are applied from the colour controls to the editor's current selection while editing;
- are kept in line with edits (offsets shift on insert and delete) and with wrapping (mapped from
  `originalText` offsets to the wrapped `text` lines);
- render per run on canvas (a highlight rect behind the run, then the run in its colour);
- export as `<tspan fill=…>` runs (plus highlight `<rect>`s) in SVG, applying the dark-mode filter
  the same way as the element colour;
- restore from legacy files with no ranges (default `[]`), with invalid or out-of-bounds ranges
  normalised;
- travel with the element through collaboration, history/undo, duplicate, clipboard and the
  skeleton transform. Reconciliation stays version-based at element level, since ranges are an
  element property.

Scope decision from the interview: only text colour and highlight colour per range. Font family, size,
bold/italic and alignment stay element-wide, so glyph measurement is unchanged. Font changes keep the
ranges because offsets are character-based.

## Files in scope

New:
- `packages/element/src/textStyleRanges.ts`: range model (normalise, shift on edit by diffing old and
  new text, split or merge on apply, map to wrapped lines, slice a line into runs)
- `packages/element/tests/textStyleRanges.test.ts`
- `packages/excalidraw/tests/textStyleRanges.test.tsx`: jsdom editor and SVG export tests

Edit:
- `packages/element/src/types.ts`: optional range field on `ExcalidrawTextElement`
- `packages/element/src/index.ts`: export the new module
- `packages/element/src/newElement.ts`, `packages/element/src/textElement.ts`,
  `packages/element/src/textWrapping.ts`, `packages/element/src/textMeasurements.ts`
- `packages/element/src/renderElement.ts`
- `packages/element/src/duplicate.ts`, `packages/element/src/transform.ts`,
  `packages/element/src/delta.ts` (only if array props need special diffing)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx`, `packages/excalidraw/components/App.text.ts`,
  `packages/excalidraw/components/App.tsx` (only if wiring is needed)
- `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/actions/colorTargets.ts`
- `packages/excalidraw/renderer/staticSvgScene.ts`
- `packages/excalidraw/data/restore.ts`, `packages/excalidraw/data/reconcile.ts` (only if needed)
- `packages/excalidraw/clipboard.ts`
- `packages/excalidraw/locales/en.json` (new labels, if any)
- Existing tests and snapshots that the new field changes:
  - `packages/element/tests/**`
  - `packages/excalidraw/tests/**` (including `__snapshots__`)
  - `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`
  - `packages/excalidraw/actions/actionProperties.test.tsx`
  - `packages/utils/tests/**`
- Companion docs: `packages/excalidraw/CHANGELOG.md` (an "Unreleased" entry)

## Files off-limits

- Project defaults: `.env*`, `.mcp.json`, `node_modules/**`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `dist/**`, `.sdlc/**`, `.git/**`
- AI configs (default off-limits): `.claude/**`, `CLAUDE.md`, `AGENTS.md`,
  `.github/copilot-instructions.md`
- Build output: `packages/*/{dist,build}/**`, `excalidraw-app/{build,dist,dev-dist}/**`,
  `examples/**`, `dev-docs/**`
- `package.json` files and `yarn.lock`: no new dependencies
- `excalidraw-app/**`: collaboration rides on element-level reconciliation, with no app changes

## Acceptance criteria

1. Unit tests on the range model cover:
   - insert and delete shifting (before, inside and across a range);
   - mapping onto wrapped lines, including a range that spans a wrap boundary;
   - restore of legacy text with no ranges (defaults to `[]`) and of malformed ranges (clamped or
     dropped).
2. jsdom tests open the WYSIWYG editor, select a substring, apply a stroke colour and then a highlight,
   and assert on the element's range data. Also covered: ranges survive further typing, bound-text
   containers, and font family changes.
3. SVG export tests check that the styled substring is emitted as a `<tspan>` with the right `fill`, and
   that a highlight `<rect>` is present.
4. Canvas renders per run, verified through the existing canvas-mock render snapshots or a targeted
   assertion.
5. The run's test command passes, run as one command exactly as written:
   `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`. Snapshots are updated and
   reviewed.

## Non-goals

- Per-range bold, italic, font family, size or underline.
- Rich-text paste from external apps (HTML/RTF to ranges).
- Character-level CRDT merging of concurrent edits within the same element. Concurrent edits resolve by
  the existing element-version reconciliation, and ranges stay valid for whichever version wins.
- Changes to excalidraw-app, the collab server or the file format version number.
- PNG export changes beyond what the canvas renderer gives for free.

## Gate 0 — approved (2026-11-05)

- Test command (run as one command, exactly): `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: `estimated`
- Policy: `argon4-plus-sonnet55`
- `.gitignore`: not modified. `.sdlc/` is still ignored only through `.git/info/exclude`, and the final
  report should remind the user.
- Write contract frozen: Files in scope above (29 allowlist entries). Off-limits are the project
  defaults, the AI configs, `excalidraw-app/**`, `examples/**`, `dev-docs/**`, `**/package.json`,
  `yarn.lock` and `.gitignore`.
