# Security Review — pass1

Mode: brownfield, intent `feature-extend`, run `20261109-163500-feature-extend-lasso-wrap-overlap`.
Scope: 4 files from `provenance.json`, diffed against `git_head_before` `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58`.

## Summary
This change adds wrap/overlap (`boxSelectionMode`) support to lasso selection. It is client-side geometry only. It adds a `containmentTest` in `packages/excalidraw/lasso/utils.ts` and passes one existing AppState field through from `packages/excalidraw/lasso/index.ts`. It touches no network, storage, auth, PII, serialization, dependency or config code. The two test files contain only geometry fixtures. The change introduces no security findings. Gate 3 is not blocked.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Surface (client CPU) | packages/excalidraw/lasso/utils.ts:154 (`containmentTest`) | `polygonFromPoints(lassoPath)` is rebuilt for every candidate element. This is bounded by the existing AABB pre-check and the per-stroke `enclosedElements`/`intersectedElements` caches, and the work is the same order as the existing `enclosureTest`. It costs local CPU only and is not exploitable. Confidence: high. | Optional: build the lasso polygon once per call to `getLassoSelectedElementIds` and pass it in. Not required for sign-off. |

## Passing checks
- Secrets: no keys, tokens or passwords appear in the diff, in source or in test fixtures. The fixtures are rectangle, ellipse, line, freedraw and text coordinates only.
- Locked elements: still excluded in wrap mode (the `unlockedElements` filter is unchanged, and the test "locked element stays unselected in wrap mode" covers it).
- Input handling: the new code reads `boxSelectionMode` from AppState and passes it straight through. It does not touch the DOM, eval or HTML, and it does not parse any untrusted input.
- Dependency risk: unchanged. No manifest or lockfile is in the touched set, so `npm audit` was not run.
- PII handling (encryption, masking, audit-before-access): n/a, not in the touched set.
- Authn and authz (guards, `reports_to`, JWT secret, password hashing): n/a, not in the touched set.
- Audit log integrity: n/a, not in the touched set.
- `.env.example` / `.env` gitignore: n/a, not in the touched set.
- Helmet, rate limiting, global error filter: n/a, not in the touched set (client-side library code).

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the touched hunks.

Tool calls: 3
