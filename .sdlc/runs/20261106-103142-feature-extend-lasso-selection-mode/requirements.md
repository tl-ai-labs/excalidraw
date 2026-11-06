# Delta Requirements — Lasso Honours Box Selection Mode (`boxSelectionMode`)

## Context & Delta Summary

Box selection in Excalidraw supports two selection modes controlled by `appState.boxSelectionMode` (`BoxSelectionMode = "contain" | "overlap"`, defined in `packages/excalidraw/types.ts:280`, defaulting to `"contain"` in `packages/excalidraw/appState.ts`, and surfaced in Preferences as **Wrap** and **Overlap**). Currently, the lasso tool (`packages/excalidraw/lasso/index.ts`, `LassoTrail`; `packages/excalidraw/lasso/utils.ts`, `getLassoSelectedElementIds`) ignores `appState.boxSelectionMode` and always behaves like Overlap mode: it selects any element whose outline or bound text is crossed by a lasso segment (`intersectionTest`) or that has at least one outline segment point inside the lasso polygon (`enclosureTest`).

This delta extends the lasso tool so that it honours `appState.boxSelectionMode` across both `"contain"` (Wrap) and `"overlap"` (Overlap) modes, matching box selection's `elementsOverlappingBBox` semantics for element outlines, concave polygon containment, bound-text labels, frames, and groups.

---

## In scope

