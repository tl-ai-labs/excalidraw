# Security Review — pass1

Mode: brownfield, intent bugfix, run 20261109-bugfix-eyedropper-dark-theme. Scope is the 6 files in `provenance.json` (`git_head_before` 4872083c), reviewed as `git diff`.

## Summary
The change is client-side colour math only. It adds `revertDarkModeFilter` and `matchDarkModeColor` in `packages/common/src/colors.ts`, wires them into `EyeDropper.tsx` when the dark theme is on, exports `revertDarkModeFilter` from `packages/excalidraw/index.tsx`, and adds a CHANGELOG entry and tests. The diff has no network calls, storage, auth, PII, secrets, `eval`, `dangerouslySetInnerHTML` or new dependencies. Colours come from the canvas pixels and from the scene's own `strokeColor`/`backgroundColor` values, and go back only into element and appState colour fields, which already take user-supplied colour strings. This change adds no blocking security findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Robustness (not a security issue) | packages/common/src/colors.ts (`matchDarkModeColor`, `isDarkModeMatch`) | `applyDarkModeFilter(c)` runs before the `tinycolor(c).isValid()` / `isTransparent` checks, so invalid scene strings still go through tinycolor parsing. tinycolor handles invalid input gracefully, and the test "skips transparent and invalid scene colours" covers this case. The cost is one parse per distinct scene colour, and the `Set` removes duplicates. Confidence high that this is not exploitable. | Optional: run the validity checks first to save the extra work. This does not block sign-off. |

## Passing checks
- PII encryption, masking and audit-before-access: n/a, not in the touched set (no PII fields or persistence).
- Route guards, role/`reports_to` checks, JWT secret, password hashing: n/a, not in the touched set (no server or auth code).
- Audit log append-only, read access and entry fields: n/a, not in the touched set.
- Secrets in code: none in the diff of any touched source, test or doc file.
- Test fixtures (`colors.test.ts`, `eyeDropper.test.tsx`): contain only hex colour literals and DOM stubs, no credentials.
- Doc (`CHANGELOG.md`): no secrets or sensitive examples, only a public GitHub issue link.
- `.env.example` / `.env` gitignore: n/a, not in the touched set.
- Helmet, rate limiting, error filter: n/a, not in the touched set (no HTTP surface).
- Dependency risk: unchanged, since no manifest or lockfile is in the touched set, so `npm audit` was not run.
- New public export `revertDarkModeFilter`: a pure function with no side effects, so it does not widen the attack surface.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the reviewed diff.

Tool calls: 3
