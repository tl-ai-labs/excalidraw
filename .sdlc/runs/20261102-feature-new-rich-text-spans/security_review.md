# Security Review — pass2

## Summary
Re-check of the 31 files in `provenance.json` against `14bb42ed`, after the fix round. **Not ready for sign-off: two Mediums are open.** The live-range cap holds on all five routes, and two clients merging the same pair get identical results. However, a roughly 1 MB scene can still freeze the tab during text measuring, and the fix for the merge map added a new freeze that a room peer can trigger. Merges stop being repeatable once tombstones overflow. Crafted ceiling seqs can still lose a new range, though no longer through restore's validator. Most of the checklist does not apply: this is a client-side canvas feature with no server routes, PII, auth or audit table.

Timings and counts come from the real `textStyleRanges.ts` compiled in the scratchpad with stubbed dependencies, on Node 24. `measureText` was timed in headless Brave 154. The freeze duration in N1 is extrapolated, not timed end to end. Firefox and Safari were not tested. Nothing in the repo was changed, apart from adding this review.

## Round-1 verdicts
| Round-1 finding | Verdict | Basis |
|---|---|---|
| Medium: live ranges uncapped (client DoS) | **Partly closed, still open as N1** | The cap holds on every route and building runs is now cheap. Prefix measuring still scales with runs × line length. |
| Low: `mergedRangeVersions` unbounded and keyed by range id | **Closed as written; the fix introduced N2** | Capped at 4096 entries, and the key is per element with a length prefix, so ids cannot collide across elements. |
| Low: crafted seq | **Original failure closed, residual open as N3** | No seq minted locally can exceed the ceiling, so restore's validator never rejects one. A full list at the ceiling still loses the new range. |
| Info: `reconcileElements` on unrestored input | **Open, not requested for fixing** | `getTextStyleState` (`:147-150`) has no `Array.isArray` guard, and `:651` still calls `.map` on its result. |

**Live-range cap by route.** Every route reaches `restoreElements`, then `sanitizeTextStyles`, then `resolveState`:
- File: `packages/excalidraw/data/blob.ts:163`
- Paste and library insert: `packages/excalidraw/components/App.tsx:4625`, which all `addElementsFromPasteOrLibrary` callers go through
- Library item: `packages/excalidraw/data/restore.ts:1394`, reached from `restoreLibraryItems`
- Link: `excalidraw-app/App.tsx:269` and `:586`
- Room peer: `excalidraw-app/collab/Collab.tsx:782` for init and update, and `excalidraw-app/data/firebase.ts:222,244,265` for the stored scene

Every `withTextStyles` caller takes its state from `resolveState`, and `mergeTextStyles` re-caps at `:680`. `updateScene` stays untraced, as it is a host API.

