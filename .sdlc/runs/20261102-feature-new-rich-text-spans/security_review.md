# Security Review — pass1

Mode: brownfield, intent feature-new, run `20261102-feature-new-rich-text-spans`. Scope: the 21 files in `provenance.json` (`git_head_before` 14bb42ed). Edited files were reviewed as diffs and the 2 new files in full.

## Summary
The change adds an optional `styleRanges` field to text elements. This is a client-side rendering feature. It adds no server routes, auth, PII, audit tables, secrets or dependencies. Untrusted input reaches the new code through `restoreElement`, which runs on loaded files, collab peers and Firebase scenes. That input goes through `sanitizeStyleRanges`, which checks types, keeps only integer offsets and non-empty colour strings, clamps to the text length, and drops unknown keys. The SVG export writes run text through `textContent` and colours through `setAttribute("fill")`, so there is no markup injection. The added lines contain no `innerHTML`, `eval`, style-string or network sinks. One low-severity robustness issue was found: crafted input can trigger quadratic work during sanitisation. Nothing blocks Gate 3.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Surface / DoS | `packages/element/src/textStyleRanges.ts:141-186` (`sanitizeStyleRanges`) → `:72-105` (`normalizeStyleRanges`) | The number of incoming ranges has no cap. Normalisation is O(points × ranges) because every segment rescans all valid ranges. A crafted `.excalidraw` file, shared link or collab peer (`excalidraw-app/collab/Collab.tsx:782` → `restoreElements`) could send around 10^5 tiny ranges, and the receiving tab would hang inside `restoreElement`. After normalisation the count is bounded by `originalText.length`, but input that has not been normalised yet is not. Confidence: high (read from the code, not benchmarked). | In `sanitizeStyleRanges`, stop collecting once `kept.length` exceeds `textLength` (or a fixed cap such as 10k). Optionally, make `normalizeStyleRanges` a sorted sweep so its cost stays linear. |
| Info | Input validation | `packages/element/src/textStyleRanges.ts:163-172` | Colour strings are only checked for being non-empty strings: no length or format check. They go into SVG `fill` and canvas `fillStyle`. This matches the existing handling of `element.strokeColor`, so it opens no new injection path. | Optional: limit colour string length, or validate it as a CSS colour, in the same place `strokeColor` is restored. |

## Passing checks
- PII encryption, response masking, audit-log ordering and integrity: n/a — not in the touched set (no PII fields, serializers or audit tables).
- Route guards, `reports_to` authz, JWT secret, password hashing: n/a — not in the touched set (no server or auth code).
- Untrusted-input sanitisation: `restore.ts` runs `styleRanges` through `sanitizeStyleRanges`, and removes the key when it is absent.
- XSS in SVG export: `staticSvgScene.ts` uses `textContent` for `<tspan>` text and `setAttribute` for `fill`, `x`, `y`, `width` and `height`. No HTML sinks were added.
- `textWysiwyg.tsx`: only reads `selectionStart` and `selectionEnd` through a registered getter, which is unregistered on cleanup. No DOM injection.
- Secrets: the grep found no key, secret, password or token literals in any added line.
- Test fixtures (`textStyleRanges.test.ts`, `newElement.test.ts`, `textWysiwyg.test.tsx`, `restore.test.ts`, `reconcile.test.ts`, `export.test.ts`): no real credentials.
- Docs (`CHANGELOG.md`): no secrets in examples.
- `.gitignore`: adds `.sdlc/`, which keeps run artifacts out of commits. `.env` handling: n/a — not in the touched set.
- Helmet, auth rate limiting, global error filter: n/a — not in the touched set (client library).
- Dependencies: no manifest or lockfile was touched, so they are unchanged and `npm audit` was not re-run.

## Required fixes before sign-off
- None blocking. Recommended: cap the input length in `sanitizeStyleRanges` (the Low finding above).

Tool calls: 8
