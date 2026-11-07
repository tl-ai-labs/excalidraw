# Requirements — feature-extend — Lasso selection respects Wrap/Overlap preference

Run: `20261106-162734-feature-extend-lasso-wrap-overlap` · Intent: feature-extend (delta requirements)
Source: `intent_brief.md` (Gate 0 approved 2026-11-06)

## Current behaviour (delta baseline)

- `getLassoSelectedElementIds` (`packages/excalidraw/lasso/utils.ts`) selects an unlocked element whose AABB
  intersects the lasso's AABB when either:
  - `enclosureTest`: **any** point of **any** of the element's outline segments (`elementsSegments`) lies inside
    the lasso polygon (non-zero rule), or
  - `intersectionTest`: any lasso segment (including the closing segment) intersects the element or its bound
    text (at the bound text's computed position).
- It never reads `appState.boxSelectionMode`, so the lasso always behaves as **Overlap**.
- `LassoTrail.updateSelection` (`packages/excalidraw/lasso/index.ts`) calls it with the live app state's
  `visibleElements`, segments and `simplifyDistance: 5 / zoom`; `selectElementsFromIds` does the
  post-processing (frame-children removal, text → container promotion, groups, shift-keep).

## In scope

1. Add an optional `boxSelectionMode` input to `getLassoSelectedElementIds`, typed as the existing
   `AppState["boxSelectionMode"]` type, defaulting to `"overlap"`.
2. Implement Wrap (`"contain"`) selection: full enclosure, no crossing.
3. `LassoTrail.updateSelection` passes `this.app.state.boxSelectionMode` (read on every update).
4. New tests in `packages/excalidraw/tests/lasso.test.tsx` covering both modes; existing tests unchanged in
   behaviour.
5. One CHANGELOG line under `## Unreleased` in `packages/excalidraw/CHANGELOG.md`.
6. Append `.sdlc/` to `.gitignore` (approved at Gate 0).

## Out of scope

1. Rectangle box selection, `elementsOverlappingBBox`, `packages/element/src/bounds.ts`,
   `packages/element/src/selection.ts`, `App.tsx`.
2. The preference UI, its labels, locales, `appState.ts`, `types.ts`, `restore.ts`, its default value.
3. A separate lasso-only preference or any new public API surface beyond the optional input.
4. Frame-clipping parity with box selection.
5. Lasso performance work beyond what the Wrap check needs.

## Functional requirements

### Module: lasso selection logic (`lasso/utils.ts`)

- **FR-1** `getLassoSelectedElementIds` accepts an optional `boxSelectionMode?: "contain" | "overlap"` (the
  `AppState["boxSelectionMode"]` type). When omitted it behaves as `"overlap"`, so existing callers, including
  the test helper in `lasso.test.tsx`, keep today's results.
- **FR-2** With `"overlap"`, the selection algorithm is today's, unchanged: any outline point enclosed, or any
  lasso-path crossing of the element or its bound text.
- **FR-3** With `"contain"`, an element is selected only when **every** point of **every** one of its outline
  segments lies inside the lasso polygon **and** no lasso segment (including the closing segment) intersects
  the element.
- **FR-4** With `"contain"`, an element with bound text is selected only when, in addition to FR-3 for the
  container, the bound text is also fully enclosed (all of its outline points, at its computed bound position,
  inside the polygon) and not crossed by the lasso path.
- **FR-5** With `"contain"`, an element with no outline segments available is not selected (same as today's
  `enclosureTest` returning false when segments are missing).
- **FR-6** In both modes, locked elements are ignored, the AABB pre-filter still applies, the
  `intersectedElements` / `enclosedElements` sets are cleared at the start of each call, and
  `simplifyDistance` simplification still applies. The returned shape `{ selectedElementIds: string[] }` is
  unchanged.

### Module: lasso trail (`lasso/index.ts`)

- **FR-7** `LassoTrail.updateSelection` passes `boxSelectionMode: this.app.state.boxSelectionMode`, read on
  each call, so a preference change takes effect on the next lasso without reload.
- **FR-8** Post-processing in `selectElementsFromIds` (grouping, frame-children removal, text → container
  promotion, shift keeps previous selection) is unchanged and applies to the result of either mode.

### Module: tests and docs

- **FR-9** `lasso.test.tsx` gains tests that run the lasso with `"contain"` and with `"overlap"` and assert the
  selection (see AC-2 – AC-6). The test helper may take an optional mode argument that defaults to today's
  behaviour; existing test cases are not rewritten.
- **FR-10** `packages/excalidraw/CHANGELOG.md` gets one line under `## Unreleased` stating that lasso selection
  now respects the "Select on: Wrap / Overlap" preference (`appState.boxSelectionMode`).
- **FR-11** `.gitignore` gets a `.sdlc/` line appended; no existing line changes.

## Non-functional requirements

- **NFR-1** TypeScript strict: `yarn test:typecheck` passes with no new `any` or suppression comments.
- **NFR-2** No new dependency; imports only from packages the file already imports from
  (`@excalidraw/math`, `@excalidraw/element`, `@excalidraw/common`, `points-on-curve`) or existing types.
- **NFR-3** Wrap adds at most one extra pass over the element's segment points and the lasso segments per
  candidate element; the lasso polygon may be built once per call rather than per element.
- **NFR-4** Follows the file's existing style (Prettier/ESLint as `yarn fix` would leave it).

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| — | none | The change reads only geometry and an existing UI preference; no user data, storage, or network. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Canvas elements | Lasso-select per the persisted Wrap/Overlap preference (no new permission) |

## Acceptance criteria

- **AC-1** With `boxSelectionMode: "overlap"` (and with the input omitted), every existing test in
  `lasso.test.tsx` passes with identical selections.
- **AC-2** With `"contain"`, an element only partly enclosed by the lasso is not selected, and an element the
  lasso path merely crosses is not selected.
- **AC-3** With `"contain"`, an element fully enclosed by the lasso is selected, including a rotated element and
  a linear element (line/arrow).
- **AC-4** With `"contain"`, a container with bound text is selected only when both the container and its label
  are fully enclosed; a lasso enclosing the container but crossing/not enclosing its label does not select it.
- **AC-5** In both modes, post-processing still applies: grouping, frame-children removal, text → container
  promotion, locked elements ignored, shift keeps the previous selection (at least one test per mode exercising
  a post-processing rule, plus a locked-element case under `"contain"`).
- **AC-6** `LassoTrail` uses the live `appState.boxSelectionMode`: a test that sets the preference via
  `API.setAppState` (or `h.setState`) and draws a lasso with the real tool observes the mode's result, and
  switching it changes the next lasso's result.
- **AC-7** `yarn test:typecheck` passes, and
  `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
  passes.

## Assumptions

- **A-1** "Fully enclosed" is judged on the same outline points the overlap test uses
  (`getElementLineSegments` output); curved outlines are approximated by those points, as today.
- **A-2** For bound text, "fully inside" is judged on the bound text's own outline at its computed bound
  position (as `intersectionTest` positions it), from `elementsSegments` when present or its bounds' corners.
  The architect picks one and states it.
- **A-3** Frame children: when a frame is wrapped, its children are removed by the existing post-processing,
  same as today.

## Open questions for HITL

None blocking. Confirm A-2 at Gate 2 if the architect's choice matters to you.
