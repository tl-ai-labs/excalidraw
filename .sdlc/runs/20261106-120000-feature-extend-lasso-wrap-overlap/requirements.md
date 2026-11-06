# Delta Requirements — Lasso Honours Wrap/Overlap Selection Preference

**Run ID:** `20261106-120000-feature-extend-lasso-wrap-overlap`  
**Mode:** Brownfield · **Intent:** `feature-extend`  
**Issue:** `excalidraw/excalidraw#11809`

This document specifies only the delta relative to existing free-form lasso selection behaviour.

---

## In scope

1. `LassoTrail` (`packages/excalidraw/lasso/index.ts`) reads `this.app.state.boxSelectionMode` (`"contain"` = Wrap, `"overlap"` = Overlap; default `"contain"`) and applies mode-specific selection and group-resolution semantics.
2. `getLassoSelectedElementIds` (`packages/excalidraw/lasso/utils.ts`) accepts the active selection mode (`BoxSelectionMode`) and evaluates full outline containment in `"contain"` (Wrap) mode while preserving existing intersection/any-point enclosure logic in `"overlap"` (Overlap) mode.
3. Wrap (`"contain"`) full-enclosure evaluation covers rectangles (including rounded corners), diamonds, ellipses, rotated shapes, linear elements (lines/arrows), and freehand (`freedraw`) strokes using the element's real outline rather than a sparse point sample or axis-aligned bounding box alone.
4. Wrap (`"contain"`) bound-text and arrow-label handling requires an element's bound text / arrow label to be enclosed along with its container/arrow, matching box-selection Wrap semantics.
5. Wrap (`"contain"`) group handling selects a top-level group only when all selectable (non-locked, non-bound-text) members of that group are fully enclosed by the lasso polygon; partially enclosed groups have their enclosed members dropped from selection, matching box-selection Wrap semantics.
6. Optional **additive-only** helper export/extraction in `packages/element/src/bounds.ts` and/or `packages/element/src/selection.ts` if needed for outline/segment reuse, without altering `elementsOverlappingBBox` or `getElementsWithinSelection` behaviour.
7. Unit and integration tests in `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx` covering both `"contain"` and `"overlap"` modes across shape types, groups, and bound text (with optional snapshot update in `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` only if required).
8. User-visible behaviour change entry under `## Unreleased` in `packages/excalidraw/CHANGELOG.md`.

---

## Out of scope

1. Any change to rectangle box-selection behaviour (`getElementsWithinSelection`, `elementsOverlappingBBox`).
2. Any change to the `boxSelectionMode` preference default (`"contain"`), its browser storage/persistence, state restoration, or Main Menu preference UI (`packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`, `packages/excalidraw/data/restore.ts`, `packages/excalidraw/components/main-menu/DefaultItems.tsx`, `packages/excalidraw/locales/**`, `packages/excalidraw/components/App.tsx` are off-limits).
3. Introducing any new preference or separate lasso-only selection mode setting.
4. Any change to lasso's frame-children deduplication, locked-element filtering, or `AnimatedTrail` rendering/animation.
5. Modifying `.gitignore`, `.sdlc/**`, AI/editor configs (`.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`), or build/generated artifacts.

---

## Functional requirements per module

### `packages/excalidraw/lasso/utils.ts`

