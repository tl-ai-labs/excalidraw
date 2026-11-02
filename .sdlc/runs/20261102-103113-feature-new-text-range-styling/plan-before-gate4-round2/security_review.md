# Security Review — pass1

Scope: brownfield, feature-new, the 31 files in `provenance.json`. All 31 hashes match `sha_after`. Base: `14bb42edee3d6fee6be264e3ee78670b3b9cee79`.

## Summary
No secrets, no script injection and no new data leak. Text and colours reach the DOM only through `textContent`, text nodes, `setAttribute` and `element.style`, and the accepted `origin.text` limit holds as written. One Medium needs fixing: a room member can stall peers' main threads for seconds at a time, repeatedly, with a small payload, because `mergeTextRanges` runs one full text diff per record with no overall budget. That falls under NFR-2 and is new in this run. Three Low findings are advisory.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Surface (availability, NFR-2) | `packages/element/src/textRangeMerge.ts:128` (with `packages/element/src/textDiff.ts:2`, `packages/element/src/textRanges.ts:222`) | `mergeTextRanges` calls `mapTextSpan` once per carried record, uncached, and each call can cost up to `MAX_DIFF_CELLS` (1M cells). The per-diff cap has no per-merge total, and `origin.text` has no length bound. With 1,024 records on one text element, 1,024 diffs took 3.1 s in Node 24 for 100-char origins against a 10,000-char text, about 110 KiB of payload; the time grows with the number of such elements. It runs synchronously inside `reconcileElements`. Forged origins never match `base`, so `origin` is kept and the cost repeats on every later reconcile, including `Collab.tsx:784` and each save at `firebase.ts:225`. `isDeleted` is not checked, so deleting the element does not stop it; only a style action or text edit on it clears the origins. Needs a room member or a crafted stored scene. | Cache hunks per distinct `reg.text` within one merge (pure, so NFR-3 is safe), and add a total cell budget per merge. Past the budget, use the single coarse hunk. Spend the budget in sorted id order so both clients get the same result. Add a test with 1,024 distinct origin texts. |
| Low | Input validation | `packages/element/src/textRanges.ts:64` | `isValidTextRangeColor` relies on tinycolor validity, and tinycolor accepts strings that merely contain a colour. Tested against the repo's `tinycolor2`: `url("https://e.vil/a.svg#rgb(0,0,0)")`, `var(--x, rgb(0,0,0))` and `rgb(0,0,0);background:url(//e.vil)` are valid; plain `url(https://e.vil/a)` is not. In the light theme `applyDarkModeFilter` returns the input unchanged, so the string reaches `fill` on `rect` and `tspan` in SVG export (`packages/excalidraw/renderer/staticSvgScene.ts`). `setAttribute` keeps it out of markup, so there is no XSS and NFR-2's markup clause holds, but the "colours are untrusted" rule is not met. Whether a browser fetches that URL from an exported SVG was not tested. `strokeColor` already reaches the same sink unvalidated (see Noted), so this adds no new capability. The restore, reconcile and export textRanges tests have no `url(` case. | Add an anchored shape check before tinycolor (hex, `rgb()/rgba()/hsl()/hsla()` with no nested parentheses, bare names), or write `colorToHex(value)` at the sinks. Add a test for the strings above. |
| Low | Input validation | `packages/element/src/textRanges.ts:196` | The plan says a transparent colour is stored as null so that a range cannot make text invisible, but only `applyTextRangeStyle` enforces this. `sanitizeTextRanges` keeps `#00000000` and `transparent` from a file or peer, so part of a text can be hidden while the text stays in the data. A highlight matching the text colour hides text anyway, so this is a weak control either way. | Map alpha-0 colours to null in `sanitizeTextRanges`, or narrow the plan's claim to the action path. |
| Low | Input validation | `packages/element/src/textRanges.ts:267` | `areTextRangesEqual` compares known fields only, so input that matches is returned as the raw object and unknown keys on records, `origin` or the container survive restore, saves and the wire. No reader uses them, and `customData` already allows arbitrary data. Found by reading, not run. | Build the result from known fields only, or treat unknown keys as a mismatch. The plan's "valid input comes back as the same object" would still hold for clean data. |

## Noted (pre-existing, out of scope)
- `strokeColor` is not validated at restore (`packages/excalidraw/data/restore.ts:490`) and reaches the SVG text `fill` at `packages/excalidraw/renderer/staticSvgScene.ts:897`. Same sink as the first Low finding; advisory, does not gate this run.

## Passing checks
- Injection: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `cssText` or `eval` in added code; `textPreview.ts` builds with `textContent`, text nodes and `element.style`, and SVG text uses `textContent`, text nodes and `setAttribute`.
- Untrusted ranges: every reader sanitizes, record reads are capped, offsets are clamped, ids and colours are length-limited, and rendering goes through `sanitizeTextRanges` via `getTextStyleRuns`. Remote elements pass `restoreElements` before reconcile (`Collab.tsx:782`, `firebase.ts:222`).
- Regex: the `getRenderedLineOffsets` pattern runs on a 32-char slice and has no backtracking risk.
- Accepted limit, `origin.text`: not worse than written. It is set only in a merge, and `shiftTextRanges` and `applyTextRangeStyle` drop it. `App.text.ts:225` and `listMarker.ts` are the only `originalText` writers on existing elements and both remap; `App.text.ts:202` is only a layout argument. A no-op style action leaves it in place, which is not an applied style.
- Accepted limit, 1,024 record cap: matches the plan.
- Logging: no new logging of text; both actions set `trackEvent: false`.
- Secrets: the checklist regex finds nothing in new source, `CHANGELOG.md` or added lines of edited files. `CHANGELOG.md` and `en.json` hold no secrets.
- Test fixtures: no credentials, tokens, URLs or email addresses. The 7 test files were checked with a pattern scan, not read in full. The only hit is the word "token" in a test name.
- Dependencies: unchanged, no manifest or lockfile in the touched set, so `npm audit` was not run.
- PII fields, authn/authz, audit log, `.env`, helmet, rate limiting, error filter: n/a — not in the touched set (client library with no server routes).

## Required fixes before sign-off
- `packages/element/src/textRangeMerge.ts:128`: bound the total diff work in one `mergeTextRanges` call, deterministically, and test it with 1,024 distinct origin texts.

The three Low findings are advisory. The orchestrator's typecheck failure (4 TS2322 in `packages/excalidraw/tests/textRanges.elements.test.tsx`) has no security impact.

Limits of this review: the timing covers `mapTextSpan` run 1,024 times in Node, not a full reconcile in a browser. No browser test was made of `fill="url(...)"`.

Tool calls: 10
