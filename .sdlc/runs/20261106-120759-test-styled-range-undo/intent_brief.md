# Intent Brief — test — fix the styled-range undo test and its type errors

## Context
The feature-new run `20261105-213840-feature-new-rich-text-spans` on this branch added per-range
text styling and wrote `packages/excalidraw/tests/textStyleRanges.test.tsx`. That test file is the
only thing wrong with the branch: the feature itself is correct. Independent verification of the
branch head reports `yarn test:typecheck` exit 2 and the app suite at 2663 passed / 1 failed,
against a clean base of 2632 passed / 0 failed.

Three defects, all inside that one test file, each confirmed by experiment:

1. **The undo test fails.** `undo restores the previous ranges and redo re-applies them` fails with
   `expected true to be false`. `beforeEach` seeds the scene with `API.setElements([text])`, which is
   the `h.elements` setter and calls `scene.replaceAllElements()` with **no capture**, so the store's
   committed snapshot never holds the text. The range pick's capture therefore records the text as an
   *added* element whose inserted side already carries the red `styleRanges`; `Keyboard.undo()` reverts
   that by setting `isDeleted: true`; and the file's own `getText` helper reads
   `h.app.scene.getElement` → `elementsMap`, which **includes deleted elements**. So the red range
   looks like it survived undo.

2. **One undo is not enough.** With a committed baseline, `Keyboard.exitTextEditor` pushes a
   selection-only appState entry on top of the `styleRanges` entry. Dumping the undo stack after the
   pick gives: entry0 = the baseline addition, entry1 = `updated [height, styleRanges, version,
   versionNonce, width]`, entry2 = `appState [selectedElementIds]`. So the first undo reverts the
   selection and the range is still present; the second undo clears it, leaving `styleRanges`
   undefined with `isDeleted` false. The test presses undo once and asserts too early.

3. **Two type errors.** `TS2322` at lines 29 and 190: `API.setSelectedElements` is typed
   `NonDeletedExcalidrawElement[]` and receives an `ExcalidrawTextElement`. These are why
   `yarn test:typecheck` exits 2, so they must be fixed or verification still fails.

Conventions: Vitest with jsdom and the repo's own `tests/helpers/api.ts` and `tests/helpers/ui.ts`,
as in the rest of `packages/excalidraw/tests`. `CaptureUpdateAction` is imported from
`@excalidraw/element`, as `tests/history.test.tsx` does.

## Goal
Make the whole check chain pass without touching any source file.

For defect 1, replace the `API.setElements([text])` seed in `beforeEach` with
`API.updateScene({ elements: [text], captureUpdate: CaptureUpdateAction.IMMEDIATELY })`. It must be
the **only** seeding call: keeping `API.setElements` and adding `updateScene` does **not** work,
because the element is already in the scene and there is nothing to commit — see the comment at
`packages/excalidraw/tests/history.test.tsx:244`. This change has been confirmed to leave the other
seven tests in the file passing.

For defect 2, undo twice before asserting the range is gone, with a short comment saying why, and
also assert `getText(text.id).isDeleted` is `false` after undo so the test cannot pass or fail on a
deleted element.

For defect 3, fix the two call sites only — a local cast to `NonDeletedExcalidrawElement` at lines
29 and 190 is sufficient and is the smallest change.

The test must keep its force: it must still fail if undo does not restore the ranges. Do not weaken
it into a tautology, do not relax the assertion to a bound, and do not delete or skip it. Keep the
existing `expect` on the range being present before undo and on redo re-applying it.

## Files in scope
- `packages/excalidraw/tests/textStyleRanges.test.tsx` (edit; the only file this run may write)

## Files off-limits
Change only that one test file. No source changes, no other test file, and no changeset, because
this is a test-only change.
- Every file this run's predecessor wrote: `packages/element/src/textStyleRanges.ts`,
  `packages/element/src/renderElement.ts`, `packages/element/src/newElement.ts`,
  `packages/element/src/types.ts`, `packages/element/src/textElement.ts`,
  `packages/element/src/index.ts`, `packages/excalidraw/wysiwyg/textWysiwyg.tsx`,
  `packages/excalidraw/actions/actionProperties.tsx`,
  `packages/excalidraw/actions/colorTargets.ts`, `packages/excalidraw/data/restore.ts`,
  `packages/excalidraw/renderer/staticSvgScene.ts`, `packages/excalidraw/locales/en.json`,
  `packages/excalidraw/CHANGELOG.md`
- Every other file under `packages/**`, including all other tests and
  `packages/element/tests/textStyleRanges.test.ts`
- `.changeset/**`
- Project defaults: `.env*`, `.mcp.json`, `node_modules/**`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- Detected AI configs: `.claude/**`, `AGENTS.md`, `.cursor/**`

## Acceptance criteria
`yarn test:typecheck && yarn test:code && yarn test:app --watch=false` all pass, with
**2664 of 2664 tests passing** (47 skipped, 1 todo) and no `error TS` output, and with no file
changed other than `packages/excalidraw/tests/textStyleRanges.test.tsx`.

## Non-goals
- Source changes of any kind, including to the feature this run's predecessor added.
- Changes to any other test file, or a changeset.
- Adding new test cases; the eight existing cases in the file are the right coverage.

## Gate 0 — confirmed scope (approved 2026-11-06)
- Allowlist (frozen): `packages/excalidraw/tests/textStyleRanges.test.tsx`
- Off-limits (frozen): project defaults + detected AI configs (`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/**`) + predecessor's files + `packages/element/tests/textStyleRanges.test.ts` + `.changeset/**`; every other path refused by the strict allowlist.
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (scoped: `yarn test:app --watch=false packages/excalidraw/tests/textStyleRanges.test.tsx`)
- Auth: estimated · Policy: opus55-plus-flash38 · Gates: prompt
- `.gitignore` `.sdlc/` entry: declined (test-only run); noted for the final report.
