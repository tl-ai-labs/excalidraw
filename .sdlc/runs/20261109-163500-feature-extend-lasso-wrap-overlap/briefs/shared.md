## Conventions

- TypeScript strict; no `any`, no non-null assertions on values that can legitimately be missing; arrow-function `const` declarations as in lasso/utils.ts.
- Formatting is Prettier through eslint-plugin-prettier (80 columns, double quotes, trailing commas, 2-space indent, semicolons); `curly` is enforced, so every if-body has braces.
- Import order (eslint import/order): external packages, then `@excalidraw/**` packages, then parent (`../`), then sibling (`./`), then type-only imports last; a blank line between groups; type-only imports use separate `import type { ... }` statements.
- Reuse only helpers already exported by `@excalidraw/math` and `@excalidraw/element`; no new dependency and no new file.
- `"contain"` is the Wrap mode and `"overlap"` is the Overlap mode of `AppState["boxSelectionMode"]`; never introduce another name or setting for them.
- Never edit or import-for-edit the off-limits files (App.tsx, appState.ts, types.ts, restore.ts, packages/element/src/**); importing a type from `../types` is allowed.
- Tests run on vitest with jsdom and globals (`describe`, `it`, `expect`, `beforeEach`); use `window.h`, the `API` helper (`./helpers/api`), the `Pointer` helper and `assertSelectedElements` as the surrounding file does.
- Tests never add, update or rely on a snapshot (`toMatchSnapshot` is forbidden in new cases); no `__snapshots__` file may change.
- No user-facing text, locale key or UI change.

## Decisions

- Mode parameter of getLassoSelectedElementIds: A required field `boxSelectionMode: AppState["boxSelectionMode"]` on the existing input object; both callers (lasso/index.ts and tests/lasso.test.tsx) pass it explicitly. (not optional field defaulting to "contain"; not optional field defaulting to "overlap"; not a second positional argument) — Only two callers exist and both change in this run; a required field makes the compiler catch any caller that forgets the mode.
- Overlap ("overlap") algorithm: Exactly today's code path: AABB pre-filter with doBoundsIntersect, then enclosureTest (any outline point inside) else intersectionTest (lasso crosses outline or bound-text label). (not rewriting Overlap on top of the new containment helper) — FR-2 and AC-5 require today's behaviour bit for bit, and existing lasso tests pin it.
- Wrap ("contain") algorithm: An element is enclosed when (1) its getElementBounds AABB is inside the lasso AABB (boundsContainBounds, cheap early reject), (2) every point of every segment in elementsSegments.get(id) is inside the lasso polygon (polygonIncludesPointNonZero), (3) every outline point of its positioned bound-text label is inside too, and (4) intersectionTest(path, element, elementsMap) is false (no lasso edge crosses the outline or the label). (not centroid-inside test; not full polygon-polygon clipping; not AABB-only containment as box selection does) — Sampled-point containment plus the crossing test is exact for straight outlines and catches a lasso that cuts a curve between samples (FR-4), stays O(points x lasso segments) (NFR-3) and reuses existing helpers (NFR-2).
- Bound-text elements in Wrap mode: In "contain" mode an element for which isBoundToContainer(element) is true is skipped; its label is judged only as part of its container. In "overlap" mode bound text is evaluated as today. (not evaluating the label on its own in Wrap; not skipping bound text in both modes) — Mirrors box selection (shouldIgnoreElementFromSelection ignores bound text) so a label poking outside the lasso cannot select its container through the text-to-container mapping in LassoTrail; Overlap must stay unchanged (FR-7).
- Where the live mode is read: LassoTrail.updateSelection passes `this.app.state.boxSelectionMode` on every call; nothing is cached on the LassoTrail instance. (not caching the mode in startPath; not a constructor option) — FR-6: a preference change applies to the next stroke without reload.
- Mode selection in the util-level tests: tests/lasso.test.tsx `updatePath` takes a required third argument `mode: AppState["boxSelectionMode"]`, sets `h.setState({ boxSelectionMode: mode })` before drawing so the LassoTrail's own selection agrees, and passes the same mode to getLassoSelectedElementIds; every existing call passes "overlap". (not a default of "overlap" on updatePath; not duplicating updatePath per mode) — Assumption 2 of requirements: existing tests keep their expectations and run with "overlap" passed explicitly.
- Mode selection in the pointer-driven tests: tests/selection.test.tsx renders `<Excalidraw />` and sets the mode with `API.setAppState({ boxSelectionMode })` before each stroke; the lasso is drawn with the existing `mouse` Pointer (downAt, moveTo, up) after `h.app.setActiveTool({ type: "lasso" })` inside act. (not initialData appState per describe; not calling the util directly) — The brief asks for tests through the lasso tool; setAppState lets one test switch the mode between strokes (FR-6).

## Files of this change

- `packages/excalidraw/lasso/utils.ts` (U01, edit) — import: `import { getLassoSelectedElementIds } from "./utils";`
  - `function getLassoSelectedElementIds(input: { lassoPath: GlobalPoint[]; elements: readonly ExcalidrawElement[]; elementsMap: ElementsMap; elementsSegments: ElementsSegmentsMap; intersectedElements: Set<ExcalidrawElement["id"]>; enclosedElements: Set<ExcalidrawElement["id"]>; simplifyDistance?: number; boxSelectionMode: AppState["boxSelectionMode"] }): { selectedElementIds: string[] }`
- `packages/excalidraw/lasso/index.ts` (U02, edit)
- `packages/excalidraw/tests/lasso.test.tsx` (U03, edit)
- `packages/excalidraw/tests/selection.test.tsx` (U04, edit)
