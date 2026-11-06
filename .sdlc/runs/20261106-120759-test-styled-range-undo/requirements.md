# Requirements — test — fix the styled-range undo test and its type errors

Run: `20261106-120759-test-styled-range-undo` · intent: `test` · form: coverage target (repair an
existing test file so the full check chain passes; no new coverage).

Source: `intent_brief.md` (same folder). The feature added by run `20261105-213840-feature-new-rich-text-spans`
is correct; the only defects are in `packages/excalidraw/tests/textStyleRanges.test.tsx`.

## In scope
1. Edit `packages/excalidraw/tests/textStyleRanges.test.tsx` only, to fix three defects confirmed in the brief.
2. Keep all eight existing test cases, with their force.

## Out of scope
1. Any source change, including the predecessor feature's files.
2. Any other test file (including `packages/element/tests/textStyleRanges.test.ts`), any changeset.
3. New test cases.
4. Adding `.sdlc/` to `.gitignore` (declined at Gate 0).

## Functional requirements

### Module: textStyleRanges test file
- **FR-1 (committed seed).** In `beforeEach`, the scene is seeded with
  `API.updateScene({ elements: [text], captureUpdate: CaptureUpdateAction.IMMEDIATELY })` as the
  **only** seeding call; the `API.setElements([text])` seed is removed (keeping both does not commit,
  see `packages/excalidraw/tests/history.test.tsx:244`). `CaptureUpdateAction` is imported from
  `@excalidraw/element`, as `tests/history.test.tsx` does.
- **FR-2 (undo depth).** The test `undo restores the previous ranges and redo re-applies them` presses
  undo twice before asserting the range is gone, with a short comment saying why (the first undo
  reverts the selection-only appState entry that `Keyboard.exitTextEditor` pushes on top of the
  `styleRanges` entry; the second reverts the `styleRanges` update).
- **FR-3 (not-deleted guard).** After undo, the same test asserts `getText(text.id).isDeleted` is
  `false`, so the test cannot pass or fail on a deleted element.
- **FR-4 (force kept).** The test keeps its existing `expect` that the range is present before undo
  and its `expect` that redo re-applies the range; the post-undo assertion stays an exact assertion
  that the range is gone (no bound, no tautology, no skip, no deletion). It must still fail if undo
  does not restore the ranges.
- **FR-5 (type errors).** The two `TS2322` errors at the `API.setSelectedElements(...)` call sites
  (lines 29 and 190 at the run's start) are fixed by a local cast of the argument to
  `NonDeletedExcalidrawElement` (imported as a type from the package the repo's tests use), with no
  other change at those sites.

## Non-functional requirements
- **NFR-1.** Smallest change: no edits to the file beyond FR-1..FR-5 (and the imports they need).
- **NFR-2.** Repo conventions: Vitest + jsdom, `tests/helpers/api.ts` and `tests/helpers/ui.ts`;
  formatting as `yarn fix` would leave it (prettier/eslint clean).

## PII inventory
| Field | Sensitivity | Protection |
|---|---|---|
| none | — | Test-only change; no data handled. |

## Role matrix
| Role | Resource | Action |
|---|---|---|
| n/a | test file | Test-only change; no authz surface. |

## Acceptance criteria
- **AC-1.** `yarn test:typecheck` exits 0 with no `error TS` output.
- **AC-2.** `yarn test:app --watch=false packages/excalidraw/tests/textStyleRanges.test.tsx` passes all
  eight tests in the file.
- **AC-3.** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` all pass, with
  2664 of 2664 tests passing (47 skipped, 1 todo).
- **AC-4.** No file is changed other than `packages/excalidraw/tests/textStyleRanges.test.tsx`
  (`git status --porcelain` outside `.sdlc/`).
- **AC-5.** The undo test still asserts the range present before undo, absent (exactly) after two
  undos with `isDeleted === false`, and present again after redo.

## Open questions for HITL
None. The brief fixes every choice (seed call, undo count, cast form).
