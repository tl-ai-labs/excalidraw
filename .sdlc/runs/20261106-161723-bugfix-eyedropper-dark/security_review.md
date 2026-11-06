# Security Review — pass1 (brownfield, bugfix: eyedropper dark theme)

## Summary
Scope: the 4 files in `provenance.json` (diff against `4872083c`). The change only touches client-side color math and the EyeDropper component. It adds `reverseDarkModeFilter` (pure, bounded at 27 candidate evaluations plus one lazily built 256-entry table) and, in dark theme, a hit-test against scene elements to recover the stored color. No new network I/O, storage, auth surface, `dangerouslySetInnerHTML`, `eval`, or new dependencies. `pickedColor` can only be (a) a stored element or background color whose dark-filtered value exactly equals the hex screen pixel, or (b) the `rgbToHex` output, so it is no less trusted than color values already present in the scene. The preview `style.background` still comes from `screenColor` (`rgbToHex` output). No security findings block Gate 3.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Availability / perf (non-blocking) | packages/excalidraw/components/EyeDropper.tsx (`getCurrentColor`, ~L116-138) | In dark theme, every pointermove runs `hitElementItself` over all non-deleted elements (O(n) with geometry tests). Very large scenes could make the eyedropper janky. This is local to the user, so it is not a security boundary. Confidence: medium. | Optional: run the hit-test only on pointerdown/up, or throttle it with rAF. Not required for sign-off. |

## Passing checks
- PII encryption / masking / audit-before-access: n/a, not in the touched set (no PII fields, serializers, or audit tables).
- Authn/authz guards, `reports_to`, JWT secret, password hashing: n/a, not in the touched set (client-only UI and util code).
- Audit log integrity: n/a, not in the touched set.
- Secrets: no hardcoded key, secret, or password literals in the 4 touched files. Test fixtures (`colors.test.ts`, `eyeDropper.test.tsx`) hold only color hex values and contain no real credentials.
- `.env.example` / `.env` gitignore: n/a, no config files touched.
- Helmet / rate limiting / error filter: n/a, no server surface touched.
- Injection: no new DOM sinks. `style.background` gets an `rgbToHex` string, and `reverseDarkModeFilter` returns invalid input unchanged without evaluating it (tinycolor `isValid` guard).
- Dependency risk: no manifest or lockfile in the touched set, so `npm audit` was not re-run (unchanged). The new imports (`@excalidraw/element`, `@excalidraw/math`) are existing workspace packages.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the reviewed diff.

Tool calls: 3
