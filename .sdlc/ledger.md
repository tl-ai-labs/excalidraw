# SDLC run ledger

Human-readable mirror of `ledger.json`. One row per run, newest last.

| Run | Intent | Outcome | Files | Spend (USD) | Branch | Ended |
|---|---|---|---|---|---|---|
| `20261106-152507-feature-extend-arrowhead-size` | feature-extend | accepted, uncommitted | 22 | 17.43 (provisional) | `EX-FE-09/argon4-plus-flash38` | 2026-11-06 |

## 20261106-152507-feature-extend-arrowhead-size

Per-element arrowhead size: an optional `arrowheadSize` (Small 0.5 / Medium 1 / Large 1.5) on arrows and lines, with
an "Arrowhead size" control in the properties panel. Policy `argon4-plus-flash38`, vendor auth. Summary in
`runs/20261106-152507-feature-extend-arrowhead-size/SUMMARY.md`.

Known follow-ups:
- `packages/excalidraw/components/App.drawshape.ts` L194: `newArrowElement` should pass
  `arrowheadSize: app.state.currentItemArrowheadSize` (was outside this run's scope).
- `API.createElement` in `packages/excalidraw/tests/helpers/api.ts` drops `arrowheadSize`.
- After an undo back to default, `delta.ts` leaves `arrowheadSize: undefined` as an own key (harmless).
- `restore.ts` removes an invalid or default `arrowheadSize` from element objects passed in, like `rawText`.
- Two orphan `utils.test.ts.snap` files may be flagged by a whole-suite `yarn test:update`.
- The Gate 3 fix round was reviewed in the main session, not by the plugin's reviewers.
