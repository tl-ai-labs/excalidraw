# Intent Brief — feature-extend — Lasso honours the Wrap/Overlap selection preference

## Context
Reported in excalidraw/excalidraw#11809. Rectangle box selection already honours
`appState.boxSelectionMode` (`"contain"` = Wrap, `"overlap"` = Overlap; default `"contain"`,
`packages/excalidraw/appState.ts:132`). Box selection passes the mode through
`getElementsWithinSelection` (`packages/element/src/selection.ts:70-99`) into
`elementsOverlappingBBox` (`packages/element/src/bounds.ts:1287+`).

The free-form lasso (`packages/excalidraw/lasso/index.ts` `LassoTrail.updateSelection` →
`packages/excalidraw/lasso/utils.ts` `getLassoSelectedElementIds`) ignores the preference. It always
behaves as Overlap: an element is selected if any one of its points is inside the lasso
(`enclosureTest`) or if the lasso path crosses its outline (`intersectionTest`).

**Before:** with the preference set to Wrap, a lasso that only clips the corner of a rectangle still
selects it.
**After:** the same lasso leaves the rectangle unselected in Wrap mode and selects it in Overlap mode.

## Goal
The lasso honours `appState.boxSelectionMode`. In Wrap (`"contain"`), an element is selected only
when the lasso polygon fully encloses it. In Overlap (`"overlap"`), touching it is enough, which is
today's lasso behaviour. The implementation mirrors how box selection handles both modes.

Decisions settled by the brief (re-confirmed at Gate 0):
- **Default:** lasso reads the setting as-is. Because the default is `"contain"`, users who never
  changed the preference will now get Wrap behaviour from the lasso, the same as box selection.
- **Groups and bound text in Wrap mode:** match box selection. A group is selected only when all its
  members are fully enclosed; partly enclosed groups are not selected. An element's bound text and
  arrow labels must be enclosed with it.
- **Shapes:** containment has to be correct for rectangles, diamonds, ellipses, rotated shapes,
  lines/arrows and freehand strokes. "Fully enclosed" is based on the element's real outline, not
  on a sample of its points.

## Files in scope
- `packages/excalidraw/lasso/utils.ts`: add a mode parameter to `getLassoSelectedElementIds` and
  a full-containment test for Wrap.
- `packages/excalidraw/lasso/index.ts`: pass `this.app.state.boxSelectionMode` from
  `updateSelection`, and apply Wrap group semantics in `selectElementsFromIds`.
- `packages/excalidraw/tests/lasso.test.tsx`: pin the existing expectations to Overlap, and add
  Wrap cases (with a partially touched element selected only in Overlap) across the shape types.
- `packages/excalidraw/tests/selection.test.tsx`: add a lasso-in-both-modes suite, reusing the
  `initialData={{ appState: { boxSelectionMode } }}` pattern from `:253`.
- `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap`: only if new snapshot tests
  require it.
- `packages/excalidraw/CHANGELOG.md`: companion. Add an Unreleased entry for the user-visible
  behaviour change.
- `packages/element/src/bounds.ts` / `packages/element/src/selection.ts`: **additive only**, to
  export or extract a reusable outline helper if the architect needs one. The behaviour of
  `elementsOverlappingBBox` and `getElementsWithinSelection` must not change.

## Files off-limits
- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs detected: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`
- Generated or build output: `**/node_modules`, `**/dist`, `**/build`, `dev-dist`, `coverage`,
  `packages/excalidraw/types/**`, `packages/excalidraw/subset/**` wasm wrappers
- Box-selection UI and state: `packages/excalidraw/appState.ts`, `packages/excalidraw/types.ts`,
  `packages/excalidraw/data/restore.ts`,
  `packages/excalidraw/components/main-menu/DefaultItems.tsx`, `packages/excalidraw/locales/**`,
  `packages/excalidraw/components/App.tsx`

## Acceptance criteria
1. Lasso with `boxSelectionMode: "contain"`: an element is selected only when fully enclosed. A
   lasso that clips the corner of a rectangle leaves it unselected.
2. Lasso with `boxSelectionMode: "overlap"`: the same lasso selects the rectangle. Overlap behaviour
   is otherwise identical to today's lasso.
3. Wrap containment is correct for rectangle, ellipse, rotated shape, line and freehand stroke.
4. jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` and `selection.test.tsx` cover both
   modes, including a partially touched element that is selected only in Overlap.
5. Existing box-selection tests (`selection.test.tsx` box-selection suites,
   `packages/element/tests/bounds.test.ts`) pass unchanged.
6. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals
- No change to box-selection behaviour, the preference's default, its persistence, or its menu UI.
- No new preference and no separate lasso-only setting.
- No change to lasso's frame handling, locked-element handling, or the trail animation.

## Gate 0 — confirmed scope (approved 2026-11-06)
- Intent: feature-extend · Policy: argon4-plus-sonnet55 · Auth mode: estimated
- Test command: `yarn test:app --watch=false` (plus `yarn test:typecheck`, `yarn test:code`)
- Allowlist and off-limits: exactly as listed above; write contract frozen.
- `.gitignore`: the user declined adding `.sdlc/`. It is off-limits this run; noted for the final report.
