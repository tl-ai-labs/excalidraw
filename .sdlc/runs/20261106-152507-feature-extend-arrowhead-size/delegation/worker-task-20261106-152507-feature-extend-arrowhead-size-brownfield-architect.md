## This invocation

mode: brownfield
intent: feature-extend
run_id: 20261106-152507-feature-extend-arrowhead-size
requirements: .sdlc/runs/20261106-152507-feature-extend-arrowhead-size/requirements.md (approved at Gate 1)
intent brief: .sdlc/runs/20261106-152507-feature-extend-arrowhead-size/intent_brief.md (its "Gate 0 decisions" section is binding)

Hand over the change spec section by section under .sdlc/runs/20261106-152507-feature-extend-arrowhead-size/change.sections/, each checked with plan-lint --section as you write it. Every FR- and AC- id of requirements.md must be covered by a unit. Put the confirmed test command's parts in project_checks (yarn test:typecheck; yarn test:code; yarn test:app --watch=false).

Note from the user's coordinator, for the test plan only (not a requirement change): a circle head's diameter is size + strokeWidth - 2 (packages/element/src/bounds.ts, getArrowheadPoints, ~L1098). The FR-15/AC-3 check that a head's sideways half-width at scale s equals s times its half-width at scale 1 is exact for circles only at the default strokeWidth of 2, so plan that test at strokeWidth 2.

## The step's input files

Copied into the project for you, in the order given (read each with read_file):
- .sdlc/runs/20261106-152507-feature-extend-arrowhead-size/inputs/intent_brief.md