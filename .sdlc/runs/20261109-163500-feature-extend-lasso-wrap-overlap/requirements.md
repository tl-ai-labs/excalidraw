# Requirements — feature-extend — Lasso honours boxSelectionMode (Wrap / Overlap)

Run: `20261109-163500-feature-extend-lasso-wrap-overlap` · Source of truth: `intent_brief.md` (Context, user's verbatim brief).
Delta requirements: only what changes in the lasso; everything else stays as it is.

## In scope

1. `getLassoSelectedElementIds` (`packages/excalidraw/lasso/utils.ts`) takes the selection mode
   (`"contain"` = Wrap, `"overlap"` = Overlap) and selects accordingly.
2. `LassoTrail.updateSelection` (`packages/excalidraw/lasso/index.ts`) passes the current
   `this.app.state.boxSelectionMode` on every selection update.
3. Unit-level tests of the util in `packages/excalidraw/tests/lasso.test.tsx` for both modes.
4. Pointer-driven tests through the lasso tool in `packages/excalidraw/tests/selection.test.tsx` for both modes.

## Out of scope

1. Box (rectangle) selection: `elementsOverlappingBBox`, `getElementsWithinSelection`
   (`packages/element/src/bounds.ts`, `packages/element/src/selection.ts`) — unchanged.
2. Any new preference, lasso-only setting, UI, label, locale or type change (`types.ts`, `appState.ts`,
   `restore.ts`, `App.tsx` are off-limits).
3. Snapshot files (`tests/__snapshots__/**`): never updated; a snapshot diff is a regression.
4. Reading or porting upstream PR excalidraw/excalidraw#11862.
5. CHANGELOG, `.gitignore`.

## Functional requirements — lasso module

- **FR-1 Mode input.** `getLassoSelectedElementIds` accepts a selection mode of type
  `AppState["boxSelectionMode"]` (`"contain" | "overlap"`). The existing call sites keep compiling;
  if the parameter is optional its default must be stated in the change plan (the tests pass it explicitly).
- **FR-2 Overlap mode.** With `"overlap"`, behaviour equals today's lasso: an element is selected when any
  of its outline points lies inside the lasso polygon, or the lasso path crosses its outline, or crosses its
  bound-text label. Existing lasso tests keep their current expectations when run in Overlap mode.
- **FR-3 Wrap mode.** With `"contain"`, an element is selected only when it is fully enclosed by the lasso
  polygon: every point of its outline is inside the polygon **and** the lasso path does not cross its
  outline. A lasso that clips only part of an element (e.g. a rectangle's corner) does not select it.
- **FR-4 Shapes.** FR-2 and FR-3 hold for rectangles, diamonds, ellipses, text, rotated shapes
  (`element.angle` ≠ 0), lines/arrows and freedraw strokes. Outline geometry comes from the existing
  `elementsSegments` / `getElementLineSegments` (which already apply rotation); curved outlines (ellipse,
  rounded corners) must not be judged enclosed when the lasso cuts the curve between sampled points
  (the crossing test of FR-3 guards this).
- **FR-5 Bound text.** An element's bound-text label counts as part of it, mirroring `elementsOverlappingBBox`:
  in Wrap the label must be enclosed too; in Overlap touching the label is enough (today's behaviour).
- **FR-6 Live preference.** The mode is read from `this.app.state.boxSelectionMode` on each
  `updateSelection` call, so changing the preference applies to the next lasso stroke without reload.
- **FR-7 Unchanged rest.** Locked elements stay unselectable; the AABB pre-filter, path simplification,
  group / frame / bound-text post-processing in `LassoTrail` and the returned shape `{ selectedElementIds }`
  stay as they are.

## Non-functional requirements

- **NFR-1** Box-selection behaviour and every existing snapshot are unchanged (no `__snapshots__` diff).
- **NFR-2** No new dependency; reuse `@excalidraw/math` / `@excalidraw/element` helpers already imported.
- **NFR-3** Wrap-mode check cost stays O(points × lasso segments) per candidate element, behind the existing
  AABB pre-filter (a cheap AABB-containment early reject is welcome).
- **NFR-4** TypeScript strict, ESLint `--max-warnings=0`, Prettier formatting as the repo uses.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| — | none | The change reads only canvas geometry and a UI preference; no personal data. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user (any) | Canvas elements | Lasso-select, per their own `boxSelectionMode` preference. No authz surface. |

## Acceptance criteria

- **AC-1** With `boxSelectionMode: "contain"`, a lasso that only clips the corner of a rectangle leaves it
  unselected; the same lasso with `"overlap"` selects it (covered in both test files; the
  `selection.test.tsx` case drives the lasso tool with the pointer).
- **AC-2** A rectangle fully enclosed by the lasso is selected in both modes.
- **AC-3** `lasso.test.tsx` covers both modes across rectangles, ellipses, rotated shapes, lines and freedraw:
  each shape has a partially-touched case (selected only in Overlap) and a fully-enclosed case (selected in both).
- **AC-4** A container whose body is enclosed but whose bound-text label pokes outside the lasso is not
  selected in Wrap and is selected in Overlap.
- **AC-5** Existing lasso tests pass unchanged in expectation under Overlap mode; existing box-selection tests
  pass unchanged; no snapshot file changes.
- **AC-6** `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass (failures that
  already existed before the run are reported separately and are not this run's to fix).

## Assumptions / open questions for HITL

1. **Default change is visible to users (derived).** `boxSelectionMode` defaults to `"contain"`, so a user who
   never touched the preference will see the lasso go from Overlap-like to Wrap behaviour. The brief asks the
   lasso to honour the preference, so this run accepts that. Confirm at Gate 1 if not.
2. **Existing lasso tests.** Their expectations encode today's (Overlap) behaviour; the plan runs them with
   `"overlap"` passed explicitly rather than changing what they expect.
3. **Pre-change test state** is being established on the scoped suites before any edit; pre-existing failures
   are reported separately.
