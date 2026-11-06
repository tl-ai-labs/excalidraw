## This invocation

mode: brownfield. intent: feature-new. run_id: 20261106-152440-feature-new-text-range-styling.
Brief: .sdlc/runs/20261106-152440-feature-new-text-range-styling/intent_brief.md. Repo discovery: .sdlc/runs/20261106-152440-feature-new-text-range-styling/discovery.md (read only the sections you need).
Write .sdlc/runs/20261106-152440-feature-new-text-range-styling/requirements.md as new-feature requirements (Phase 1, feature-new form) with sections: In scope (numbered, testable); Out of scope (numbered); Functional requirements (FR-1, FR-2, ...); Non-functional requirements (NFR-1, ...); PII inventory (table; state none if none); Role matrix (role x resource x action; a single-user editor is fine); Acceptance criteria (AC-1, ..., each executable by a test or a typecheck); Open questions for HITL (only if any remain).

Decisions the user made at Gate 0 — binding, carry them into the requirements as stated, not as open questions:
1. The brief's "After" is binding: while the text editor is still open, selecting a word and applying a colour or highlight must show that run coloured/highlighted on the canvas during editing, not only after leaving the editor. Write this as an FR with its own AC. The mechanism is the architect's choice (context: Renderer.ts currently skips the element being edited in getRenderableElementsMap, and the WYSIWYG textarea paints the text in one inline colour); requirements must not prescribe it but must require that the plan states why it chose its mechanism.
2. Highlight = a background fill behind the selected run. With no selection while editing (or with the element selected but not being edited), the colour/highlight controls recolour the whole element exactly as today.
3. The per-range style field on text elements is optional and omitted when empty, so legacy scenes and existing snapshots serialise unchanged (state as an NFR + AC: existing snapshot entries must not change; snapshot files may only gain entries for new tests).
4. Non-goals and off-limits are as in the brief; no .gitignore change.
5. The verification command is fixed: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (no --update).
Keep the document concise and testable.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261106-152440-feature-new-text-range-styling/inputs/intent_brief.md