# Requirements — Lasso Honours `boxSelectionMode` (Wrap / Overlap)

- **Run ID**: `20261106-152732-feature-extend-lasso-box-selection-mode`
- **Mode**: `brownfield`
- **Intent**: `feature-extend` (Delta requirements relative to current behaviour)

---

## In scope

1. **Selection-mode-aware lasso geometry (`packages/excalidraw/lasso/utils.ts`)**: Extend `getLassoSelectedElementIds` with an optional `boxSelectionMode?: AppState["boxSelectionMode"]` (`"contain" | "overlap"`) parameter so that `"contain"` (Wrap) selects an element only when it is fully enclosed by the lasso polygon without outline intersection, and `"overlap"` (Overlap) preserves current touch/intersection/partial-enclosure selection behaviour across rectangles, ellipses, diamonds, rotated shapes, lines/arrows, freehand (`freedraw`) strokes, and bound text (which follows its container).
2. **App-state wiring in `LassoTrail` (`packages/excalidraw/lasso/index.ts`)**: Pass `this.app.state.boxSelectionMode` into `getLassoSelectedElementIds` during `LassoTrail.updateSelection`.
3. **Unit and jsdom shape tests (`packages/excalidraw/tests/lasso.test.tsx`)**: Add unit/jsdom tests verifying both `"contain"` and `"overlap"` modes across rectangle, diamond, ellipse, rotated shape, line/arrow, freehand stroke, and bound text.
4. **End-to-end tool & regression tests (`packages/excalidraw/tests/selection.test.tsx` and optionally `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`)**: Add integration tests exercising the lasso tool with `appState.boxSelectionMode` set to `"contain"` and `"overlap"` (including verifying that a partially touched element is selected in Overlap mode and not selected in Contain mode), plus regression coverage confirming rectangle box-selection behaviour is unchanged.
5. **Changelog entry (`packages/excalidraw/CHANGELOG.md`)**: Add one entry line under `## Unreleased` documenting that the lasso tool now honours the box selection mode preference (`contain` / `overlap`).
6. **Git ignore configuration (`.gitignore`)**: Append `.sdlc/` to `.gitignore`.

---

## Out of scope

