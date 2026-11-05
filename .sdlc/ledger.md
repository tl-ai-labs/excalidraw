# SDLC run ledger

Human-readable history of runs in this project. `ledger.json` is the machine mirror.

| Run | Job | Outcome | Policy / auth | Files | Tests (fixed command) | Spend | Branch |
|---|---|---|---|---|---|---|---|
| [20261105-152345-feature-extend-arrowhead-size](runs/20261105-152345-feature-extend-arrowhead-size/SUMMARY.md) | feature-extend: per-element arrowhead size | accepted 2026-11-05, uncommitted | argon4-agsdk-only / vendor | 29 | pass: 150 files, 2641 passed, 47 skipped, 1 todo | $26.24 (provisional: Gemini $10.56 + session $15.69) | EX-FE-09/argon4-agsdk-only, base 14bb42ede |

Known gaps for 20261105-152345-feature-extend-arrowhead-size: undo/redo back to the default arrowhead size is untested; `provenance.json` has a phantom entry for `packages/excalidraw/tests/__snapshots__/.test.tsx.snap`.
