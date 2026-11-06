# Intent Brief — feature-extend — Lasso honours box selection mode

## Context

Reported in excalidraw/excalidraw#11809.

Box selection already supports two modes, set by `appState.boxSelectionMode`
(`BoxSelectionMode = "contain" | "overlap"`, `packages/excalidraw/types.ts:280`; default `"contain"` in
`packages/excalidraw/appState.ts`). The Preferences menu labels them **Wrap** (`"contain"`) and **Overlap**
(`"overlap"`) (`components/main-menu/DefaultItems.tsx`, `locales/en.json`). `App.tsx` passes
`this.state.boxSelectionMode` to `getElementsWithinSelection` (`packages/element/src/selection.ts`), which
calls `elementsOverlappingBBox` (`packages/element/src/bounds.ts`) — the reference for how each mode treats
element outlines, bound-text labels, frames and groups.

The lasso tool (`packages/excalidraw/lasso/index.ts`, `LassoTrail`; `packages/excalidraw/lasso/utils.ts`,
`getLassoSelectedElementIds`) ignores the mode. It always selects the union of:
- elements the lasso path crosses (`intersectionTest`, lasso segments against the element outline and its
  bound text), and
- elements it counts as enclosed (`enclosureTest`), where *any single* point of the element's line segments
  inside the lasso polygon counts — so an element only partly inside is "enclosed".

The result is Overlap-like behaviour whatever the preference says.

## Goal

The lasso honours `appState.boxSelectionMode`:
- **Wrap (`"contain"`)** — an element is selected only when the lasso polygon fully encloses it (its whole
  outline is inside the lasso; the lasso does not cross it).
- **Overlap (`"overlap"`)** — an element is selected when the lasso touches it: crosses its outline, or
  encloses it wholly or partly (today's behaviour).

Before: with the preference set to Wrap, a lasso that only clips the corner of a rectangle still selects it.
After: the same lasso leaves that rectangle unselected in Wrap mode and selects it in Overlap mode.

Polygon containment versus intersection must hold for rectangles, diamonds, ellipses, rotated shapes,
lines/arrows and freedraw strokes (the shapes `getElementLineSegments` produces segments for). A lasso path
can be concave, so containment is decided against the polygon, not its bounding box.

`getLassoSelectedElementIds` gains a mode input that defaults to today's behaviour (`"overlap"`) when omitted,
so existing direct callers (`tests/lasso.test.tsx`) keep their meaning; `LassoTrail` passes
`this.app.state.boxSelectionMode`, so the lasso follows the preference including its `"contain"` (Wrap)
default.

Groups and labels match box selection's `elementsOverlappingBBox` exactly:
- **Wrap (`"contain"`)** — an element in a group is selected only when every member of its top-level group
  (`groupIds.at(-1)`) is enclosed. As in box selection, only selectable members count toward the group (locked
  elements and bound text do not).
- **Overlap (`"overlap"`)** — touching one member selects the whole group (today's lasso behaviour).
- **Wrap and arrow labels** — an arrow's bound label must also be enclosed, as box selection's `"contain"`
  requires of the element-plus-label bounds.

## Files in scope

- `packages/excalidraw/lasso/utils.ts` — mode-aware enclosure / intersection.
- `packages/excalidraw/lasso/index.ts` — pass `boxSelectionMode` from app state.
- `packages/excalidraw/tests/lasso.test.tsx` — tests for both modes.
- `packages/excalidraw/tests/selection.test.tsx` — end-to-end lasso tests driven through the pointer with
  `boxSelectionMode` set via `initialData`, both modes. Gate 0 decision (option a): the existing
  `describe("lasso reselection")` block (line ~154) renders with
  `initialData={{ appState: { boxSelectionMode: "overlap" } }}`, as `describe("box-selection overlap mode")`
  does. Its lasso only crosses `rectA`, so under the new `"contain"` default it would select nothing. Its
  lasso path and assertion stay as they are; no other existing test in the file changes.
- `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` — may only gain entries for new tests; no
  existing snapshot may change.
- `packages/excalidraw/CHANGELOG.md` — one line under "Unreleased" (user-visible behaviour change: the lasso
  now follows "Select on", and the default Wrap mode needs elements fully enclosed).

No `.gitignore` change (`.sdlc/` is excluded locally via `.git/info/exclude`).

## Files off-limits

Project defaults from `.sdlc/project.json`, the AI configs discovery found (`.claude/**`, `CLAUDE.md`,
`.github/copilot-instructions.md`), plus:
- `packages/element/src/bounds.ts`, `packages/element/src/selection.ts` and the rest of `packages/element/**` —
  box-selection behaviour must not change. Read them; do not edit them.
- `packages/excalidraw/components/App.tsx` — the box-selection call site.
- `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts`, `packages/excalidraw/locales/**` — the
  mode type, default and labels already exist.
- Generated and build output: `packages/excalidraw/types/**`, `dev-dist/**`, `coverage/**`, the generated
  wasm sources under `packages/excalidraw/subset/**`.

## Acceptance criteria

1. With `boxSelectionMode: "contain"`, a lasso that crosses part of a rectangle (e.g. clips one corner) does
   not select it; with `"overlap"` the same lasso selects it.
2. With `"contain"`, a lasso that fully encloses an element selects it, for a rectangle, an ellipse, a rotated
   shape, a line/arrow and a freedraw stroke.
3. With `"contain"`, an element partly inside a concave lasso (some outline points inside, some outside, no
   bounding-box shortcut) is not selected.
4. With `"overlap"`, all selections the existing `lasso.test.tsx` cases expect are unchanged.
5. Existing lasso special cases still hold in both modes: frame selected instead of its children, container
   selected instead of its bound text, shift/ctrl+alt keeping previous selection.
6. Groups: in Wrap mode a group is selected only when every selectable member of its top-level group is
   enclosed (a lasso enclosing one member of a two-member group selects nothing); in Overlap mode touching one
   member selects the whole group.
7. Existing box-selection tests in `selection.test.tsx` pass unchanged; the only edit to an existing test is
   pinning `describe("lasso reselection")` to `"overlap"` (Gate 0, option a).
8. jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx`
   cover both modes, including a partially touched element selected only in Overlap mode.
9. `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`: no existing snapshot changes; entries are
   added only for new tests.
10. The run's test command, word for word, passes:
    `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
    (`test:code` is eslint with `--max-warnings=0` and passes at the base commit).

## Non-goals

- No change to box selection, its algorithm, or `packages/element/**`.
- No new preference, toggle, UI or locale strings; the lasso shares the existing "Select on" setting.
- No change to how the lasso path is drawn, simplified or animated.
- No group semantics of the lasso's own: groups follow box selection exactly (see Goal).
- No `.gitignore` change.
- No performance rework beyond keeping the existing AABB pre-filter.
