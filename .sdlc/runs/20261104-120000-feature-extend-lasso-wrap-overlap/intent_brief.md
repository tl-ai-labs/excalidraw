# Intent Brief — feature-extend — Lasso honours Wrap/Overlap box-selection mode

## Context
Reported in excalidraw/excalidraw#11809. Rectangle box selection already respects
`appState.boxSelectionMode` (`"contain"` = Wrap, `"overlap"` = Overlap; default `"contain"`,
`packages/excalidraw/appState.ts:132`). Box selection passes it at `App.tsx:~11311` to
`getElementsWithinSelection` (`packages/element/src/selection.ts:72-98`) →
`elementsOverlappingBBox` (`packages/element/src/bounds.ts`).

The free-form lasso ignores the preference. `getLassoSelectedElementIds`
(`packages/excalidraw/lasso/utils.ts`) returns intersected ∪ enclosed elements, so lasso always
behaves like Overlap. `LassoTrail.updateSelection` (`packages/excalidraw/lasso/index.ts:~196`) is
the only production caller and can read `this.app.state.boxSelectionMode`.

## Goal
The lasso honours `appState.boxSelectionMode`:
- **Wrap (`"contain"`)** — an element is selected only when it is fully enclosed by the lasso
  polygon.
- **Overlap (`"overlap"`)** — touching (intersecting) or enclosing the element is enough
  (today's lasso behaviour).

Before: with the preference set to Wrap, a lasso that only clips the corner of a rectangle still
selects it.
After: the same lasso leaves that rectangle unselected in Wrap mode and selects it in Overlap mode.

The lasso follows the setting strictly. Because the app default is Wrap, default-mode lasso becomes
enclose-only. That behaviour change is intended. Existing lasso tests that rely on intersection get
pinned to `"overlap"` mode, or are rewritten to assert the Wrap result.

Implementation notes: read how box selection implements both modes and mirror its semantics. Thread
the mode into `getLassoSelectedElementIds` as an input. Make that input optional, defaulting to
today's overlap behaviour, so the existing direct callers in tests still compile. In Wrap mode,
skip the intersection branch, or skip adding intersected elements to the result.

## Files in scope
- `packages/excalidraw/lasso/utils.ts` — mode-aware selection (containment vs intersection)
- `packages/excalidraw/lasso/index.ts` — pass `this.app.state.boxSelectionMode` into the util
- `packages/excalidraw/tests/lasso.test.tsx` — both-mode coverage; pin existing intersection
  cases to overlap
- `packages/excalidraw/tests/selection.test.tsx` — UI-level lasso tests in both modes
- `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` — only if a snapshot shifts
- `packages/excalidraw/CHANGELOG.md` — companion: note the behaviour change under Unreleased

## Files off-limits
- Project defaults from `.sdlc/project.json` (`.env*`, `.mcp.json`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`,
  `.sdlc/**`, `.git/**`)
- AI configs: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`
- Box-selection implementation: `packages/element/src/selection.ts`, `packages/element/src/bounds.ts`
- `packages/excalidraw/components/App.tsx`, `packages/excalidraw/appState.ts`,
  `packages/excalidraw/types.ts`, `packages/excalidraw/data/restore.ts`
- Generated files: `packages/excalidraw/types/**`, `subset/harfbuzz/harfbuzz-wasm.ts`,
  `subset/woff2/woff2-wasm.ts`, `fonts/Xiaolai/index.ts`

## Acceptance criteria
1. In Wrap mode the lasso selects only fully enclosed elements. In Overlap mode it selects enclosed
   and touched elements.
2. Polygon containment vs intersection is correct for rectangles, ellipses, rotated shapes, lines
   and freehand strokes.
3. jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` and `selection.test.tsx` cover both
   modes. They include a partially touched element that is selected only in Overlap mode.
4. Box-selection behaviour is unchanged: existing box-selection tests pass unmodified.
5. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals
- No new preference, UI control, menu label or locale text change.
- No change to the default value of `boxSelectionMode`.
- No change to box-selection code paths or the `@excalidraw/element` package.
- No change to lasso rendering, trail animation or the "add to selection" (shift) semantics, beyond
  which elements qualify.

## Gate 0 decisions (approved 2026-11-04)
- Auth mode: estimated. Policy: opus55-plus-sonnet55.
- Test command: `yarn test:app --watch=false` (+ `yarn test:typecheck`, `yarn test:code`).
- Scope frozen as listed above. Default-mode (Wrap) lasso becoming enclose-only is intended.
- `.gitignore`: not modified (`.sdlc/` is covered by `.git/info/exclude`).
