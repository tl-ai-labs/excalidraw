# Intent Brief — feature-extend — Lasso honours boxSelectionMode (Wrap / Overlap)

> **Gate 0 approved** (revision 2). Auth mode: `estimated`. Policy: `opus55-plus-flash38-agsdk`.
> Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
> `.gitignore` not changed (`.sdlc/` already covered by the shared `.git/info/exclude`).
> No CHANGELOG entry (not requested). Write contract frozen with the allowlist and off-limits below.

## Context

### User's brief (verbatim — the user's own words; supersedes the earlier auto-filled interview answers)

```text
Module: the lasso tool, packages/excalidraw lasso/index.ts and lasso/utils.ts. Reported in excalidraw/excalidraw#11809.

New capability: the lasso honours appState.boxSelectionMode. In Wrap mode an element must be fully enclosed by the lasso; in Overlap mode touching it is enough. Read how box selection already implements both modes.

Before: with the preference set to Wrap, a lasso drawn that only clips the corner of a rectangle still selects it.
After: the same lasso leaves that rectangle unselected in Wrap mode and selects it in Overlap mode.

Constraints: needs polygon containment versus intersection for rectangles, ellipses, rotated shapes, lines and freehand strokes. Existing box-selection behaviour must not change.

Acceptance criteria: jsdom tests in packages/excalidraw/tests/lasso.test.tsx and selection.test.tsx cover both modes, including a partially touched element selected only in Overlap mode; yarn test:typecheck, yarn test:code and yarn test:app pass.
```

### Code facts (from reading the repo — not the user's words)

- The preference is `appState.boxSelectionMode: "contain" | "overlap"` (`packages/excalidraw/types.ts:280`),
  default `"contain"` (`packages/excalidraw/appState.ts:132`), shown in Preferences as
  "Select on: Wrap / Overlap" (`components/main-menu/DefaultItems.tsx:443`, `locales/en.json:192-194`).
  `"contain"` = Wrap, `"overlap"` = Overlap.
- Box selection: `App.tsx:11306` passes `this.state.boxSelectionMode` to `getElementsWithinSelection`
  (`packages/element/src/selection.ts:70`), which calls `elementsOverlappingBBox`
  (`packages/element/src/bounds.ts`). There, Wrap selects an element when the box wraps the element's
  AABB unioned with its bound-text label's AABB; Overlap additionally selects when the box touches the
  label or the element's outline (linear / freedraw by their points, other shapes by outline
  intersection).
- Lasso today: `LassoTrail.updateSelection` (`lasso/index.ts`) calls `getLassoSelectedElementIds`
  (`lasso/utils.ts`), which selects an element if *any* of its outline points is inside the lasso
  polygon (`enclosureTest`) or the lasso path crosses its outline or bound-text label
  (`intersectionTest`) — i.e. always Overlap, regardless of the preference.
- Outline segments come from `getElementLineSegments` (`packages/element/src/bounds.ts:299`), which
  already handles rectangles, diamonds, ellipses, text, lines/arrows and freedraw, with `element.angle`
  applied (rotated shapes).
- Upstream: issue #11809 was closed by PR #11862 (merged 2026-08-10, touching `lasso/index.ts`,
  `lasso/utils.ts`, `tests/lasso.test.tsx`, `tests/selection.test.tsx`). This branch's HEAD
  (`cf212b2f3`, 2026-08-08) predates it; the fix is not present here. This run implements the change
  independently and does not read the upstream diff.

## Goal

The lasso honours `appState.boxSelectionMode`, mirroring box selection:

- **Overlap** (`"overlap"`): an element touched by the lasso is selected — lasso path crosses its
  outline (or its bound-text label), or the element lies inside the lasso. This is today's lasso
  behaviour.
- **Wrap** (`"contain"`): an element is selected only when it is fully enclosed by the lasso polygon.
  A lasso that only clips part of an element (e.g. the corner of a rectangle) leaves it unselected.
- Containment vs intersection must be correct for rectangles, ellipses, rotated shapes, lines and
  freehand strokes.
- Mirroring box selection (derived from "Read how box selection already implements both modes"): an
  element's bound-text label counts as part of the element — in Wrap the label must be enclosed too; in
  Overlap touching the label is enough.
- The lasso reads the current `boxSelectionMode` on each selection update, so switching the
  preference takes effect on the next lasso stroke.
- Consequence to note (derived): the default is `"contain"`, so users who never changed the preference
  will see the lasso switch from Overlap-like to Wrap behaviour.

## Files in scope

- `packages/excalidraw/lasso/utils.ts` — mode-aware selection in `getLassoSelectedElementIds`:
  full-containment test for Wrap, existing enclose-or-intersect path for Overlap.
- `packages/excalidraw/lasso/index.ts` — pass `this.app.state.boxSelectionMode` from
  `LassoTrail.updateSelection`.
- `packages/excalidraw/tests/lasso.test.tsx` — both modes: existing cases keep their Overlap
  expectations; add Wrap cases (partially touched element selected only in Overlap; fully enclosed
  element selected in both), across rectangles, ellipses, rotated shapes, lines and freehand strokes.
- `packages/excalidraw/tests/selection.test.tsx` — pointer-driven lasso cases (through the lasso tool,
  not the util) covering both modes, including the Before/After corner-clip rectangle.

## Files off-limits

- Box selection, must not change: `packages/element/src/bounds.ts`, `packages/element/src/selection.ts`.
- App and state: `packages/excalidraw/components/App.tsx`, `packages/excalidraw/appState.ts`,
  `packages/excalidraw/data/restore.ts`, `packages/excalidraw/types.ts`.
- `packages/excalidraw/locales/**`, `packages/excalidraw/tests/__snapshots__/**`.
- Generated / build: `packages/excalidraw/types/**`, `dev-dist/**`.
- Other workspaces: `excalidraw-app/**`, `examples/**`.
- AI configs: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`.
- Project defaults: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
  `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`.

## Acceptance criteria

From the user's brief:

1. With the preference set to Wrap, a lasso that only clips the corner of a rectangle leaves it
   unselected; the same lasso selects it in Overlap mode.
2. jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx`
   cover both modes, including a partially touched element selected only in Overlap mode.
3. Containment vs intersection is handled for rectangles, ellipses, rotated shapes, lines and freehand
   strokes.
4. Existing box-selection behaviour does not change.
5. `yarn test:typecheck`, `yarn test:code` and `yarn test:app` pass.

## Non-goals

(First bullet from the user's brief; the rest are scoping inferences — the brief asks for none of them.)

- No change to rectangle box selection (`elementsOverlappingBBox`, `getElementsWithinSelection`).
- No new preference or lasso-only setting; no UI, label or translation change.
- No porting or reading of the upstream PR #11862 diff.
