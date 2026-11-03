# Intent Brief — feature-extend — Lasso selection respects the Wrap/Overlap preference

## Context

Excalidraw has a user preference, Preferences → "Select on", with the choices **Wrap** and **Overlap**.
It is stored as `appState.boxSelectionMode: "contain" | "overlap"`, defaults to `"contain"` (Wrap) and is
persisted to the browser only.

- The type is at `packages/excalidraw/types.ts:280`, the default at `packages/excalidraw/appState.ts:132`,
  and the menu item at `packages/excalidraw/components/main-menu/DefaultItems.tsx:443`.
- Today only rectangle box selection uses it. `App.tsx:11311` passes it into `getElementsWithinSelection`
  (`packages/element/src/selection.ts:76`), which calls `elementsOverlappingBBox`
  (`packages/element/src/bounds.ts:1287`).
- In Wrap mode, an element counts only when the box fully contains it.
- In Wrap mode, a group counts only when every member is wrapped. In Overlap mode, one touched member
  pulls in its whole group.

The free-form lasso ignores the preference:

- `LassoTrail.updateSelection` in `packages/excalidraw/lasso/index.ts` calls `getLassoSelectedElementIds`
  in `packages/excalidraw/lasso/utils.ts`.
- That function always selects the union of the elements it crosses (`intersectionTest`) and the elements
  it partly encloses (`enclosureTest`: any outline point inside the lasso polygon). This is Overlap
  behavior in every case.

## Goal

The lasso tool's selection follows `appState.boxSelectionMode`, the same preference box selection uses:

- **Overlap** (`"overlap"`): behavior is unchanged from today. An element is selected when the lasso
  crosses it or encloses any part of it, and the group it belongs to is expanded as today.
- **Wrap** (`"contain"`): an element is selected only when the lasso fully encloses it.
  - Every point of the element's outline segments lies inside the lasso polygon.
  - The lasso path does not cross the element's outline.
  - The element's bound text, when present, is fully enclosed as well.
  - A group is selected only when all its members are enclosed, which mirrors box-select Wrap.

## Files in scope

- `packages/excalidraw/lasso/utils.ts`
  - `getLassoSelectedElementIds` gains an **optional** `boxSelectionMode` input, defaulting to
    `"overlap"`.
  - The Wrap-mode enclosure logic and the group-completeness filter live here.
- `packages/excalidraw/lasso/index.ts`
  - `LassoTrail.updateSelection` passes `this.app.state.boxSelectionMode`.
  - Wrap-aware group handling goes in `selectElementsFromIds` if it is needed there.
- `packages/excalidraw/tests/lasso.test.tsx`: new tests for Wrap and Overlap. Existing tests stay in the
  file.
- `packages/excalidraw/tests/selection.test.tsx`: the existing `lasso reselection` test (line 159) uses a
  lasso that only partly encloses `rectA`. Under the new Wrap default it would no longer select `rectA`.
  Pin that test to `boxSelectionMode: "overlap"` (via `initialData`) or widen its path so it keeps its
  intent. Do not weaken the assertion.
- `packages/excalidraw/CHANGELOG.md`: companion file, one entry under "Unreleased".
- `.gitignore`: append a `.sdlc/` entry. Approved at Gate 0.

**Gate 0 (approved):**
- auth_mode: estimated
- policy: opus55-only
- test command: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`
  plus `yarn test:typecheck`
- The write contract is frozen with the 6 allowlisted paths above.

## Files off-limits

- The project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- AI configs: `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/**`
- `packages/excalidraw/types/**`, which is generated
- Implicitly, everything not in the allowlist. This includes `packages/element/src/bounds.ts` and
  `selection.ts`, `App.tsx`, `appState.ts`, `types.ts`, `DefaultItems.tsx` and all locale files.

## Acceptance criteria

1. **Wrap mode.** With `boxSelectionMode: "contain"`, a lasso that fully encloses an element selects it.
   A lasso that only crosses an element, or encloses part of it, does not select it.
2. **Overlap mode.** With `boxSelectionMode: "overlap"`, the lasso selects exactly what it selects today:
   the elements it crosses or partly encloses.
3. **Groups in Wrap mode.** A group is selected only when every member is fully enclosed. A partly
   enclosed group selects nothing from that group.
4. **Bound text.** In Wrap mode, a container with bound text is selected only when both the container and
   its bound text are enclosed. A selected text element still maps to its container, as today.
5. **Frames.** Today's rule stays in both modes: when a frame is selected, its children are removed from
   the selection.
6. **Live preference.** The lasso reads the preference live. Changing "Select on" in Preferences changes
   lasso behavior on the next lasso stroke, with no reload.
7. **Backward compatibility.** `getLassoSelectedElementIds` stays backward compatible: the new input is
   optional and defaults to `"overlap"`, so direct callers and existing unit tests keep today's results.
8. **Tests and checks.**
   - New tests cover Wrap and Overlap, in both the unit (`getLassoSelectedElementIds`) and the
     integration (`LassoTrail` / `App`) paths.
   - `yarn test:typecheck` passes, and `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx`
     passes.

## Non-goals

- No new preference, appState key, menu item or locale strings. The existing "Select on" item is reused
  as it is, and its label stays the same.
- No change to the default value of `boxSelectionMode`. Users on the default (Wrap) will see the lasso
  switch to Wrap, which was confirmed as intended at interview.
- No change to rectangle box selection, `elementsOverlappingBBox` or `getElementsWithinSelection`.
- No change to the lasso's look (trail, fill, animation) or its performance strategy beyond what Wrap mode
  needs.
- No support for nested group editing while lassoing beyond what exists today.