1. Extend `getLassoSelectedElementIds` in `packages/excalidraw/lasso/utils.ts` with an optional mode input (`BoxSelectionMode = "contain" | "overlap"`) that defaults to `"overlap"` when omitted so existing direct callers (`packages/excalidraw/tests/lasso.test.tsx`) keep their current semantics.
2. Implement `"contain"` (Wrap) mode in `packages/excalidraw/lasso/utils.ts` so that an element is selected only when the lasso polygon fully encloses its entire outline (every point of its line segments in `elementsSegments` lies inside the lasso polygon AND no lasso segment crosses the element's outline).
3. Enforce arrow-label containment and bound-text handling in `"contain"` (Wrap) mode in `packages/excalidraw/lasso/utils.ts` to match `elementsOverlappingBBox`: when an arrow element (`isArrowElement(element)`) has a bound text element (`getBoundTextElement(element, elementsMap)`), its bound label at its computed position (`computeBoundTextPosition`) must also be fully enclosed by the lasso polygon and not crossed by the lasso path; a bound-to-container text element never counts on its own in Wrap mode and never selects its container (the container is selected only when its own outline is fully enclosed).
4. Preserve `"overlap"` (Overlap) mode in `packages/excalidraw/lasso/utils.ts` so that an element is selected whenever the lasso crosses its outline or bound text, or encloses it wholly or partly (existing behaviour, including text-to-container resolution).
5. Implement group selection semantics matching `elementsOverlappingBBox` in `packages/element/src/bounds.ts`:
   - In `"contain"` (Wrap) mode, a grouped element is selected only when every selectable member of its top-level group (`groupIds.at(-1)`) across the whole scene (all non-deleted elements, not only `this.app.visibleElements`) is fully enclosed by the lasso (locked elements and bound text elements do not count toward group membership; a member off-screen or outside the lasso blocks the group).
   - In `"overlap"` (Overlap) mode, touching any single selectable member selects the whole group (existing behaviour).
6. Update `LassoTrail.updateSelection` in `packages/excalidraw/lasso/index.ts` to pass `this.app.state.boxSelectionMode` into the lasso selection calculation so interactive lasso usage follows the user's preference, including the `"contain"` (Wrap) default.
7. Add jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` covering both `"contain"` and `"overlap"` modes across shape types (rectangle, diamond, ellipse, rotated shape, line/arrow, freedraw), concave lasso partial containment, bound arrow labels, bound container labels (a lasso enclosing only a rectangle's label selects nothing in Wrap mode), frames, and groups.
8. Add pointer-driven end-to-end lasso tests in `packages/excalidraw/tests/selection.test.tsx` for both `"contain"` and `"overlap"` modes using `initialData={{ appState: { boxSelectionMode: ... } }}`, and pin the existing `describe("lasso reselection")` block (around line 154) to `initialData={{ appState: { boxSelectionMode: "overlap" } }}` per Gate 0 decision (option a).
9. Add a single-line entry under `## Unreleased` in `packages/excalidraw/CHANGELOG.md` noting that the lasso tool now follows the "Select on" (`boxSelectionMode`) preference, requiring elements to be fully enclosed in the default Wrap mode.

---

## Out of scope

1. Any changes to box selection, its algorithms, or any file under `packages/element/**` (including `packages/element/src/bounds.ts` and `packages/element/src/selection.ts`) or `packages/excalidraw/components/App.tsx`.
2. Adding new preferences, state properties, UI toggles, or locale strings (`packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts`, and `packages/excalidraw/locales/**` are read-only and off-limits).
3. Changing how the lasso trail is drawn, simplified (`simplify`), styled, or animated in `LassoTrail` or `AnimatedTrail`.
4. Custom group semantics specific to the lasso that diverge from `elementsOverlappingBBox`.
5. Any changes to `.gitignore` (`.sdlc/` is excluded locally via `.git/info/exclude`).
6. Modifying any existing test in `packages/excalidraw/tests/selection.test.tsx` other than pinning `describe("lasso reselection")` to `boxSelectionMode: "overlap"`, or modifying any existing snapshot in `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`.
7. Performance re-architecture beyond keeping the existing axis-aligned bounding box (`doBoundsIntersect`) pre-filter.
8. Modifying any generated or build output (`packages/excalidraw/types/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/subset/**`).

---

## Functional requirements per module

### Module: `packages/excalidraw/lasso/utils.ts`

- **FR-1 (Mode input with backward-compatible default)**: `getLassoSelectedElementIds` SHALL accept an optional selection mode property (`BoxSelectionMode`, `"contain" | "overlap"`) in its input object. When omitted, the mode SHALL default to `"overlap"` so existing direct callers continue to observe Overlap semantics.
- **FR-2 (Overlap mode selection behaviour)**: When the mode is `"overlap"` (or omitted), `getLassoSelectedElementIds` SHALL select every unlocked element whose bounds intersect `lassoBounds` (`doBoundsIntersect`) and that either:
  1. Has at least one segment endpoint inside the lasso polygon (`enclosureTest` using `polygonIncludesPointNonZero`), OR
  2. Has its outline or its bound text intersected by at least one segment of the closed lasso path (`intersectionTest` using `intersectElementWithLineSegment`).
- **FR-3 (Contain / Wrap mode element enclosure)**: When the mode is `"contain"`, `getLassoSelectedElementIds` SHALL consider an unlocked element enclosed if and only if:
  1. The element has non-empty line segments in `elementsSegments` and *every* endpoint of *every* segment of the element is inside the lasso polygon (`polygonIncludesPointNonZero(point, lassoPolygon)`), AND
  2. No segment of the closed lasso path intersects the element's outline (`intersectElementWithLineSegment(element, elementsMap, lassoSegment, 0, true).length === 0`).
  Elements that are only intersected or only partially inside the lasso polygon SHALL NOT be added to `intersectedElements` or `enclosedElements` in `"contain"` mode.
- **FR-4 (Contain / Wrap mode arrow label enclosure)**: In `"contain"` (Wrap) mode, the label-enclosure rule SHALL apply to arrow labels only (`isArrowElement(element)`), matching `elementsOverlappingBBox`: when an arrow element has a bound text element (`getBoundTextElement(element, elementsMap)`), the arrow SHALL be considered enclosed only if its positioned bound text (`{ ...boundTextElement, ...computeBoundTextPosition(element, boundTextElement, elementsMap) }`) is also completely enclosed by the lasso polygon (all points of the positioned bound text's segments lie inside the lasso polygon and no lasso segment intersects the positioned bound text). Bound-to-container text elements (`isBoundToContainer(element)` / `containerId != null`) SHALL be ignored on their own in `"contain"` mode and SHALL NOT require or trigger container selection for non-arrow containers.
- **FR-5 (Concave polygon accuracy across all element shapes)**: In `"contain"` mode, containment versus intersection SHALL be evaluated against the actual lasso polygon and element line segments (not via a bounding-box containment shortcut) for all shapes supported by `getElementLineSegments`: rectangles, diamonds, ellipses, rotated shapes, linear elements (lines and arrows), and freedraw strokes.

### Module: `packages/excalidraw/lasso/index.ts` (and `packages/excalidraw/lasso/utils.ts`)

- **FR-6 (Wiring `appState.boxSelectionMode` in `LassoTrail`)**: `LassoTrail.updateSelection` in `packages/excalidraw/lasso/index.ts` SHALL pass `this.app.state.boxSelectionMode` to `getLassoSelectedElementIds` so that interactive lasso selection follows the active user preference, including the `"contain"` (Wrap) default.
- **FR-7 (Group selection semantics in Wrap and Overlap modes)**: Group handling for lasso selection SHALL match `elementsOverlappingBBox` (`packages/element/src/bounds.ts`):
  - In `"contain"` (Wrap) mode, an element that belongs to one or more groups (`element.groupIds.length > 0`) SHALL be selected only when *every* selectable member of its top-level group (`element.groupIds.at(-1)`) in the whole scene (all non-deleted elements in `elementsMap` / `this.app.scene.getNonDeletedElements()`, not only `this.app.visibleElements`) is enclosed by the lasso; a group member that is off-screen or outside the lasso blocks the group from being selected. Locked elements (`el.locked === true`) and bound text elements (`isBoundToContainer(el)` / `isTextElement(el) && el.containerId != null`) SHALL NOT be counted as selectable group members that could block group selection.
  - In `"overlap"` (Overlap) mode, selecting any single member of a group SHALL select all members of its group via `selectGroupsForSelectedElements` (existing behaviour).
- **FR-8 (Handling of bound text and existing lasso special cases by mode)**: `LassoTrail` and `getLassoSelectedElementIds` SHALL handle bound-to-container text and special cases as follows:
  - **Bound-to-container text**: In `"contain"` (Wrap) mode, a bound-to-container text element (`containerId != null`) never counts on its own and never selects its container — the container is selected only when its own outline is fully enclosed by the lasso (matching box selection, which ignores bound text). In `"overlap"` (Overlap) mode, today's text-to-container behaviour is preserved: touching or enclosing a bound text element resolves to selecting its container element (`getContainerElement`) rather than the bound text element directly.
  - **Frames (both modes)**: When a frame-like element (`isFrameLikeElement`) is selected, all children of that frame (`getFrameChildren`) are excluded from `selectedElementIds` so only the frame remains selected.
  - **Additive selection (both modes)**: When `keepPreviousSelection` is `true` (Shift or Ctrl+Alt), previously selected element IDs are preserved and merged with the current lasso selection.
  - **Single linear element editor (both modes)**: Selecting a single ungrouped linear element initializes `selectedLinearElement` with a `LinearElementEditor` instance.

### Module: `packages/excalidraw/tests/lasso.test.tsx`, `packages/excalidraw/tests/selection.test.tsx`, `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`

- **FR-9 (Unit and end-to-end test coverage & Gate 0 pinning)**:
  - All existing tests in `packages/excalidraw/tests/lasso.test.tsx` SHALL remain passing without altering their expected selections.
  - `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx` SHALL include tests covering both `"contain"` and `"overlap"` modes, verifying:
    - Partial overlap (e.g., clipping a rectangle corner) selects the element in `"overlap"` mode and leaves it unselected in `"contain"` mode.
    - Full enclosure in `"contain"` mode selects rectangles, diamonds, ellipses, rotated shapes, lines/arrows, and freedraw strokes.
    - Concave lasso paths where an element's outline is partly inside and partly outside do not select the element in `"contain"` mode.
    - Arrow bound text labels must be enclosed in `"contain"` mode for the arrow to be selected.
    - In `"contain"` (Wrap) mode, a lasso enclosing only a rectangle's bound label (and not the rectangle's outline) selects nothing, whereas in `"overlap"` mode selecting the bound label selects its container.
    - Top-level and nested group containment in `"contain"` mode (enclosing only one member of a multi-member group — or having a selectable member outside the lasso or off-screen in the scene — selects nothing; enclosing all selectable members in the scene selects the group; locked and bound-text members do not block group containment) versus `"overlap"` mode (touching one member selects the whole group).
    - Special cases (frame selected instead of its children, Shift / Ctrl+Alt keeping previous selection, and mode-appropriate bound-text-to-container behaviour) in both modes.
  - In `packages/excalidraw/tests/selection.test.tsx`, the existing `describe("lasso reselection")` block (line ~154) SHALL be updated solely to pass `initialData={{ appState: { boxSelectionMode: "overlap" } }}` to `<Excalidraw />` (Gate 0 decision, option a). No other existing test in `packages/excalidraw/tests/selection.test.tsx` SHALL be modified.
  - `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` SHALL NOT have any existing snapshot modified; entries may only be added if required by new tests.

### Module: `packages/excalidraw/CHANGELOG.md`

- **FR-10 (Changelog documentation)**: `packages/excalidraw/CHANGELOG.md` SHALL gain a single-line entry under `## Unreleased` describing the user-visible behaviour change that the lasso tool now respects the "Select on" (`boxSelectionMode`) setting, requiring elements to be fully enclosed in the default Wrap mode.

---

## Non-functional requirements

- **NFR-1 (Performance & AABB Pre-filtering)**: `getLassoSelectedElementIds` SHALL retain the axis-aligned bounding box pre-filter (`doBoundsIntersect(lassoBounds, elementBounds)`) prior to performing polygon inclusion or line-segment intersection tests.
- **NFR-2 (Write Allowlist Compliance)**: File modifications SHALL be strictly limited to the frozen write allowlist:
  - `packages/excalidraw/lasso/utils.ts`
  - `packages/excalidraw/lasso/index.ts`
  - `packages/excalidraw/tests/lasso.test.tsx`
  - `packages/excalidraw/tests/selection.test.tsx`
  - `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`
  - `packages/excalidraw/CHANGELOG.md`
- **NFR-3 (Code Quality, Typecheck, and Zero Lint Warnings)**: All changes SHALL pass TypeScript type checking (`yarn test:typecheck`) and ESLint with zero warnings (`yarn test:code`, which runs `--max-warnings=0`).
- **NFR-4 (API Backward Compatibility)**: `getLassoSelectedElementIds` SHALL remain backward-compatible for callers that do not pass the mode parameter by defaulting to `"overlap"`.

---

## PII inventory

None. This feature operates purely on in-memory 2D canvas geometry and selection state in client-side code; no personally identifiable information (PII) is introduced, read, stored, or transmitted.

| Field | Sensitivity | Protection |
| :--- | :--- | :--- |
| None | N/A | N/A |

---

## Role matrix

Not applicable. Lasso selection mode is a client-side canvas interaction preference that applies uniformly to any interactive editor session; no role-based access control (RBAC) resources or permissions are involved.

---

## Acceptance criteria

1. **AC-1 (Partial intersection vs. mode)**: With `boxSelectionMode: "contain"`, a lasso path that crosses part of a rectangle (e.g., clips one corner) does not select it (`selectedElementIds` is empty); with `boxSelectionMode: "overlap"`, the exact same lasso path selects the rectangle.
2. **AC-2 (Full enclosure across element types in Wrap mode)**: With `boxSelectionMode: "contain"`, a lasso path that fully encloses an element (and for an arrow, its bound text label if any) selects it, verified for a rectangle, a diamond, an ellipse, a rotated shape, a line/arrow, and a freedraw stroke.
3. **AC-3 (Concave lasso partial enclosure in Wrap mode)**: With `boxSelectionMode: "contain"`, an element that is only partly inside a concave lasso polygon (some outline points inside the polygon, some outside, even if the lasso's axis-aligned bounding box contains the element) is not selected.
4. **AC-4 (Existing `lasso.test.tsx` cases unchanged in Overlap mode)**: With `"overlap"` mode (including when the mode argument to `getLassoSelectedElementIds` is omitted), all selections expected by existing test cases in `packages/excalidraw/tests/lasso.test.tsx` pass unchanged.
5. **AC-5 (Special cases and bound-to-container text across modes)**: In both `"contain"` and `"overlap"` modes, selecting a frame and its children selects only the frame, holding Shift or Ctrl+Alt retains the previous selection, and selecting a single ungrouped linear element sets `selectedLinearElement`. For bound-to-container text, in `"overlap"` mode selecting bound text selects its container instead, whereas in `"contain"` (Wrap) mode a bound-to-container text element never counts on its own and never selects its container — the container is selected only when its own outline is fully enclosed, verified by a Wrap test where a lasso enclosing only a rectangle's bound label selects nothing.
6. **AC-6 (Group selection in Wrap and Overlap modes)**: In Wrap (`"contain"`) mode, a group is selected only when every selectable member of its top-level group (`groupIds.at(-1)`) in the whole scene (non-deleted elements, not only `this.app.visibleElements`) is enclosed by the lasso (a lasso enclosing only one member of a two-member group, or where a member is off-screen or outside the lasso, selects nothing, while locked members and bound text do not block group selection); in Overlap (`"overlap"`) mode, touching any one member selects the entire group.
7. **AC-7 (Existing `selection.test.tsx` preservation & Gate 0 option a)**: All existing box-selection tests in `packages/excalidraw/tests/selection.test.tsx` pass unchanged, and the only edit to an existing test in `selection.test.tsx` is adding `initialData={{ appState: { boxSelectionMode: "overlap" } }}` to `describe("lasso reselection")`.
8. **AC-8 (jsdom test coverage in both test files)**: jsdom tests in both `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx` exercise both `"contain"` and `"overlap"` modes, including a partially touched element that is selected only in Overlap mode and a Wrap test where a lasso enclosing only a rectangle's bound label selects nothing.
9. **AC-9 (Snapshot integrity)**: In `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`, no existing snapshot entry is modified; entries are added only if created by new tests.
10. **AC-10 (Verification suite passes word-for-word)**: Running `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` exits with code 0 and zero ESLint warnings.

---

## Open questions for HITL

None. All Gate 0 design and scope decisions are settled in the intent brief.
