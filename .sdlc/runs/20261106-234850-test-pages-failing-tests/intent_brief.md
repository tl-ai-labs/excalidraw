# Intent Brief — test — Fix the three failing tests in pages.test.tsx

## Context
The feature-new run `20261106-feature-new-drawing-pages` on this branch added pages to a drawing and wrote `packages/excalidraw/tests/pages.test.tsx`. That test file is the only thing wrong with the branch: the feature itself works. Verification of the branch head (`b0fdf640`) gives `yarn test:typecheck` and `yarn test:code` passing, and `yarn test:app --watch=false` at 2665 passed / 3 failed (47 skipped, 1 todo), against a clean base of 2632 passed / 0 failed. All three failures are in this one file, and each defect below was confirmed by experiment.

1. **`keeps undo on its page` (line 313) tests undo with moves that are never recorded.** It nudges `r1` and `r2` with `Keyboard.keyPress(KEYS.ARROW_RIGHT)` (lines 327 and 332). The arrow-key handler in `App.tsx` moves elements with `scene.mutateElement` and never schedules a store capture, at the base commit too, so a nudge is never an undo step of its own: even on a single page, the undo stack is empty after a nudge. The test also seeds with `API.setElements([r1, r2])` (line 324), which goes through the `h.elements` setter with no capture, so the store's snapshot never holds the two rectangles. Confirmed: seeding once with `API.updateScene({ elements: [r1, r2], captureUpdate: CaptureUpdateAction.IMMEDIATELY })` and making each move a captured update (`API.updateScene` with the moved element from `newElementWith(element, { x: 1 })` and `captureUpdate: CaptureUpdateAction.IMMEDIATELY`), the per-page history behaves as AC-3 requires: back on the default page, one undo returns `r1.x` to 0, leaves `r2.x` at 1 and keeps `activePageId` on the default page; on page 2, one undo returns `r2.x` to 0 and keeps `activePageId` on page 2. A mouse drag made with `Pointer` on the selection tool is also recorded per page and undone correctly.

2. **`deletes a page via the menu` (line 172) looks up test ids the component does not have.** `openTabMenu` (line 69) queries `[data-testid='pages-tab-menu-trigger']`, and the test queries `[data-testid='pages-menu-delete']` (lines 175 and 191). The tab bar and the change plan use `pages-menu-trigger` and `page-menu-delete`. Confirmed: with those two ids, clicking the menu trigger and then the delete item leaves one visible page, marks the rectangle `isDeleted: true` and makes the default page active. The first half of the test (the delete item is disabled while only one page exists) was not run in the experiment; keep its assertion.

3. **`finds text on another page and switches to it` (line 356) never focuses a search result.** After `updateTextEditor(searchInput, "pipeline")` (line 375) the search finds the one match on page 2, but typing alone does not focus it, and the page switch happens when a match on another page is focused. Confirmed: pressing Enter in the search input (`fireEvent.keyDown(searchInput, { key: KEYS.ENTER })`, which the search menu handles as "go to next item") switches `activePageId` to page 2.

4. **`lets view mode switch but not edit pages` passes for the wrong reason.** Its assertion at line 402 checks that `[data-testid='pages-tab-menu-trigger']` is absent, which is always true because that id does not exist. The component hides `pages-menu-trigger` in view mode, so the corrected id keeps the test passing while making it test something.

Conventions: Vitest with jsdom and the repo's own `tests/helpers/api.ts`, `tests/helpers/ui.ts` and `tests/test-utils.ts`, as in the rest of `packages/excalidraw/tests`. `CaptureUpdateAction` and `newElementWith` are imported from `@excalidraw/element`, as `tests/history.test.tsx` does.

## Goal
Make the whole check chain pass without touching any source file, by correcting the four defects above in `pages.test.tsx` only.

Every test must keep its force. The undo test must still fail if undo leaves its page or reverts the other page's change: keep all five of its assertions (`r1.x`, `r2.x` and `activePageId` after the undo on the default page; `r2.x` and `activePageId` after the undo on page 2). Do not weaken any assertion into a tautology, relax it to a bound, or delete or skip a test.

## Files in scope
- `packages/excalidraw/tests/pages.test.tsx` (edit; the only file this run may write)

## Files off-limits
Change only that one test file. No source changes, no other test file, no snapshot, and no changeset, because this is a test-only change.
- Every source file the feature run wrote, including `packages/element/src/**`, `packages/excalidraw/components/**`, `packages/excalidraw/actions/**`, `packages/excalidraw/history.ts`, `packages/excalidraw/data/**`, `packages/excalidraw/scene/**` and `excalidraw-app/**`
- Every other test file and every `__snapshots__/**` file
- `.changeset/**`
- Project defaults: `.env*`, `.mcp.json`, `node_modules/**`, `.cursor/rules/**`, `.claude/settings.local.json`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- Detected AI configs: `.claude/**`, `AGENTS.md`, `.cursor/**`

## Acceptance criteria
`yarn test:typecheck && yarn test:code && yarn test:app --watch=false` all pass, with **2668 of 2668 tests passing** (47 skipped, 1 todo), and `git diff` shows changes to `packages/excalidraw/tests/pages.test.tsx` only.

## Non-goals
- Any source change, including making arrow-key nudges record an undo step (pre-existing behaviour at the base commit).
- Tidying parts of pages.test.tsx unrelated to the four defects.
- Snapshot updates (`yarn test:update` is not used).