- **FR-1 (Mode parameter on `getLassoSelectedElementIds`):** `getLassoSelectedElementIds` SHALL accept `boxSelectionMode?: BoxSelectionMode` (or required mode parameter) indicating `"contain"` (Wrap) or `"overlap"` (Overlap).
- **FR-2 (Overlap mode unchanged):** When `boxSelectionMode === "overlap"`, `getLassoSelectedElementIds` SHALL preserve today's behaviour: an unlocked element whose AABB intersects `lassoBounds` is selected if any of its segment points lies inside the lasso polygon (`enclosureTest`) or if any lasso segment intersects the element's outline or its bound text (`intersectionTest`).
- **FR-3 (Wrap mode full outline enclosure):** When `boxSelectionMode === "contain"`, an unlocked element SHALL be selected only if its real geometric outline is completely enclosed within the closed lasso polygon (no outline points outside the polygon and no lasso edge crossing the element's outline). This SHALL hold for rectangles (sharp and rounded), diamonds, ellipses, rotated elements (`angle !== 0`), lines/arrows, and `freedraw` strokes.
- **FR-4 (Wrap mode bound text and arrow labels):** When `boxSelectionMode === "contain"`, an element with bound text (container bound text or arrow label) SHALL be selected only when both the element's outline and its bound text element's bounds/outline are fully enclosed by the lasso polygon. Bound text elements themselves SHALL NOT cause a container to be selected when the container is only partially enclosed.

### `packages/excalidraw/lasso/index.ts`

- **FR-5 (Pass `boxSelectionMode` from `AppState`):** `LassoTrail.updateSelection` SHALL read `this.app.state.boxSelectionMode` and pass it into `getLassoSelectedElementIds` (and group resolution). Because `appState.boxSelectionMode` defaults to `"contain"`, lasso selection with default `AppState` SHALL operate in Wrap mode.
- **FR-6 (Group semantics in Wrap vs Overlap):** In `LassoTrail.selectElementsFromIds` (or upstream in `getLassoSelectedElementIds`):
  - In `"overlap"` mode, selecting any member of a group expands selection to the entire group (existing `selectGroupsForSelectedElements` behaviour).
  - In `"contain"` mode, a group is selected only if every selectable (unlocked, non-bound-text) member of the top-level group is enclosed in the current lasso selection; if any member of the group is not enclosed, none of that group's members are selected (matching `elementsOverlappingBBox` `"contain"` group post-processing, while preserving `keepPreviousSelection` when Shift-extending a selection).

### `packages/element/src/bounds.ts` & `packages/element/src/selection.ts`

- **FR-7 (Additive-only element package changes):** Any change to `packages/element/src/bounds.ts` or `packages/element/src/selection.ts` SHALL be strictly additive (e.g., exporting an existing helper or extracting a pure outline helper). The signatures and runtime behaviour of `elementsOverlappingBBox` and `getElementsWithinSelection` SHALL remain unchanged.

### `packages/excalidraw/tests/lasso.test.tsx` & `packages/excalidraw/tests/selection.test.tsx`

- **FR-8 (Existing and new lasso tests):**
  - Existing overlap-assuming suites in `packages/excalidraw/tests/lasso.test.tsx` SHALL explicitly set or pass `"overlap"` mode so existing overlap expectations remain pinned and passing.
  - `packages/excalidraw/tests/lasso.test.tsx` SHALL include Wrap (`"contain"`) test cases covering rectangle, diamond, ellipse, rotated shape, line/arrow, freehand stroke, bound text/arrow label, and partial vs full group enclosure, including a partially touched element that is unselected in Wrap and selected in Overlap.
  - `packages/excalidraw/tests/selection.test.tsx` SHALL include a lasso selection suite exercising both `boxSelectionMode: "contain"` and `boxSelectionMode: "overlap"` via `initialData={{ appState: { boxSelectionMode } }}`.

### `packages/excalidraw/CHANGELOG.md`

- **FR-9 (Changelog entry):** `packages/excalidraw/CHANGELOG.md` SHALL document under `## Unreleased` that the lasso tool now respects the Wrap / Overlap (`boxSelectionMode`) selection preference.

---

## Non-functional requirements

- **NFR-1 (Performance):** Lasso selection updates during pointer move (`LassoTrail.updateSelection`) in `"contain"` mode SHALL remain comparable in cost to `"overlap"` mode by filtering candidates with AABB bounds checks (`lassoBounds` vs `elementBounds`) and reusing cached `this.elementsSegments` across pointer moves when canvas translation/zoom is unchanged.
- **NFR-2 (No state/schema footprint):** No new fields SHALL be added to `AppState`, persisted storage, or exported scene JSON.
- **NFR-3 (Strict TypeScript compliance):** All modified and added code SHALL pass `yarn test:typecheck` with zero errors without modifying generated type files under `packages/excalidraw/types/**`.

---

## PII inventory

No personally identifiable information (PII) is collected, processed, stored, or transmitted by this feature. Selection geometry operates purely on in-memory canvas coordinates.

| Field | Sensitivity | Protection |
| :--- | :--- | :--- |
| None | N/A | N/A |

---

## Role matrix

Excalidraw's lasso tool executes locally in the client canvas for the active interactive editor user. Multi-role access control is not applicable beyond standard interactive canvas state.

| Role | Resource | Action | Permitted |
| :--- | :--- | :--- | :--- |
| Local interactive editor user | Canvas unlocked elements (`this.app.visibleElements`) | Select via Lasso (`"contain"` or `"overlap"` per `appState.boxSelectionMode`) | Yes |
| Local interactive editor user | Locked elements (`element.locked === true`) | Select via Lasso | No (unchanged) |

---

## Acceptance criteria

1. **AC-1 (Wrap mode rejects partial overlap):** With `boxSelectionMode: "contain"`, a lasso path that only clips the corner or crosses an edge of a rectangle leaves the rectangle unselected, and selects it only when the lasso polygon fully encloses the rectangle's outline. Verified by tests in `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx`.
2. **AC-2 (Overlap mode preserves existing lasso behaviour):** With `boxSelectionMode: "overlap"`, the same corner-clipping lasso path selects the rectangle, and all existing overlap lasso cases (intersection, single-point enclosure, partial group expansion, frame child removal) behave identically to prior lasso behaviour. Verified by `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx`.
3. **AC-3 (Shape, group, and bound-text accuracy in Wrap mode):** With `boxSelectionMode: "contain"`, full-containment evaluation accurately selects fully enclosed elements and rejects partially enclosed elements across rectangle, diamond, ellipse, rotated shape, line/arrow (including arrow labels / bound text), freehand stroke (`freedraw`), and multi-element groups (selecting a group only when all its members are enclosed). Verified by `packages/excalidraw/tests/lasso.test.tsx`.
4. **AC-4 (jsdom test coverage for both modes):** `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx` execute in Vitest (jsdom) covering both `"contain"` and `"overlap"` modes, explicitly asserting that a partially touched element is unselected in `"contain"` and selected in `"overlap"`. Verified by running:
   `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
5. **AC-5 (Box-selection regressions = 0):** Existing box-selection test suites in `packages/excalidraw/tests/selection.test.tsx` and `packages/element/tests/bounds.test.ts` pass without modification to their assertions. Verified by running:
   `yarn test:app --watch=false packages/excalidraw/tests/selection.test.tsx packages/element/tests/bounds.test.ts`
6. **AC-6 (Full verification commands pass):** `yarn test:typecheck`, `yarn test:code`, and `yarn test:app --watch=false` all exit with code 0.

---

## Open questions for HITL

None. All scope, default-mode, shape-outline, group, bound-text, and file-boundary decisions were settled in the Intent Brief and confirmed at Gate 0.
