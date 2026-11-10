# SDLC ledger

One row per brownfield run on this project. The machine-readable mirror is `ledger.json`.

| Run | Job | What | Outcome | Files | Spend (true / dispatched) | Branch @ base | Record |
|---|---|---|---|---|---|---|---|
| `20261109-163637-feature-new-pages` | feature-new | Pages: tabbed canvases in one drawing | accepted, uncommitted | 45 (39 modified, 6 new) | $127.03 / $5.97 (estimated, provisional) | `EX-NF-12/opus55-plus-flash38-agsdk` @ `14bb42ede` | [SUMMARY](runs/20261109-163637-feature-new-pages/SUMMARY.md) |

## 20261109-163637-feature-new-pages — notes

- **Gates:**
  - Gate 0 approved, with the estimated auth mode.
  - Gate 1 approved after one revise: pages merge one at a time, page delete can be undone, and the plan names `exportScene`.
  - Gate 2 approved after one revise: starting a room keeps every page, whole-scene loads skip page stamping, and Firestore stores pages in their own encrypted fields.
  - Gate 3 approved after three fix rounds.
  - Gate 4 accepted.
- **Architecture:** the first architect stalled after about 5 hours and handed in nothing. The person had it restarted with the page model fixed (a page id on every element, the page list in app state), narrow reading, and each section handed over as written.
- **Checks at close:**
  - `yarn test:typecheck` passed.
  - `yarn test:code` passed.
  - `yarn test:app --watch=false` passed: 151 files and 2,663 tests, against a baseline of 149 files and 2,632 tests.
- **Known follow-ups:**
  - There is no page tab bar on phones (`LayerUI.tsx` phone branch).
  - The export test passes elements that are already filtered.
  - `as any` is used in the collab tests.
  - A memo in `pages.ts` is shared module-wide.
  - Page changes received from peers are broadcast again (`Collab.tsx`).
  - `SearchMenu` compares against the raw `activePageId`.
  - Scene-embedded exports carry every page's name.
  - `initialdata.mdx` failed prettier before this run.
- **Cost:** re-run the cost collector after the session closes for the final total:
  `node "<plugin>/scripts/collect-orchestrator-usage.mjs" .sdlc/runs/20261109-163637-feature-new-pages --project-root "<repo>"`
- **Undo:** `/mmo:revert 20261109-163637-feature-new-pages`
