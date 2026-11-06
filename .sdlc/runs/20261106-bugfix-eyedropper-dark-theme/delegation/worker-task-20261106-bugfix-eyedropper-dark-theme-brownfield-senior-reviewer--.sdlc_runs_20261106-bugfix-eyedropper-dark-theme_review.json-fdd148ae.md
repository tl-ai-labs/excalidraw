## This invocation

mode: brownfield
intent: bugfix
run_id: 20261106-bugfix-eyedropper-dark-theme
change_plan: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/change_plan.md
provenance: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/provenance.json
write review to: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/review.json
Suite results (already run, do not re-run):
- baseline before run: typecheck pass, test:code pass, test:app 121/121 files pass (1839 tests).
- packages/common/src/colors.test.ts: pass, 62/62.
- packages/excalidraw/tests/eyeDropper.test.tsx: 4/5 pass; 1 fail ("inverts dark-mode canvas pixel when picking color in dark theme", backdrop never appears at line 127).
- yarn test:typecheck: FAIL, 3 x TS2339 in packages/excalidraw/tests/eyeDropper.test.tsx (lines 95, 136, 137).
- yarn test:code: pass.
- yarn test:app: 1 fail / 1845 pass (the same eyeDropper test).
The two eyeDropper.test.tsx defects are already diagnosed and recorded as PR follow-ups by the user's decision (FU-2: test-order dependence on the module-level activeEyeDropperAtom; FU-3: ShapeCache.get(...)?.options needs narrowing to Drawable); the reproducing test is not changed in this run, so do not report them again. Review the source changes (colors.ts, EyeDropper.tsx, App.cursor.ts) and colors.test.ts.