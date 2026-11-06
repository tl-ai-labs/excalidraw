## Conventions

- Format code with Prettier (@excalidraw/prettier-config: double quotes, semicolons, 2-space indent, trailing commas).
- Group imports with blank lines between external packages, internal @excalidraw/* workspace packages, relative imports, and type-only imports.
- Use Vitest (describe/it/expect) with ./test-utils (render, act, assertSelectedElements) and window.h harness in packages/excalidraw/tests/*.test.tsx.
- Keep strict TypeScript compliance without any or ts-ignore.

## Decisions

- getLassoSelectedElementIds mode parameter and default: Accept optional boxSelectionMode?: BoxSelectionMode defaulting to "contain" on getLassoSelectedElementIds input, and pass this.app.state.boxSelectionMode from LassoTrail.updateSelection (not Defaulting boxSelectionMode to "overlap" in getLassoSelectedElementIds; not Reading window.h.state directly inside getLassoSelectedElementIds) — Aligns getLassoSelectedElementIds with getElementsWithinSelection (which defaults boxSelectionMode to "contain") while keeping utils.ts pure and testable.
- Full outline containment and frame-child clipping in Wrap ("contain") mode: Require every segment endpoint of the element outline (and its positioned bound text outline if present) to lie inside the closed lasso polygon via polygonIncludesPointNonZero AND require intersectionTest to be false while skipping standalone bound text elements; when an element belongs to an overlapping containing frame (getContainingFrame + elementOverlapsWithFrame), clip its AABB, outline segments, and intersection hits to the frame bounds in "contain" mode while keeping "overlap" mode unclipped (not Testing unclipped outline points of frame children in "contain" mode; not Testing only element AABB corners against the lasso polygon; not Testing only segment points without checking lasso edge intersections) — Matches elementsOverlappingBBox frame-clipping semantics so only the visible portion of a frame child inside its frame must be enclosed in Wrap mode, while preserving exact shape outline containment and leaving Overlap behaviour unchanged.
- Group resolution in Wrap ("contain") vs Overlap ("overlap") mode: In LassoTrail.selectElementsFromIds, when prevState.boxSelectionMode === "contain", group non-deleted selectable (!locked && !isBoundToContainer) scene elements by top-level groupId (element.groupIds.at(-1)) and delete any selected element whose top-level group members are not all present in nextSelectedElementIds before calling selectGroupsForSelectedElements (not Letting selectGroupsForSelectedElements expand partially enclosed groups in contain mode; not Including locked or bound-text elements in top-level group membership counts) — Matches elementsOverlappingBBox "contain" group post-processing so partially enclosed groups are dropped and bound text or locked elements do not prevent group selection.

## Files of this change

- `packages/excalidraw/lasso/utils.ts` (U01, edit) — import: `import { getLassoSelectedElementIds } from "./utils";`
  - `function getLassoSelectedElementIds(input: { lassoPath: GlobalPoint[]; elements: readonly ExcalidrawElement[]; elementsMap: ElementsMap; elementsSegments: ElementsSegmentsMap; intersectedElements: Set<ExcalidrawElement["id"]>; enclosedElements: Set<ExcalidrawElement["id"]>; simplifyDistance?: number; boxSelectionMode?: BoxSelectionMode }): { selectedElementIds: string[] }`
- `packages/excalidraw/lasso/index.ts` (U02, edit) — import: `import { LassoTrail } from "../lasso";`
  - `class LassoTrail(app: App): LassoTrail`
- `packages/excalidraw/tests/lasso.test.tsx` (U03, edit)
- `packages/excalidraw/tests/selection.test.tsx` (U04, edit)
- `packages/excalidraw/CHANGELOG.md` (U05, edit)
