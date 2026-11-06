# Requirements — test — Fix the failing tests in pages.test.tsx

Run: `20261106-234850-test-pages-failing-tests` · intent: `test` · source: `intent_brief.md`

## Coverage target

`packages/excalidraw/tests/pages.test.tsx` (15 tests in `describe("pages")`) is corrected so every
test in it passes and each one tests what its name says. Pre-run state: `yarn test:app --watch=false`
at 2665 passed / 3 failed (47 skipped, 1 todo); `yarn test:typecheck` and `yarn test:code` pass.
Target: 2668 passed / 0 failed (47 skipped, 1 todo), with no source change.

## In scope

1. Correct the four confirmed defects in `packages/excalidraw/tests/pages.test.tsx` (brief items 1-4).
2. Keep the force of every assertion in the file.

## Out of scope

1. Any source change (including making arrow-key nudges record an undo step).
2. Any other test file, any snapshot, any changeset.
3. Tidying parts of `pages.test.tsx` unrelated to the four defects.
4. `yarn test:update` (would re-bless snapshots).

## Functional requirements (module: `packages/excalidraw/tests/pages.test.tsx`)

- **FR-1 — Undo test records its moves.** `keeps undo on its page` seeds `r1` and `r2` with one
  captured update (`API.updateScene({ elements: [r1, r2], captureUpdate: CaptureUpdateAction.IMMEDIATELY })`)
  instead of `API.setElements`, and makes each move a captured update (`API.updateScene` with the
  moved element from `newElementWith(element, { x: 1 })` and `captureUpdate: CaptureUpdateAction.IMMEDIATELY`)
  instead of `Keyboard.keyPress(KEYS.ARROW_RIGHT)`. All five assertions stay: after one undo on the
  default page `r1.x === 0`, `r2.x === 1`, `activePageId` is the default page; after one undo on
  page 2 `r2.x === 0`, `activePageId` is page 2.
- **FR-2 — Delete-via-menu test uses the component's test ids.** `openTabMenu` queries
  `[data-testid='pages-menu-trigger']` and `deletes a page via the menu` queries
  `[data-testid='page-menu-delete']` (both occurrences). Its assertions stay, including the first
  half (delete item disabled while only one page exists).
- **FR-3 — Cross-page search focuses a match.** `finds text on another page and switches to it`,
  after typing `"pipeline"` into the search input, presses Enter in it
  (`fireEvent.keyDown(searchInput, { key: KEYS.ENTER })`) before asserting that `activePageId`
  switched to page 2. Its assertions stay.
- **FR-4 — View-mode test checks a real id.** `lets view mode switch but not edit pages` asserts the
  absence of `[data-testid='pages-menu-trigger']` (the id the component hides in view mode) instead
  of the nonexistent `pages-tab-menu-trigger`.
- **FR-5 — Imports.** `CaptureUpdateAction` and `newElementWith` are imported from
  `@excalidraw/element`, as `tests/history.test.tsx` does; an import left unused by the change (for
  example `Keyboard` or `KEYS`) is removed only if nothing else in the file uses it, so typecheck
  and lint stay green.

## Non-functional requirements

- **NFR-1 — No weakening.** No assertion is deleted, skipped, turned into a tautology or relaxed to
  a bound; no `it.skip` / `it.todo` / `.only` is introduced.
- **NFR-2 — Repo conventions.** Vitest + jsdom with the repo's own helpers
  (`tests/helpers/api.ts`, `tests/helpers/ui.ts`, `tests/test-utils.ts`); the file passes
  `yarn test:typecheck` and `yarn test:code` (eslint).
- **NFR-3 — Single-file diff.** `git diff` over project files shows `packages/excalidraw/tests/pages.test.tsx` only.

## PII inventory

None. Test fixtures only; no personal data is read or written.

## Role matrix

Not applicable (test-only change; no authz surface).

## Acceptance criteria

- **AC-1** `yarn test:app --watch=false packages/excalidraw/tests/pages.test.tsx` passes all 15 tests.
- **AC-2** `yarn test:typecheck` passes.
- **AC-3** `keeps undo on its page` passes with its five assertions intact (FR-1).
- **AC-4** `deletes a page via the menu` passes using `pages-menu-trigger` and `page-menu-delete`, with its disabled-while-single-page assertion intact (FR-2).
- **AC-5** `finds text on another page and switches to it` passes after the Enter key press (FR-3).
- **AC-6** `lets view mode switch but not edit pages` asserts on `pages-menu-trigger` and passes (FR-4).
- **AC-7** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` all pass with 2668 of 2668 tests passing (47 skipped, 1 todo).
- **AC-8** `git diff` shows changes to `packages/excalidraw/tests/pages.test.tsx` only (NFR-3).

## Open questions for HITL

None. The brief confirms every fix by experiment. Assumption: if the first half of
`deletes a page via the menu` (not exercised in the brief's experiment) fails with the corrected
ids, that is reported at the next gate rather than weakened.
