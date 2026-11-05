# Security Review — pass1 (brownfield, feature-extend: arrowhead size)

Scope: the 27 files listed in `provenance.json`, reviewed as `git diff 14bb42ed -- <path>`. No new files. Snapshot diffs checked: they contain only `"currentItemArrowheadSize": "medium",` lines.

## Summary
The change adds an optional `arrowheadSize` ("small" | "medium" | "large") to linear elements and a `currentItemArrowheadSize` app-state field. Both are client-side rendering properties. The only untrusted input is a loaded or shared scene, or app state read from localStorage, and the change validates both. `restoreElement` removes any `arrowheadSize` that is not a known preset (`dropInvalidArrowheadSize`, restore.ts ~L130). `restoreAppState` falls back to `"medium"` (restore.ts ~L1400). `isArrowheadSize` now accepts only the object's own keys (bounds.ts L65-67), so prototype names like `"toString"` and `"__proto__"` are rejected. Rendering is also safe on its own: `getArrowheadSizeScale` returns exactly 1 for any value it does not recognise. The scale is therefore always between 0.5 and 1.5 and never 0, so `minSize / scale` (bounds.ts L1125) cannot divide by zero and geometry cannot blow up. The value is never written into SVG or HTML as a string; only the numeric scale reaches the path data, so it cannot be used for injection. No secrets, credentials or dependency changes were found. Nothing blocks sign-off.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Input validation | packages/excalidraw/actions/actionStyles.ts ~L196 | Paste-styles copies `elementStylesToCopyFrom.arrowheadSize` without checking it. The source is the in-app copied-styles buffer, not external input, and the renderer treats unknown values as 1, so there is no impact. | Optional: use `isArrowheadSize(x) ? x : DEFAULT_ARROWHEAD_SIZE` so a bad value is never stored on an element. Not blocking. |
| Info | Input validation | packages/excalidraw/actions/actionProperties.tsx L567-581 | `actionChangeArrowheadSize.perform` only asserts that `value` is truthy. A host app calling `executeAction` directly could store any string. The renderer is safe and restore removes the value on the next load. | Optional: assert with `isArrowheadSize(value)` instead of a truthy check. Not blocking. |

## Passing checks
- PII handling (encryption, masking, audit before access): n/a, not in the touched set (client-side drawing library, no PII fields).
- Authn/authz (guards, `reports_to`, JWT secret, password hashing): n/a, not in the touched set (no routes or auth code).
- Audit log integrity: n/a, not in the touched set.
- Untrusted scene/app-state input: passing. Restore validates `arrowheadSize` against an own-key allowlist on both arrows and lines, and `currentItemArrowheadSize` restores to `"medium"` when invalid. Covered by restore.test.ts.
- Prototype-key acceptance: passing (`Object.prototype.hasOwnProperty.call`, bounds.ts L67).
- Numeric robustness/DoS: passing. Scale is limited to 0.5–1.5 and never 0.
- Output injection (SVG/DOM): passing. No string interpolation of the value. Labels come from en.json.
- Storage scope: passing. `currentItemArrowheadSize` is browser-only (`export: false, server: false`), so it is not sent to the server or included in exports.
- Secrets in committed code: passing. Diff checked for key/secret/password assignments; none found in src, tests, CHANGELOG or en.json.
- Test fixtures (restore.test.ts, export.test.ts, bounds.test.ts, shape.test.ts, helpers/api.ts): passing. No real credentials.
- Docs (CHANGELOG.md): passing. No secrets in examples.
- `.gitignore`: passing. Adds `.sdlc/` (keeps run artifacts out of commits). `.env.example`/`.env`: unchanged, not in the touched set.
- Helmet / rate limiting / global error filter: n/a, not in the touched set (no server surface).
- Dependency risk: unchanged. No manifest or lockfile in the touched set, so `npm audit` was not re-run.

## Required fixes before sign-off
- None. Both findings are informational and optional.

Tool calls: 5
