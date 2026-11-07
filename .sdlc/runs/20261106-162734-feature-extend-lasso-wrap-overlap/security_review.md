# Security Review — pass1

Mode: brownfield, intent: feature-extend. Scope: the 5 files in `provenance.json`, diffed against `git_head_before` cf212b2f.

## Summary
This run changes only client-side lasso geometry. `boxSelectionMode` now reaches `getLassoSelectedElementIds`, which gains a Wrap ("contain") branch built from polygon-inclusion and segment-intersection helpers. The run also adds tests, a CHANGELOG line and a `.gitignore` entry. The change adds no network I/O, storage, auth, serialization, HTML/DOM sinks, dynamic code execution or dependencies. The lasso path comes from the local user's own pointer input. No blocking findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Surface (availability) | packages/excalidraw/lasso/utils.ts:91-103, 214-248 | In Wrap mode, every element whose bounds pass the AABB pre-filter gets a point-in-polygon test for each outline point, then a full lasso-segment intersection test (and again for its bound text). The cost grows with elements x lasso segments. The input is local, the path is simplified, and the AABB pre-filter still runs first. This is a responsiveness risk on very large scenes, not an exploitable issue. Confidence: medium. | Optional: return early from `isCrossedByLasso` with a per-segment bounds check before calling `intersectElementWithLineSegment`. This does not block sign-off. |

## Passing checks
- PII encryption / masking / PII audit ordering: n/a — not in the touched set (no PII fields, client-only geometry).
- Route guards, role + `reports_to` checks, JWT secret, password hashing: n/a — not in the touched set.
- Audit log append-only / read roles / entry shape: n/a — not in the touched set.
- Secrets in code: none in the diff. `utils.ts`, `index.ts` and the CHANGELOG have no key, secret or password literals.
- Test fixtures (`tests/lasso.test.tsx`): synthetic coordinates and element ids only, no real credentials.
- Docs (`CHANGELOG.md`): one behavior note, no secrets or sensitive examples.
- `.gitignore`: adds `.sdlc/`, which keeps run artifacts (provenance, plans) out of commits. `.env` handling is unchanged.
- Helmet / rate limiting / error filter: n/a — not in the touched set.
- Dependencies: no manifest or lockfile in the touched set, so the dependency check was not run and the dependencies are unchanged since the baseline.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the reviewed diff.

Tool calls: 3
