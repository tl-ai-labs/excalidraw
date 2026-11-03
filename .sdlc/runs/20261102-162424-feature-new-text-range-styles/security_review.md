# Security Review — pass1 (brownfield, feature-new: text-range-styles)

Scope: the 28 files in `provenance.json` (git_head_before `14bb42ed`). Edited files were read as diffs and new files in full. Outside the diff, only `applyDarkModeFilter` (packages/common/src/colors.ts) and the collab/firebase `restoreElements` call sites were checked.

## Summary
This change is client-side only: a new `styleRanges` field on text elements, two colour-picker actions, canvas and SVG rendering, and a transient `appState.textEditorSelection`. No server, auth, PII or audit code is touched. Untrusted input is handled well. `restoreStyleRanges` builds new objects from named fields only, so nothing is spread from input and prototype pollution is not possible. It also checks that offsets are integers, clamps them to `originalText.length`, and `restore.ts` replaces the raw value with the normalized one. In SVG, run text goes through `textContent` and colours through `setAttribute`, so there is no markup injection. `textEditorSelection` is set to `browser/export/server: false`, so it is never saved, exported or synced. The one real problem: the number of ranges and the length of colour strings have no limit, and normalization is O(ranges x boundaries). A crafted scene (shared link, collab peer, or a file the user opens) can therefore freeze the tab of anyone who loads it.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Input validation / client DoS | packages/element/src/textRanges.ts:257-288 (`restoreStyleRanges`), :65-138 (`normalizeStyleRanges`), :350 (`rangeAt` in `splitRangesIntoLines`) | Untrusted `styleRanges` are accepted with no limit on count. Normalization fills a segment span for every range, which is O(N·L) with up to L+1 distinct boundaries. `rangeAt` does a linear `find` for every character on every SVG export or canvas regeneration. This runs inside `restoreElements` for collab broadcasts (excalidraw-app/collab/Collab.tsx:782) and firebase loads. For example, a 10k-char text with 100k ranges is about 1e9 steps on the main thread for every peer. Confidence: medium-high from reading the code; not measured. | In `restoreStyleRanges`, cap the input array (for example drop everything beyond `originalText.length` entries, or a fixed maximum such as 10k) before normalizing. In `splitRangesIntoLines`, replace the per-character `find` with a moving pointer over the sorted ranges. |
| Low | Input validation | packages/element/src/textRanges.ts:273-280; packages/excalidraw/renderer/staticSvgScene.ts:~829,~860 (`fill`); packages/element/src/renderElement.ts:~722,~734 (`fillStyle`) | `color` and `highlight` only need to be non-empty strings of any length. They are written to SVG `fill` (where a value like `url(...)` can reference a paint server), assigned to canvas `fillStyle`, and used as keys in the dark-mode colour cache. `setAttribute` escapes the value, so this is not XSS, and existing `strokeColor` has the same behaviour. | Cap the string length (for example 64) and, if possible, accept only values that parse as colours (`tinycolor(x).isValid()`) in `restoreStyleRanges` and `normalizeStyleRanges`. |

## Passing checks
- Secrets: the regex grep over the touched sources and the CHANGELOG found nothing. No credentials, tokens or URLs in the new or edited tests or fixtures. Snapshot additions are only `"textEditorSelection": null,`.
- Untrusted-data hygiene: offsets must be integers and are clamped to text length. Output objects are built from named fields only (no spreading of input). `restore.ts` deletes the raw `styleRanges` before setting the normalized value. `newTextElement` normalizes `opts.styleRanges`.
- SVG output: run text uses `textContent` and attributes use `setAttribute` (no `innerHTML`).
- Transient state: `textEditorSelection` is excluded from browser storage, export and server sync, and is cleared on submit. Its listeners are removed in cleanup.
- Collab integrity: `withStyleRanges` increments `version` and `versionNonce`, so reconciliation sees the change.
- Docs (CHANGELOG.md, en.json): no secrets in the examples.
- PII encryption, masking, audit log, guards, `reports_to`, JWT, password hashing, Helmet, rate limiting, error filter: n/a, not in the touched set (client-side library, no server code).
- `.env.example` / `.env`: n/a, not in the touched set.
- Dependency risk: no manifest or lockfile touched, so dependencies are unchanged and `npm audit` was not run.

## Required fixes before sign-off
- Cap the `styleRanges` count, and the length of `color` / `highlight` strings, in `restoreStyleRanges` (packages/element/src/textRanges.ts), so a crafted scene from a shared link or collab peer cannot freeze clients. (Medium; whether it blocks is the Gate 3 decision.)
- Optional (Low): validate that colours parse as colours, and use a moving pointer instead of the per-character `find` in `splitRangesIntoLines`.

## Noted (pre-existing, out of scope)
- The existing `restoreElement` accepts any string for `strokeColor` and `backgroundColor` and writes them to SVG `fill`/`stroke`. The Low finding above has the same behaviour.

Tool calls: 5