**Merge results.**
- **Two clients, same pair: identical.** Both call `mergeTextStyles(winner, loser)` with the same arguments. The exception is a client editing that element, which keeps its local copy (existing rule).
- **Repeated, within the tombstone cap: identical.** 0 failures in 200,000 fuzz cases, including with a live cap of 4 and a tombstone cap of 1000.
- **Repeated, past 64 tombstones: not identical** (N4).
- **Three parties at a full list: delivery order can matter briefly**, until the next full sync (N5).

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Surface (client DoS from untrusted scene data) | `packages/element/src/textStyleRanges.ts:948-977` (`layoutTextStyleRuns`) | **N1.** The cap does not bound `layoutTextStyleRuns`: an attacker can swap ranges for text. A 986,924-byte payload with 1000 one-character ranges at the end of a 900k-character line gives 2,001 runs and 4,002 uncached `measureText` calls, or 3.6e9 characters per draw. That is more than round 1's 1.6e9. At the measured 24.1 ms per 900k-character call, one draw is about 96 s (extrapolated), against about 24 ms for the same text unstyled. It repeats whenever the element is redrawn or exported to SVG. Building runs is fixed (6 ms for this input). Confidence: high on the count, medium on the duration. | Add a per-element budget, not per line, since many short lines can dodge a per-line limit. In `getStyledTextLines`, return null when total runs × line length exceeds it (about 2M characters), so the element draws plain. Both canvas and SVG read that function. Add a test for the long-line case. |
| Medium | Surface (client DoS, introduced by the fix) | `packages/element/src/textStyleRanges.ts:66-67` (`getMergedRangeKey`), `:69-85` (`recordMergedRange`); `packages/excalidraw/data/restore.ts:480` | **N2.** The new key embeds the element id, and restore puts no length limit on that id. With a 20,000-character id, three successive updates took 3.4 s, 12.8 s and 26.3 s in `noteMergedTextStyles`, on the main thread during reconcile. Each update costs a peer about 110 KB. A 100,000-character id had not finished when I stopped it (duration not recorded). A 16,000-character id takes about 55 ms per update and a 21-character id 5 ms or less. The jump above 16k suggests V8 hashes long strings weakly, so the keys collide; that cause is inferred. Retained memory also scales with id length (87 MB heap at 20k). It needs an element that already exists locally, so it needs a room peer or a stored scene. | In `recordMergedRange`, skip ids longer than `MAX_RANGE_ID_LENGTH`. The code comment already says a missing record is safe. Add a test with an over-long element id. |
| Low | Data integrity (crafted seq) | `packages/element/src/textStyleRanges.ts:87-98` (`compareBySeqThenId`), `:142`, `:375`, `:811-815` | **N3.** Restore no longer rejects a new range, but it can still be lost. With 1000 ranges at seq 2147483647 and ids above the nanoid alphabet (e.g. `~0000`), the new range ties on seq, loses on id and is evicted inside `applyTextStyle`. The state is unchanged, so the action silently does nothing. Merging applies the same rule. Two related cases: one crafted full-cover range at the ceiling keeps painting over a new colour, though the new range is stored; and an undo re-add at a ceiling tombstone dies on a peer that still holds the tombstone. `restore.test.ts:1857` covers only the single-range case. | At the ceiling with a full list, have `applyTextStyle` tombstone the lowest range itself, so the new one takes its slot (untested). Add a test for a full list at the ceiling. |
| Low | Data integrity (merge not repeatable) | `packages/element/src/textStyleRanges.ts:121-135`, `:143` (`resolveState`) | **N4.** Not from the fixes, and missed in round 1. A tombstone kills a range and is then evicted by the 64 cap in the same pass, so the next merge with the same stale copy brings the cleared range back. With real constants, merge 1 gave 0 live ranges and merge 2 gave 1. It then spreads to the other client on the next full sync. `saveToFirebase` provides a realistic repeat, since it reconciles against the stored scene. The fuzz with a tombstone cap of 3 failed 19,760 of 200,000 cases. `reconcile.test.ts:619` uses short lists, so it misses this. | Cap tombstones first, and let only the kept ones kill ranges. On a scratch copy this gave 0 repeat failures in 200,000 cases. Trade-off: the evicted range now returns on the first merge, not the second. |
| Info | Data integrity (cap side effects) | `packages/element/src/textStyleRanges.ts:142`, `:496-501` | **N5.** Three parties at a full list can reach different results depending on delivery order, because an evicted range can't return unless another copy still holds it. In the fuzz, every such case agreed once the two states were merged, which the 20 s full sync does. Separately, from reading only: at a full list, clearing inside the lowest range can evict one of its own pieces, as pieces keep the low seq. | No action needed before sign-off. Document that eviction carries no tombstone. |
| Info | Robustness (public API) | `packages/excalidraw/data/reconcile.ts:80`, `packages/element/src/textStyleRanges.ts:632` (`mergeTextStyles`) | Open from round 1, not requested for fixing. A third-party host passing unrestored remote elements can throw on a non-array `textStyleRanges`, or carry unclamped offsets into `mapRange`. | Guard with `Array.isArray` in `getTextStyleState`, or document that remote elements must be restored first. |

## Passing checks
- Injection sinks: no new sinks; `textContent`, `createTextNode`, `style.*` and `setAttribute` only. No `innerHTML` in the diff.
- Validation: `sanitizeRange` still rebuilds ranges from known keys and allowlists colours.
- Seq bound: `isValidSeq`, `nextSeq`, the `createTextStyleRanges` default and the undo re-add all stay within 2147483647.
- Merge-map key: the length prefix is unambiguous, and an element's records cannot collide with another element's.
- Secrets: no hits on a case-insensitive scan of added lines and new files, tests and fixtures included. Docs add no credentials.
- Secrets & config: `.env.example` and `.env` handling n/a — not in the touched set.
- Dependency risk: no manifest or lockfile in the touched set, so unchanged; audit not run.
- PII handling: n/a — not in the touched set.
- Authn & authz: n/a — not in the touched set.
- Audit log integrity: n/a — not in the touched set.
- Surface & headers (helmet, rate limiting, error filter): n/a — not in the touched set.

## Required fixes before sign-off
- `packages/element/src/textStyleRanges.ts`: bound measuring cost per element (N1).
- `packages/element/src/textStyleRanges.ts`: stop long element ids reaching the merge-map key (N2).

N3 and N4 are recommended but not blocking. N4 is the fix to take if "identical when repeated" is a hard requirement. N5 and the reconcile Info need no action.

## Noted (pre-existing, out of scope)
- `packages/common/src/colors.ts:13`: `DARK_MODE_COLORS_CACHE` is an unbounded `Map`. This file is untouched, but range colours now also feed it in dark mode.

Tool calls: 15
