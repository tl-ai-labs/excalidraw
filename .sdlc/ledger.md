# SDLC run ledger

| Run | Intent | Outcome | Policy | Auth | Cost (USD, provisional) | Files | Tests (app) | Open items |
|---|---|---|---|---|---|---|---|---|
| 20261106-feature-new-drawing-pages | feature-new | accepted 2026-11-06 | opus55-plus-flash38 | estimated | 142.12 (architect 115.24) | 52 (45 edited, 7 new), uncommitted | 2713/2716 pass; typecheck + lint pass | FR-21/AC-3 undo not per page; 2 pages.test.tsx test fixes blocked |
| 20261106-234850-test-pages-failing-tests | test | accepted 2026-11-07 | opus55-plus-flash38 | estimated | 4.79 (dispatched 0.07) | 1 (pages.test.tsx), uncommitted | 2668/2668 pass; typecheck + lint pass | none — resolves the previous run's open items (all 3 were test defects; per-page undo works) |
