# Security Review — pass1

Mode: brownfield · intent: bugfix · run: 20261105-120000-bugfix-eyedropper-dark-theme · baseline: 4872083c

Scope (from provenance.json, reviewed as `git diff 4872083c -- <path>`):
- packages/common/src/colors.ts (source, full checklist)
- packages/excalidraw/components/EyeDropper.tsx (source, full checklist)
- packages/common/src/colors.test.ts (test, fixture-credential check)
- packages/excalidraw/tests/eyeDropper.test.tsx (test, fixture-credential check)

## Summary
The change only touches client-side color handling. It adds `revertDarkModeFilter`, a pure function that maps a dark-mode pixel back to the color it was drawn with, and makes the eyedropper call it. Nothing in the change reaches the network, storage, auth, PII or the DOM through HTML sinks. Inputs are color strings that tinycolor validates (invalid input comes back unchanged), and the output is always a 6-digit `#rrggbb` built by `rgbToHex`, so no attacker-controlled string gets out of the function. Element colors from the scene are used only for comparison and are never inserted into markup. No secrets are in the source or tests. There are no security findings, so nothing blocks Gate 3. One performance note is below and does not affect sign-off.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info (non-blocking, not security) | Availability / perf | packages/excalidraw/components/EyeDropper.tsx:108-115 (called from mousemove at :140) | In dark theme, every mousemove builds a candidate set from all scene elements and tries each one with `tinycolor` plus `applyDarkModeFilter`. On very large scenes this costs O(elements) per mouse move. The work stays in the user's own tab, so it is not a security issue. | Optional: build the candidate set once per eyedropper session, or cache the filtered value for each candidate (for example a `Map` in `useMemo` keyed on `elements`). |

## Passing checks
- PII encryption / masking / audit-before-access: n/a — not in the touched set (no PII fields, serializers or persistence).
- Route guards, role + `reports_to` checks: n/a — no routes or controllers touched.
- JWT secret / password hashing: n/a — not in the touched set.
- Audit log append-only / read-only to auditor / entry fields: n/a — not in the touched set.
- Secrets in code: secret-pattern grep across all 4 touched files returned no matches. Test fixtures contain only hex colors, with no credentials.
- `.env.example` / `.env` gitignore: n/a — no config files touched.
- Helmet, auth rate limiting, global error filter: n/a — no server surface touched.
- Input handling: `revertDarkModeFilter` validates with `tinycolor().isValid()`, skips transparent or invalid candidates, and returns a fixed-format hex string. No injection sink.
- Dependency risk: unchanged. No manifest or lockfile in the touched set, so `npm audit` was not run.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the touched diff.

Tool calls: 5
