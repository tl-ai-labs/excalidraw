## This invocation

mode: brownfield
intent: feature-new
run_id: 20261106-120000-feature-new-drawing-pages
change_plan: .sdlc/runs/20261106-120000-feature-new-drawing-pages/change_plan.md
provenance: .sdlc/runs/20261106-120000-feature-new-drawing-pages/provenance.json
write review to: .sdlc/runs/20261106-120000-feature-new-drawing-pages/review.json
Suite summary (after all packets and two end-of-run fix rounds; baseline before the run: all three passed, 149 files / 2632 tests):
- yarn test:typecheck: FAIL, 1 error (packages/excalidraw/tests/pages.test.tsx(6,10) TS2459 exportToSvg not exported from ../scene/export).
- yarn test:code: FAIL, 2 prettier warnings (pages.test.tsx 195:12, 196:12).
- yarn test:app --watch=false: FAIL, 7 files / 42 tests failed, 2602 passed. Regressions in existing tests: contextmenu (29), dragCreate (5), move (3), multiPointCreate (2), regressionTests (6), selection (5) - element seed/versionNonce snapshot values shifted (PRNG consumed differently on a plain single default page) and 13 "number of renders" snapshots changed; two fix rounds on App.tsx did not find the cause. New pages.test.tsx: 6 of 7 failing as on disk (test calls h.app.* / h.setState outside act(); exportToSvg import). A rejected fix attempt that wrapped calls in act() got 6/7 passing, leaving AC-4 "isolates undo history per page: expected ['rect2'] to deeply equal []" (undo on page 2 does not revert rect2) - likely a real defect in per-page history (history.ts / App.tsx).
- excalidraw-app/tests/pagesCollabAndStorage.test.tsx: passes.
Priority: find the root cause of the single-page PRNG/render-count regression (any file of the change, with file and line) and the per-page undo defect; report each defect as a finding with its file.