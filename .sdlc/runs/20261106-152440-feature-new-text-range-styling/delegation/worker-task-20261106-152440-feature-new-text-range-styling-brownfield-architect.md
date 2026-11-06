## This invocation

mode: brownfield
intent: feature-new
run_id: 20261106-152440-feature-new-text-range-styling
requirements: .sdlc/runs/20261106-152440-feature-new-text-range-styling/requirements.md (approved at Gate 1 as written)
intent_brief: .sdlc/runs/20261106-152440-feature-new-text-range-styling/intent_brief.md

Hand over the change spec in sections under .sdlc/runs/20261106-152440-feature-new-text-range-styling/change.sections/, checking each with plan-lint --section as you write it. Code renders change_plan.md from your spec; you do not write it.

Note on naming: requirements FR-9 and AC-3 refer to "plan.md". In this run that document is change_plan.md, rendered from your spec. Record the live edit-time display mechanism as a decision in the spec, so it appears in change_plan.md. That decision must state:
(a) the mechanism you chose, and why, against the alternatives. Context: packages/excalidraw/scene/Renderer.ts getRenderableElementsMap skips the element being edited, and textWysiwyg.tsx paints the textarea in one inline colour.
(b) the deterministic jsdom hook the textWysiwyg test asserts against.

Binding constraints:
- Write only paths on the frozen allowlist in .sdlc/local/write-contract.json. packages/excalidraw/wysiwyg/** covers textWysiwyg.tsx and its test.
- The range field is optional and omitted when empty.
- Existing snapshot entries must not change; snapshot files may only gain entries for new tests.
- No .gitignore change.
- The project checks are exactly the Gate 0 test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (no --update). Split into separate commands if your header format expects one per entry.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261106-152440-feature-new-text-range-styling/inputs/intent_brief.md