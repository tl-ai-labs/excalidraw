## This invocation

mode: brownfield
intent: feature-new
run_id: 20261106-152445-feature-new-pages
Brief: .sdlc/runs/20261106-152445-feature-new-pages/intent_brief.md (Gate 0 approved). Discovery: .sdlc/runs/20261106-152445-feature-new-pages/discovery.md and .sdlc/baseline/stack-profile.md.

Write .sdlc/runs/20261106-152445-feature-new-pages/requirements.md — new-feature requirements (Phase 1, feature-new form) with sections: In scope (numbered, testable); Out of scope (numbered; the brief's non-goals); Functional requirements per module (FR-1, FR-2, ... grouped by packages/element, packages/excalidraw, packages/common, excalidraw-app collab and local storage, docs); Non-functional requirements (NFR-1, ...); PII inventory (table: field, sensitivity, protection; page names are user content shared in collaboration); Role matrix (role x resource x action: local editor, collaborator, older peer without pages); Acceptance criteria (AC-1, AC-2, ... numbered and executable; carry all nine criteria from the brief); Open questions for HITL, including the architect's choice between a page id on every element and separate element arrays per page, and what an older peer without pages sees.

Binding rules set by the user at Gate 0 (state each as an NFR or AC):
1. The test command, word for word: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
2. Snapshots: an existing snapshot may change only by gaining the new page-related fields; no other value in it may change. Never run a blanket `yarn test:update`; update only the snapshot files that need the new fields, one test file at a time with `yarn test:app --watch=false --update <test file>`. Never hand-edit __snapshots__. The final report lists each updated snapshot file and the fields it gained. Under test randomId() is sequential and randomInteger() is seeded, so the default page has a fixed constant id, and mount, restore, legacy-file load and element creation make no new random draws.
3. No .gitignore change; no new file or folder named build, dist, firebase, html, coverage, logs or meta*.json.
Stay within the brief's files in scope and off-limits list. New strings go in packages/excalidraw/locales/en.json only.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261106-152445-feature-new-pages/inputs/intent_brief.md