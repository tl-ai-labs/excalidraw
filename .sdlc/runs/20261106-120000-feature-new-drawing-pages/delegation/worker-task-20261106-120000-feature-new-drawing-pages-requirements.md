## This invocation

mode: brownfield. intent: feature-new. run_id: 20261106-120000-feature-new-drawing-pages.
Brief: .sdlc/runs/20261106-120000-feature-new-drawing-pages/intent_brief.md (Gate 0 approved; scope, off-limits and acceptance criteria there are binding).
Repo context (read only what you need): .sdlc/runs/20261106-120000-feature-new-drawing-pages/discovery.md and .sdlc/baseline/stack-profile.md.

Phase 1 rules for feature-new: write new-feature requirements to .sdlc/runs/20261106-120000-feature-new-drawing-pages/requirements.md with sections:
- In scope (numbered, testable)
- Out of scope (numbered; include the brief's non-goals)
- Functional requirements per module (FR-1, FR-2, ...) grouped by packages/element, packages/excalidraw (state, tab bar UI, history, export/serialization, restore, search, i18n), excalidraw-app (collab, local storage)
- Non-functional requirements (NFR-1, ...): backward compatibility of the .excalidraw file format, library never imports excalidraw-app, element edits via newElementWith/mutateElement, new AppState fields wired through type/defaults/storage table/restoreAppState, new import fields optional with defaults in restore.ts, AGENTS.md rules (app.ownerDocument/ownerWindow, Merge<>)
- PII inventory (table: field, sensitivity, protection) — page names are user content
- Role matrix (role x resource x action): local user, collaborator
- Acceptance criteria (AC-1, ...; numbered, executable): jsdom tests that create, switch, rename and delete pages and assert only the active page's elements render and are selectable; undo stays on its page; export of a page contains only its elements; a legacy single-page file restores onto one default page; `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.
- Open questions for HITL. The page-membership representation (page id on every element vs separate per-page element arrays) is an OPEN DESIGN DECISION reserved for the architect (ADR, weighing collab reconciliation, fractional indices, frames, history deltas, file-format backward compatibility): state requirements that hold under either choice; do not decide it here, list it as a design question.
Keep FR and AC ids stable and each AC testable; every FR should be covered by at least one AC.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261106-120000-feature-new-drawing-pages/inputs/intent_brief.md