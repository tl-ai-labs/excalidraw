## This invocation

mode: brownfield
intent: feature-extend
run_id: 20261106-120000-feature-extend-lasso-wrap-overlap
change_plan: .sdlc/runs/20261106-120000-feature-extend-lasso-wrap-overlap/change_plan.md
provenance: .sdlc/runs/20261106-120000-feature-extend-lasso-wrap-overlap/provenance.json
write review to: .sdlc/runs/20261106-120000-feature-extend-lasso-wrap-overlap/review.json
Suite summary (already run, do not re-run):
- yarn test:typecheck: pass (baseline pass)
- yarn test:code (eslint): pass (baseline pass)
- prettier --check on the 5 touched files: pass
- yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx: pass (all tests, including the new Wrap vs Overlap suite)
- yarn test:app --watch=false packages/excalidraw/tests/selection.test.tsx: 3 failed / 46 passed / 1 skipped, all three in the new describe("lasso selection mode") suite and all pointer-driven: "selects a group in contain mode only when all group members are enclosed" (expected 2 selected, got 0, :1558); "frame child extending past the frame edge > contain mode: enclosing the visible part selects the child, not the frame" (expected 1, got 0, :1615); "frame child extending past the frame edge > overlap mode: touching the clipped-out part selects the child" (expected 1, got 0, :1639). Two fix rounds on the test file did not change them. The direct-call equivalents in lasso.test.tsx pass, so judge whether the cause is in the pointer path of the source (LassoTrail.updateSelection / selectElementsFromIds in packages/excalidraw/lasso/index.ts, which use this.app.visibleElements and run on every pointer move, or the contain-mode logic in packages/excalidraw/lasso/utils.ts) or in the tests' setup, and file the finding against the file that must change.
- Full yarn test:app --watch=false before the fix rounds: 4 failed / 1859 passed (the 3 above plus one lasso.test.tsx group assertion since fixed); baseline before the run: 1847 passed, 0 failed.