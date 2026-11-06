## This invocation

mode: brownfield
intent: bugfix
run_id: 20261106-bugfix-eyedropper-dark-theme
change_plan: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/change_plan.md
provenance: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/provenance.json
write review to: .sdlc/runs/20261106-bugfix-eyedropper-dark-theme/security_review.md
Suite results (already run, do not re-run):
- baseline before run: typecheck pass, test:code pass, test:app 121/121 files pass.
- yarn test:typecheck: FAIL, 3 x TS2339 in packages/excalidraw/tests/eyeDropper.test.tsx (lines 95, 136, 137) — recorded follow-up FU-3.
- yarn test:code: pass.
- yarn test:app: 1 fail / 1845 pass ("inverts dark-mode canvas pixel when picking color in dark theme", test-order dependence — recorded follow-up FU-2).
- packages/common/src/colors.test.ts: 62/62 pass.
- senior review: approved, no findings.