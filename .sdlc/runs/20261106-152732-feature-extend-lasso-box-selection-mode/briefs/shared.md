## Conventions

- TypeScript strict mode with explicit types; never use any casts or @ts-ignore in production code.
- Formatting follows @excalidraw/prettier-config (double quotes, trailing commas, 2-space indentation) and @excalidraw/eslint-config.
- Import order: external packages first, then @excalidraw/* workspace packages (value imports before type imports), then relative imports (value imports before type imports), separated by blank lines.
- Tests use Vitest and Testing Library helpers from ./test-utils and ./helpers/api and ./helpers/ui.

## Decisions

- Default value and type of boxSelectionMode in getLassoSelectedElementIds: Accept optional boxSelectionMode?: "contain" | "overlap" defaulting to "overlap" when omitted. (not Defaulting boxSelectionMode to "contain" in getLassoSelectedElementIds; not Importing AppState from ../types) — Defaulting to "overlap" preserves backwards compatibility for existing direct callers of getLassoSelectedElementIds, while literal union "contain" | "overlap" matches AppState["boxSelectionMode"] without importing off-limits ../types.
- Contain vs overlap geometry evaluation in getLassoSelectedElementIds: In "contain" mode, select an element only when enclosureTest returns true (all points of all element segments, and any bound text segments, are inside lassoPolygon via polygonIncludesPointNonZero) and intersectionTest returns false; in "overlap" mode, select when enclosureTest returns true (any segment point inside lassoPolygon) or intersectionTest returns true. (not Checking only element bounding box corners in contain mode; not Skipping intersectionTest in contain mode when segment endpoints are inside the lasso polygon) — A concave lasso or a lasso crossing curved/long edges can include all segment endpoints while still intersecting the element outline; requiring both all segment points inside and zero outline intersections ensures true full enclosure across all shapes.
- Bound text handling in getLassoSelectedElementIds: Skip bound text elements (isBoundToContainer(element) whose containerId is in elementsMap) as standalone candidates, and include a container's bound text segments and bounds in the container's own contain/overlap evaluation. (not Evaluating bound text independently in the element loop during contain mode) — In contain mode, a lasso enclosing only bound text inside a container must not select the container via LassoTrail.selectElementsFromIds; in overlap mode, touching or enclosing bound text selects the container.

## Files of this change

- `packages/excalidraw/lasso/utils.ts` (U01, edit) — import: `import { getLassoSelectedElementIds } from "./utils";`
  - `function getLassoSelectedElementIds(input: { lassoPath: GlobalPoint[]; elements: readonly ExcalidrawElement[]; elementsMap: ElementsMap; elementsSegments: ElementsSegmentsMap; intersectedElements: Set<ExcalidrawElement["id"]>; enclosedElements: Set<ExcalidrawElement["id"]>; simplifyDistance?: number; boxSelectionMode?: "contain" | "overlap"; }): { selectedElementIds: string[]; }`
- `packages/excalidraw/lasso/index.ts` (U02, edit)
- `packages/excalidraw/tests/lasso.test.tsx` (U03, edit)
- `packages/excalidraw/tests/selection.test.tsx` (U04, edit)
- `packages/excalidraw/CHANGELOG.md` (U05, edit)
- `.gitignore` (U06, edit)
