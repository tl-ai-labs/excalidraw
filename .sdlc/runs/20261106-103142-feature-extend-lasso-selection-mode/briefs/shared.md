## Conventions

- Format with Prettier defaults (2-space indent, double quotes, trailing commas, semicolons).
- Follow ESLint import/order: builtin, external, @excalidraw/** (external after), internal, parent, sibling, index, object, type; always leave an empty line between every import statement (newlines-between: always-and-inside-groups).
- Use separate type imports (`import type { ... } from ...`) to satisfy `@typescript-eslint/consistent-type-imports` with zero ESLint warnings.
- Never import from the barrel `packages/excalidraw/index.tsx` inside non-test source files; use direct relative imports such as `import type { BoxSelectionMode } from "../types"`.
- Tests run under Vitest with jsdom and use `render`, `act`, `API`, `Pointer`, `Keyboard`, and `assertSelectedElements` from `packages/excalidraw/tests/test-utils` and `./helpers/*`.

## Decisions

- Mode parameter name and default on getLassoSelectedElementIds: Accept optional `boxSelectionMode?: BoxSelectionMode` on `getLassoSelectedElementIds` input object, defaulting to `"overlap"` when omitted. (not Required `boxSelectionMode` parameter; not Defaulting `boxSelectionMode` to `"contain"` inside `getLassoSelectedElementIds`) — Preserves backward compatibility for existing direct callers in `lasso.test.tsx` while matching `appState.boxSelectionMode` naming when `LassoTrail.updateSelection` passes `this.app.state.boxSelectionMode`.
- Element and bound-text enclosure in contain vs overlap mode: In `"contain"` mode, skip bound-to-container text elements (`isBoundToContainer(element)`) on their own, require non-empty element segments with every segment endpoint inside `lassoPolygon` and zero `lassoSegments` intersecting `element`, and for arrows (`isArrowElement(element)`) with bound text (`getBoundTextElement`) also require the positioned bound text (`computeBoundTextPosition` + `getElementLineSegments`) to have all segment endpoints inside `lassoPolygon` and zero `lassoSegments` intersecting it. (not Bounding-box containment shortcut against `lassoBounds`; not Treating bound-to-container text on non-arrow containers as selectable or required in `"contain"` mode) — Matches `elementsOverlappingBBox` semantics while accurately handling concave lasso polygons across all shapes supported by `getElementLineSegments`.
- Group selection filtering in contain mode: After collecting individually enclosed elements in `"contain"` mode, remove any enclosed element with `element.groupIds.length > 0` unless every non-deleted, unlocked, non-bound-text element in the scene (`elementsMap` and `elements`) whose `groupIds` includes `element.groupIds.at(-1)` is also in `enclosedElements`. (not Checking group membership only against `this.app.visibleElements`; not Allowing locked or bound-text group members to block group selection in `"contain"` mode) — Ensures off-screen or un-enclosed selectable group members block top-level group selection while locked and bound-text elements do not, matching `elementsOverlappingBBox`.

## Files of this change

- `packages/excalidraw/lasso/utils.ts` (U01, edit) — import: `import { getLassoSelectedElementIds } from "./utils";`
  - `function getLassoSelectedElementIds(input: { lassoPath: GlobalPoint[]; elements: readonly ExcalidrawElement[]; elementsMap: ElementsMap; elementsSegments: ElementsSegmentsMap; intersectedElements: Set<ExcalidrawElement["id"]>; enclosedElements: Set<ExcalidrawElement["id"]>; simplifyDistance?: number; boxSelectionMode?: BoxSelectionMode }): { selectedElementIds: string[] }`
- `packages/excalidraw/lasso/index.ts` (U02, edit) — import: `import { LassoTrail } from "./lasso";`
- `packages/excalidraw/tests/lasso.test.tsx` (U03, edit)
- `packages/excalidraw/tests/selection.test.tsx` (U04, edit)
- `packages/excalidraw/CHANGELOG.md` (U05, edit)
