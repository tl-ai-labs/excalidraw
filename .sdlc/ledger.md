# SDLC Ledger

| Run | Intent | Outcome | Policy | Auth | Files | Tests | Cost (USD) | Ended |
|---|---|---|---|---|---|---|---|---|
| 20261102-144102-feature-new-text-range-styles | feature-new | aborted (architecture stalled; restarted) | opus55-only | estimated | 0 | — | not collected | 2026-11-02 |
| 20261102-162424-feature-new-text-range-styles | feature-new | accepted | opus55-only | estimated | 28 (25 edited, 3 new) | 2683/2683 (151 files) | 6.85 dispatched + 43.54 overhead (provisional) = 50.38 | 2026-11-03 |

Run 20261102-162424: per-range text colour and highlight on text elements (canvas, SVG tspans, restore, collab, undo). Changes are uncommitted on branch `EX-NF-11/opus55-only` at base 14bb42ed; `/mmo:revert 20261102-162424-feature-new-text-range-styles` undoes them. Known open item: duplicated code in the two new range actions (minor; kept by the user's choice at Gate 3).