1. **The box-selection code path does not change**: No modifications to `packages/element/src/selection.ts`, `packages/element/src/bounds.ts`, or `packages/excalidraw/components/App.tsx` where rectangle box selection is implemented and invoked.
2. **No UI, menu, locale, or appState schema changes**: No new preference, menu item (`packages/excalidraw/components/main-menu/DefaultItems.tsx`), locale strings (`packages/excalidraw/locales/**`), or `appState` fields (`packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`). Renaming the existing "Select on: Wrap / Overlap" label is out of scope.
3. **No host application changes**: No modifications to `excalidraw-app/**`.
4. **No new third-party dependencies or broad lasso performance architecture rework**: Use existing `@excalidraw/math` and `@excalidraw/element` helpers and the cached `elementsSegments` map.
5. **All other off-limits paths**: No modifications to `.env*`, `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `.next/**`, `coverage/**`, `packages/excalidraw/types/**`, `.git/**`, or `.sdlc/**` (outside run artifacts).

---

## Functional requirements per module

### Module 1: Lasso Selection Utilities (`packages/excalidraw/lasso/utils.ts`)

- **FR-1 (API contract for `getLassoSelectedElementIds`)**: `getLassoSelectedElementIds` SHALL accept an optional `boxSelectionMode?: "contain" | "overlap"` property in its input object. When `boxSelectionMode` is omitted or `"overlap"`, `getLassoSelectedElementIds` SHALL preserve existing callers' behaviour (selecting elements that are either enclosed or intersected by the lasso path).
- **FR-2 (`"contain"` / Wrap mode full-enclosure semantics)**: When `boxSelectionMode === "contain"`, an unlocked element whose axis-aligned bounding box intersects `lassoBounds` SHALL be selected if and only if it is fully enclosed by the closed lasso polygon — specifically, every sampled point of every line segment in `elementsSegments.get(element.id)` lies inside the lasso polygon (`polygonIncludesPointNonZero(point, lassoPolygon)`) AND no lasso segment intersects the element's outline (`intersectionTest(path, element, elementsMap)` is `false`).
- **FR-3 (`"overlap"` / Overlap mode touch/intersection semantics)**: When `boxSelectionMode === "overlap"` (or omitted), an unlocked element whose bounding box intersects `lassoBounds` SHALL be selected when any sampled point of its outline segments in `elementsSegments` lies inside the lasso polygon OR any segment of the closed lasso path intersects the element (or its bound text) via `intersectionTest`.
- **FR-4 (Shape coverage across element types)**: Both `"contain"` and `"overlap"` modes in `getLassoSelectedElementIds` SHALL accurately evaluate:
  - Axis-aligned rectangles, diamonds, and ellipses;
  - Rotated shapes (`angle !== 0`, including rotated rectangles, diamonds, and ellipses);
  - Linear elements (`line` and `arrow`, single-segment and multi-point);
  - Freehand strokes (`freedraw` elements, open and closed paths);
  - Standalone text elements.
- **FR-5 (Bound text follows its container)**: Bound text elements (`element.containerId !== null`) SHALL follow their container element rather than being independently selectable in a way that violates the container's mode check:
  - In `"contain"` mode, a lasso that encloses only a container's bound text (inside the container) without fully enclosing the container itself SHALL NOT select the container or the bound text; when the container is fully enclosed (and its bound text, if extending, is not crossed/outside), the container is selected and its bound text follows it.
  - In `"overlap"` mode, touching or enclosing either the container or its bound text selects the container (preserving current behaviour).

### Module 2: Lasso Trail Integration (`packages/excalidraw/lasso/index.ts`)

- **FR-6 (Pass `boxSelectionMode` from App state)**: `LassoTrail.updateSelection` in `packages/excalidraw/lasso/index.ts` SHALL pass `boxSelectionMode: this.app.state.boxSelectionMode` to `getLassoSelectedElementIds`.

### Module 3: Automated Tests (`packages/excalidraw/tests/lasso.test.tsx`, `packages/excalidraw/tests/selection.test.tsx`)

- **FR-7 (Unit and shape-level test coverage in `lasso.test.tsx`)**: `packages/excalidraw/tests/lasso.test.tsx` SHALL test `boxSelectionMode: "contain"` and `boxSelectionMode: "overlap"` across rectangles, diamonds, ellipses, rotated shapes, lines/arrows, freehand (`freedraw`) strokes, and bound text (verifying bound text follows its container).
- **FR-8 (Integration and regression test coverage in `selection.test.tsx`)**: `packages/excalidraw/tests/selection.test.tsx` SHALL include end-to-end lasso tool tests for both `boxSelectionMode: "contain"` and `boxSelectionMode: "overlap"`, explicitly verifying that a partially touched element is selected in `"overlap"` mode and NOT selected in `"contain"` mode, and verifying that existing rectangle box-selection behaviour remains unchanged.

### Module 4: Repository & Release Metadata (`packages/excalidraw/CHANGELOG.md`, `.gitignore`)

- **FR-9 (Changelog entry)**: `packages/excalidraw/CHANGELOG.md` SHALL add a single bullet line under `## Unreleased` describing the lasso `boxSelectionMode` (`contain` / `overlap`) support.
- **FR-10 (`.gitignore` entry)**: `.gitignore` SHALL include `.sdlc/` on a new line so local SDLC run artifacts are ignored by Git.

---

## Non-functional requirements

- **NFR-1 (No per-frame lasso performance regression)**: The `"contain"` mode check SHALL reuse the precomputed `elementsSegments` map, bounding-box pre-filter (`doBoundsIntersect(lassoBounds, elementBounds)`), and simplified lasso path (`simplifyDistance`) without introducing extra per-frame allocations of element segment maps or new dependencies, avoiding any performance regression during interactive pointer move frames.
- **NFR-2 (Type safety)**: All changes SHALL be strictly type-safe under TypeScript (`yarn test:typecheck`) without `any` casts or modifications to off-limits type definition files.
- **NFR-3 (Backwards compatibility and zero test regressions)**: Existing callers of `getLassoSelectedElementIds` that do not pass `boxSelectionMode` and all existing unit/integration tests across the repository SHALL continue to pass (`yarn test:app --watch=false`, `yarn test:code`).

---

## PII inventory

No personally identifiable information (PII) is collected, processed, stored, or transmitted by this feature. All operations are purely geometric calculations on in-memory canvas elements in a client-side editor.

| Field | Sensitivity | Protection |
| :--- | :--- | :--- |
| None | N/A | N/A (no PII fields exist in scope) |

---

## Role matrix

Not applicable — Excalidraw is a client-side canvas editor and selection mode (`appState.boxSelectionMode`) is a local user preference operating on unlocked canvas elements in memory.

| Role | Resource | Action | Permission / Behaviour |
| :--- | :--- | :--- | :--- |
| Interactive Editor User | Unlocked Canvas Elements (`!element.locked`) | Lasso Select (`boxSelectionMode: "contain"`) | Allowed — selects element only when fully enclosed by lasso path |
| Interactive Editor User | Unlocked Canvas Elements (`!element.locked`) | Lasso Select (`boxSelectionMode: "overlap"`) | Allowed — selects element when enclosed or intersected by lasso path |
| Interactive Editor User | Locked Canvas Elements (`element.locked === true`) | Lasso Select (any mode) | Denied — locked elements are excluded from lasso selection |

---

## Acceptance criteria

1. **AC-1 (Partial touch vs full enclosure across modes)**: A lasso path that partially touches/clips an element selects the element when `appState.boxSelectionMode === "overlap"` and does **NOT** select the element when `appState.boxSelectionMode === "contain"`; a lasso path that fully encloses the element selects it in both modes. Executable via:
   ```bash
   yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx
   ```
2. **AC-2 (Shape and bound-text coverage in `lasso.test.tsx`)**: Unit/jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` verify `"contain"` and `"overlap"` lasso selection for rectangles, diamonds, ellipses, rotated shapes, lines/arrows, freehand (`freedraw`) strokes, and containers with bound text (confirming bound text follows its container). Executable via:
   ```bash
   yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx
   ```
3. **AC-3 (End-to-end lasso tool & box-selection regression in `selection.test.tsx`)**: Integration tests in `packages/excalidraw/tests/selection.test.tsx` verify end-to-end lasso tool selection under both `boxSelectionMode: "contain"` and `boxSelectionMode: "overlap"` (including a partially touched element selected in Overlap mode and NOT selected in Contain mode), and all existing box-selection tests pass unchanged. Executable via:
   ```bash
   yarn test:app --watch=false packages/excalidraw/tests/selection.test.tsx
   ```
4. **AC-4 (Typecheck passes)**: TypeScript compilation and type checking succeed with zero errors. Executable via:
   ```bash
   yarn test:typecheck
   ```
5. **AC-5 (Code formatting and lint checks pass)**: Code quality and linting checks succeed with zero errors. Executable via:
   ```bash
   yarn test:code
   ```
6. **AC-6 (Companion metadata files updated within allowlist)**: `.gitignore` contains `.sdlc/`, `packages/excalidraw/CHANGELOG.md` contains a line under `## Unreleased`, and only allowlisted files are modified.

---

## Open questions for HITL

None. All scope, geometry semantics, default parameter handling, and file allowlist boundaries were resolved and frozen at Gate 0.
