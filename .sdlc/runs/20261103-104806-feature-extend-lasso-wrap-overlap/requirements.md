# Requirements — feature-extend — Lasso selection respects the Wrap/Overlap preference

Run: `20261103-104806-feature-extend-lasso-wrap-overlap` · Intent: feature-extend (delta requirements)
Source: `intent_brief.md` (Gate 0 approved).

## Delta summary

The free-form lasso today always selects with Overlap semantics (union of `intersectionTest` and
`enclosureTest` in `getLassoSelectedElementIds`). This change makes the lasso follow the existing
`appState.boxSelectionMode` preference ("Select on": Wrap = `"contain"`, Overlap = `"overlap"`), mirroring
rectangle box-select Wrap rules. Default preference stays `"contain"` (Wrap), so default users see the lasso
switch to Wrap (confirmed intended).

## In scope

1. An optional `boxSelectionMode` input on `getLassoSelectedElementIds` (`packages/excalidraw/lasso/utils.ts`),
   defaulting to `"overlap"`.
2. Wrap-mode ("contain") enclosure logic and group-completeness filtering in `lasso/utils.ts`.
3. `LassoTrail` (`packages/excalidraw/lasso/index.ts`) passing the live `this.app.state.boxSelectionMode`,
   and Wrap-aware group handling in `selectElementsFromIds` where needed.
4. New unit and integration tests (`packages/excalidraw/tests/lasso.test.tsx`); the existing
   `lasso reselection` test in `packages/excalidraw/tests/selection.test.tsx` pinned to Overlap (or its
   path widened) with its assertion intact.
5. One "Unreleased" entry in `packages/excalidraw/CHANGELOG.md`.
6. Append `.sdlc/` to `.gitignore`.

## Out of scope

1. New preference, appState key, menu item or locale strings; the "Select on" label is unchanged.
2. Changing the default of `boxSelectionMode`.
3. Any change to rectangle box selection, `elementsOverlappingBBox`, `getElementsWithinSelection`,
   `App.tsx`, `appState.ts`, `types.ts`, `DefaultItems.tsx` or locale files (all outside the write contract).
4. Lasso visuals (trail, fill, animation) or its performance strategy beyond what Wrap needs.
5. Nested group editing while lassoing beyond today's behavior.

## Functional requirements

### Module: lasso/utils (`packages/excalidraw/lasso/utils.ts`)

- **FR-1** `getLassoSelectedElementIds` accepts an optional `boxSelectionMode: "contain" | "overlap"` input
  (type taken from the existing `AppState["boxSelectionMode"]`). When omitted it behaves exactly as today
  ("overlap").
- **FR-2** Overlap mode: the result is identical to today's — every element the lasso crosses
  (`intersectionTest`) or partly encloses (`enclosureTest`).
- **FR-3** Wrap mode: an element is selected only when (a) every point of its outline segments lies inside
  the lasso polygon and (b) the lasso path does not intersect its outline.
- **FR-4** Wrap mode, bound text: a container with bound text is selected only when the container and its
  bound text element are both fully enclosed (FR-3 applied to each).
- **FR-5** Wrap mode, groups: an element that belongs to a group (outermost group relevant to the current
  editing context, as box select treats it) is kept only when every non-deleted member of that group is
  fully enclosed; a partly enclosed group contributes nothing.
- **FR-6** The function's existing optimisations (simplified path, AABB pre-filter) remain; Wrap may
  short-circuit an element whose AABB is not fully inside the lasso's AABB.

### Module: lasso/index (`packages/excalidraw/lasso/index.ts`)

- **FR-7** `LassoTrail.updateSelection` passes `this.app.state.boxSelectionMode`, read on every update
  (no caching across strokes), so a preference change affects the next lasso stroke without reload.
- **FR-8** `selectElementsFromIds` keeps today's rules in both modes: a selected text element maps to its
  container; when a frame is selected its children are removed. In Wrap mode group completeness is enforced
  before `selectGroupsForSelectedElements` so that a partly enclosed group is not expanded from one member.

### Module: tests

- **FR-9** Unit tests in `lasso.test.tsx` call `getLassoSelectedElementIds` with `"contain"` and
  `"overlap"`, covering full enclosure, crossing-only, partial enclosure, bound text, and groups. Existing
  tests in the file remain unchanged and keep passing with the default.
- **FR-10** Integration tests (App / `LassoTrail` path) cover Wrap and Overlap by setting
  `boxSelectionMode` (via `initialData` appState or `API.setAppState`), including a live preference switch
  between two strokes.
- **FR-11** The existing `lasso reselection` test (`selection.test.tsx`) keeps its intent and its
  assertions, pinned to `boxSelectionMode: "overlap"` or with a path that fully encloses the targets.

### Module: docs / repo hygiene

- **FR-12** `packages/excalidraw/CHANGELOG.md` gains one entry under "Unreleased" describing that the lasso
  now respects the "Select on" (Wrap/Overlap) preference.
- **FR-13** `.gitignore` gains a `.sdlc/` line (append only, nothing removed).

## Non-functional requirements

- **NFR-1** Backward compatibility: existing callers of `getLassoSelectedElementIds` compile and behave
  unchanged; the public signature only gains an optional field.
- **NFR-2** Performance: Wrap mode adds no more than one extra pass over candidate elements already
  filtered by the AABB check; no per-frame allocation beyond today's order of magnitude.
- **NFR-3** Type safety: `yarn test:typecheck` passes; no `any` introduced.
- **NFR-4** Style: follows the existing code style of `lasso/utils.ts` / `lasso/index.ts`; `yarn fix`
  (prettier/eslint) leaves the changed files unchanged.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| — | none | The change reads only in-memory scene geometry and a local UI preference; no PII is read, stored or sent. |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Any editor user | canvas elements | lasso-select (behavior governed by own local preference) |

No authn/authz surface is touched.

## Acceptance criteria

- **AC-1** Wrap: with `boxSelectionMode: "contain"`, a lasso fully enclosing an element selects it; a lasso
  that only crosses it, or encloses only part of it, does not.
- **AC-2** Overlap: with `boxSelectionMode: "overlap"`, the lasso selects exactly what it selects today
  (crossed or partly enclosed elements).
- **AC-3** Groups (Wrap): a group is selected only when every member is fully enclosed; a partly enclosed
  group selects none of its members.
- **AC-4** Bound text (Wrap): a container with bound text is selected only when container and bound text are
  both enclosed; a selected text element still maps to its container.
- **AC-5** Frames: in both modes, when a frame is selected its children are removed from the selection.
- **AC-6** Live preference: switching `boxSelectionMode` between two lasso strokes changes the second
  stroke's result with no reload.
- **AC-7** Backward compatibility: calling `getLassoSelectedElementIds` without the new input gives today's
  results; all pre-existing assertions in `lasso.test.tsx` pass unchanged.
- **AC-8** Checks: new tests cover Wrap and Overlap on both the unit and integration paths;
  `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
  passes and `yarn test:typecheck` passes.

## Open questions for HITL

None. Semantics (mirror box Wrap rules; lasso follows the preference including its Wrap default; no new
UI/keys/strings) were settled at interview and Gate 0.
