# Requirements (delta) — feature-extend — Lasso honours Wrap/Overlap box-selection mode

Run: `20261104-120000-feature-extend-lasso-wrap-overlap` · Source: `intent_brief.md` (excalidraw/excalidraw#11809), `discovery.md`.

## Baseline (what exists today)

- `appState.boxSelectionMode: "contain" | "overlap"` (default `"contain"` = Wrap) is honoured by rectangle box selection only (`getElementsWithinSelection` → `elementsOverlappingBBox` in `@excalidraw/element`).
- The free-form lasso (`getLassoSelectedElementIds` in `packages/excalidraw/lasso/utils.ts`, called from `LassoTrail.updateSelection` in `packages/excalidraw/lasso/index.ts`) returns intersected ∪ enclosed elements, i.e. always behaves like Overlap.

## In scope

1. Make `getLassoSelectedElementIds` mode-aware through a new **optional** input carrying the box-selection mode; omitted means today's Overlap behaviour.
2. Have `LassoTrail.updateSelection` pass `this.app.state.boxSelectionMode` into the util.
3. Extend `packages/excalidraw/tests/lasso.test.tsx` with both-mode coverage and pin existing intersection-dependent cases to Overlap.
4. Extend `packages/excalidraw/tests/selection.test.tsx` with UI-level lasso tests in both modes (update its snapshot file only if a snapshot shifts).
5. Note the behaviour change in `packages/excalidraw/CHANGELOG.md` under Unreleased.

## Out of scope

1. Any new preference, UI control, menu label or locale string.
2. Changing the default of `boxSelectionMode` (stays `"contain"`).
3. Any change to box-selection code paths, `App.tsx`, `appState.ts`, `types.ts`, `data/restore.ts`, or the `@excalidraw/element` package.
4. Lasso rendering, trail animation, or shift ("add to selection") semantics beyond which elements qualify.
5. `.gitignore` (the person chose not to modify it; `.sdlc/` is covered by `.git/info/exclude`).

## Functional requirements — module `lasso`

- **FR-1** `getLassoSelectedElementIds` accepts an optional mode input typed as the existing `BoxSelectionMode` (`"contain" | "overlap"`, imported as a type only; `types.ts` is not edited). When omitted, the result is identical to today's (intersected ∪ enclosed).
- **FR-2** In `"contain"` (Wrap) mode, the util returns only elements fully enclosed by the lasso polygon; an element that the lasso path merely intersects is not returned. The intersection test may be skipped entirely in this mode.
- **FR-3** In `"overlap"` mode, the util returns elements that are enclosed **or** intersected by the lasso path (today's behaviour, unchanged).
- **FR-4** `LassoTrail.updateSelection` passes `this.app.state.boxSelectionMode` to the util on every selection update, so a lasso drawn in the app follows the current preference.
- **FR-5** Enclosure vs intersection semantics are correct for rectangles, ellipses, diamonds, rotated shapes, lines/arrows and freehand strokes, reusing the existing enclosure and intersection tests of the lasso util (no new geometry where the existing tests already decide the case).
- **FR-6** Overlap mode: post-processing in `selectElementsFromIds` (groups, frames and their children, bound-text containers) is unchanged. Wrap mode mirrors box selection's `"contain"` semantics (`elementsOverlappingBBox` in `packages/element/src/bounds.ts`, read as reference, not edited): (a) a group is selected only when **every** member of the group qualifies (box selection's `group.every` check); a group with any unenclosed member contributes none of its members through group expansion; (b) a frame child is tested against its outline **clipped to its frame's bounds**, as box selection clips a child's bounds to its frame, so the part hidden outside the frame does not need to be enclosed; (c) bound-text labels are handled as box selection handles them. The shift/add-to-selection behaviour is unchanged in both modes.
- **FR-7** Existing lasso tests that rely on intersection run in Overlap mode (pinned explicitly) or are rewritten to assert the Wrap result; no existing assertion is silently weakened.
- **FR-8** `packages/excalidraw/CHANGELOG.md` gains an Unreleased entry stating that the lasso now honours the Wrap/Overlap preference and that the default (Wrap) lasso is enclose-only.

## Non-functional requirements

- **NFR-1** No public API break: the new util input is optional; existing direct callers compile unchanged.
- **NFR-2** Wrap mode does no more per-element work than today's lasso (which runs enclosure and then intersection on every candidate). Correctness comes first: Wrap mode must not select an element that a lasso edge cuts across, even when all of the element's outline points lie inside a concave lasso. Running the intersection test on Wrap candidates to reject such elements is allowed, since today's lasso already runs it.
- **NFR-3** Code follows the repo's TypeScript strict settings, ESLint and Prettier (`yarn test:code`, `yarn test:other` style), and `.github/copilot-instructions.md` performance-first guidance.

## PII inventory

None. The change touches client-side geometry/selection only; no personal data is read, stored or transmitted.

| Field | Sensitivity | Protection |
|---|---|---|
| — | — | — |

## Role matrix

Not applicable: a single local editor user; no roles, resources or authorization.

| Role | Resource | Action |
|---|---|---|
| Editor user | canvas elements | select (lasso) |

## Acceptance criteria

- **AC-1** In Wrap (`"contain"`) mode the lasso selects only fully enclosed elements; in Overlap mode it selects enclosed and touched elements.
- **AC-2** Containment vs intersection is correct for rectangles, ellipses, rotated shapes, lines and freehand strokes (covered by tests in `lasso.test.tsx`).
- **AC-3** jsdom tests in `packages/excalidraw/tests/lasso.test.tsx` and `packages/excalidraw/tests/selection.test.tsx` cover both modes, including a partially touched element that is selected only in Overlap mode.
- **AC-4** Box-selection behaviour is unchanged: existing box-selection tests (e.g. "box-selection overlap mode" in `selection.test.tsx`) pass unmodified.
- **AC-5** The full, unscoped project checks pass: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (the whole Vitest suite, not a subset of files). This is the acceptance gate. The scoped command `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx` may be used only as an inner development loop (e.g. as a per-file check while typing); it does not satisfy AC-5.
- **AC-6** Calling `getLassoSelectedElementIds` without the mode input yields today's (Overlap) result.

## Assumptions / open questions for HITL

- **A-1** (from Gate 0) Default-mode (Wrap) lasso becoming enclose-only is the intended behaviour change.
- **A-2** In Wrap mode a frame is selected by the lasso only when the frame element itself is fully enclosed, as in box selection's `"contain"` mode. A frame child is tested on its outline clipped to its frame's bounds (FR-6 b), mirroring box selection. No divergence from box selection's contain semantics is accepted for frames.
- **A-3** Bound-text labels: in Overlap mode they follow their container through the existing `selectElementsFromIds` logic. In Wrap mode they follow box selection (the architect's Gate 2 plan skips bound-text labels in contain mode, so a container qualifies only by its own outline); this refinement was presented at Gate 2 and not objected to in the Gate 2 revise.

## Revision log

- **Gate 1, rev 1 (2026-11-04):** AC-5 changed from a two-file scoped test run to the full, unscoped `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
- **Gate 2, revise 1 (2026-11-04):** the person required Wrap mode to mirror box selection's contain semantics where the first plan diverged. FR-6 now requires (a) the group `every`-member rule and (b) frame children tested on their outline clipped to the frame; NFR-2 now puts correctness first (no Wrap selection of an element a concave lasso edge cuts across; intersection may run on Wrap candidates); A-2 accepts no frame divergence; A-3 records the bound-text refinement from the plan.
