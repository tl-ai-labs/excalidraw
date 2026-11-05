## This invocation

mode: brownfield. intent: feature-extend. run_id: 20261105-152345-feature-extend-arrowhead-size.
Brief: .sdlc/runs/20261105-152345-feature-extend-arrowhead-size/intent_brief.md (Gate 0 approved; scope frozen in the write contract). Project context: .sdlc/runs/20261105-152345-feature-extend-arrowhead-size/discovery.md and .sdlc/baseline/stack-profile.md (React + TypeScript monorepo; follow its two AGENTS.md rules).

Write .sdlc/runs/20261105-152345-feature-extend-arrowhead-size/requirements.md as DELTA requirements for the feature-extend job (only what changes against the existing code), with sections: In scope (numbered, testable); Out of scope (numbered; take the brief's Non-goals); Functional requirements (FR-1, FR-2, ...); Non-functional requirements (NFR-1, ...); PII inventory (state none if none); Role matrix (state not applicable if none); Acceptance criteria (AC-1, AC-2, ..., numbered, executable); Open questions for HITL (if any).

Constraints confirmed by the user at Gate 0 — each must appear as a requirement or acceptance criterion:
- Never run `yarn test:update`. The only snapshots allowed to change are history.test.tsx.snap, regressionTests.test.tsx.snap and contextmenu.test.tsx.snap in packages/excalidraw/tests/__snapshots__/, updated by vitest `--update` on just their three test files, with a diff that only adds the new current-item key at its default value. Every other snapshot is off-limits.
- An element at the default size carries no size key, whether created or restored; the key is written only when a non-default size is picked.
- New arrows take the last size picked, held in a new current-item app-state field; every path that creates an arrow from the current style reads it: App.tsx, App.drawshape.ts, flowchart.ts, convertToShape.ts and ConvertElementTypePopup.tsx.
- No `.gitignore` change.
- The fixed test command, run word for word: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (baseline: 149 test files; 2632 passed, 47 skipped, 1 todo).
Do not make design decisions the brief leaves to the architect (property name and value type); state them as constraints or open questions. Keep it concise.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261105-152345-feature-extend-arrowhead-size/inputs/intent_brief.md