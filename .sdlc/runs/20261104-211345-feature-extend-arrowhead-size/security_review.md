# Security Review — pass1

Mode: brownfield, intent feature-extend, scope = 19 files from `provenance.json` (`git_head_before` 14bb42ed). 14 edited source/locale files, 5 test files (1 new: `packages/excalidraw/tests/arrowheadSize.test.tsx`).

## Summary
The change adds an optional `arrowheadSize` ("small" | "medium" | "large") to linear elements in a client-side drawing editor. It adds no server routes, auth, PII, persistence layer, secrets or dependencies. The one place it has security relevance is untrusted input: scene files, collab payloads and pasted styles can now carry `arrowheadSize`. That input is handled safely. `isArrowheadSize` checks against an own-property allow-list (`hasOwnProperty.call(ARROWHEAD_SIZE_SCALE, value)`), so prototype keys such as `__proto__` and `toString` are rejected. `restore.ts` drops invalid values from a shallow copy of the element (line 560 copies the element; line 271 deletes the field). The collab ingestion path (`excalidraw-app/collab/Collab.tsx:782`) runs `restoreElements`. As a second layer, `getArrowheadSizeScale` re-checks the value when rendering and falls back to 1. Arrowheads can grow by at most 1.5x, so a crafted value cannot blow up bounds, canvas padding or memory. No blocking findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| — | — | — | No findings introduced by this run. | — |

## Passing checks
- Input validation: unknown, numeric and prototype-key `arrowheadSize` values are dropped in `packages/excalidraw/data/restore.ts` (`restoreArrowheadSize`) and ignored at render time in `packages/element/src/bounds.ts` (`getArrowheadSizeScale`). Tests cover this in `restore.test.ts` and `bounds.test.ts`.
- Paste styles (`packages/excalidraw/actions/actionStyles.ts`): copies the value only after `isArrowheadSize` passes. The clear branch uses `delete` on a new copy from `newElementWith`, never on the source element.
- Action input (`actionChangeArrowheadSize` in `packages/excalidraw/actions/actionProperties.tsx`): the value comes from a fixed three-option radio button, and `invariant` guards it.
- Resource bounds: canvas padding is capped at 60 and the bounds expansion only runs for scale > 1 (max 1.5). There is no denial-of-service risk from crafted values.
- Secrets: a grep of all 19 touched files for `(api_key|secret|password|token)=<literal>` found no matches.
- Test fixtures: no real credentials. The fixtures contain only geometry, element ids such as `"old-arrow"`, and arrowhead values.
- Locale strings (`en.json`): plain labels only, with no markup or secrets.
- Dependencies: no manifest or lockfile in the touched set. Unchanged; `npm audit` not run.
- PII encryption, response masking, audit-log ordering and integrity: n/a, not in the touched set (no PII fields or audit table).
- Route guards, `reports_to` authz, JWT secret, password hashing: n/a, not in the touched set (no server routes or auth).
- `.env.example` / `.env` gitignore: n/a, not in the touched set.
- Helmet, auth rate limiting, global error filter: n/a, not in the touched set (client-side library code only).

## Required fixes before sign-off
- None.

Tool calls: 5
