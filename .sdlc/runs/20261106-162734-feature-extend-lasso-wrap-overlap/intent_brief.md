# Intent Brief — feature-extend — Lasso selection respects Wrap/Overlap preference

## Context

Excalidraw has a user preference, `appState.boxSelectionMode` (`"contain"` | `"overlap"`). It appears as
Main menu → Preferences → "Select on: Wrap / Overlap" (`packages/excalidraw/components/main-menu/DefaultItems.tsx`),
defaults to `"contain"` (Wrap) in `packages/excalidraw/appState.ts`, and is persisted to the browser.
Rectangle box selection honours it in `App.tsx` (around line 11311) via
`getElementsWithinSelection(..., boxSelectionMode)` → `elementsOverlappingBBox({ type })` in
`packages/element/src/bounds.ts`.

The free-form lasso (`packages/excalidraw/lasso/index.ts`, `LassoTrail.updateSelection`) calls
`getLassoSelectedElementIds` (`packages/excalidraw/lasso/utils.ts`), which ignores the preference. It always
behaves like Overlap: an element is selected when any point of its outline falls inside the lasso polygon
(`enclosureTest`, which uses `segments.some(... points.some(...))`), or when the lasso path crosses the element
or its bound text (`intersectionTest`).

User's words (seed): "Make the free-form lasso selection respect the same Wrap or Overlap preference that
rectangle box selection already uses."

## Goal

The lasso reads `appState.boxSelectionMode` and selects accordingly:

- **Overlap (`"overlap"`)**: today's behaviour, unchanged.
- **Wrap (`"contain"`)**: an element is selected only when it is fully enclosed by the lasso, meaning every
  point of the element's outline segments lies inside the lasso polygon and the lasso path does not cross the
  element. For a container with bound text, the bound text must also be fully inside. A path that merely
  crosses or touches an element does not select it.

`getLassoSelectedElementIds` gets an optional `boxSelectionMode` input that defaults to `"overlap"`, so existing
callers (including the current test helper) keep their behaviour. `LassoTrail` passes
`this.app.state.boxSelectionMode`. No new preference, UI, or public API surface.

## Files in scope

- `packages/excalidraw/lasso/utils.ts`: add the `boxSelectionMode` input and Wrap (full-enclosure) logic
- `packages/excalidraw/lasso/index.ts`: pass `this.app.state.boxSelectionMode` through
- `packages/excalidraw/tests/lasso.test.tsx`: add tests for both modes (existing tests stay green)
- `packages/excalidraw/CHANGELOG.md`: one line under "Unreleased" noting the behaviour change (companion)
- `.gitignore`: append a `.sdlc/` entry (approved at Gate 0)

## Gate 0 decisions (approved 2026-11-06)

- Stack: node-typescript (Yarn 1 workspaces; React, Vite, Vitest, TS strict)
- Test command: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx` + `yarn test:typecheck` (full suite: `yarn test --watch=false`; no `test:update`)
- Auth mode: estimated
- Policy: opus55-plus-flash38
- AI configs: all OFF-LIMITS

## Files off-limits

- Project defaults from `.sdlc/project.json.off_limits_default`
- Detected AI configs: `.claude/**` (incl. `.claude/settings.local.json`), `CLAUDE.md`, `CLAUDE.local.md`,
  `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`
- Generated: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`
- Everything else not listed in scope. In particular, `packages/element/src/bounds.ts`,
  `packages/element/src/selection.ts`, `App.tsx`, the preference UI, `appState.ts`, `types.ts`, `restore.ts`,
  and locales are not touched.

## Acceptance criteria

1. With `boxSelectionMode: "overlap"`, lasso selection results are identical to today's for every existing
   test in `lasso.test.tsx`.
2. With `boxSelectionMode: "contain"`, an element only partly enclosed by the lasso is **not** selected, and
   neither is an element the lasso path merely crosses.
3. With `boxSelectionMode: "contain"`, an element fully enclosed by the lasso **is** selected. This includes a
   rotated element and a linear element.
4. With `boxSelectionMode: "contain"`, a container with bound text is selected only when both the container and
   its label are fully enclosed.
5. Existing lasso post-processing still applies in both modes: grouping, frame-children removal, text →
   container promotion, locked elements ignored, and shift (keep previous selection).
6. `LassoTrail` uses the live `appState.boxSelectionMode`, so changing the preference affects the next lasso
   without a reload.
7. `yarn test:typecheck` passes, and the lasso and selection test files pass.

## Non-goals

- Changing rectangle box selection, `elementsOverlappingBBox`, or the preference UI/labels.
- Adding a separate lasso-only preference, or changing the preference's default.
- Frame-clipping parity with box selection (the box path clips element bounds to their frame; lasso does not
  today and won't in this run).
- Performance work on the lasso beyond what the Wrap check needs.
