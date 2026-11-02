# Security Review — pass1

## Summary
Scope is the 31 files in `provenance.json`, reviewed as the diff against `14bb42ed`; the list matches `git status` exactly. Most of the checklist does not apply, because this is a client-side canvas feature with no server routes, PII, auth or audit table. The new data path is sound on injection: `restoreElement` rebuilds and validates ranges from untrusted scenes, and every sink is DOM-safe. The main gap is resource bounds. Tombstones are capped but live ranges are not, so one crafted scene or peer update can freeze the tab. That is one Medium to fix before sign-off, plus two Low and one Info. The DoS cost below comes from reading the code and doing the arithmetic; it was not reproduced or timed.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Surface (client DoS from untrusted scene data) | `packages/element/src/textStyleRanges.ts:549` (`sanitizeTextStyles`), `:823-829` (`getTextStyleRuns`), `:923-934` (`layoutTextStyleRuns`) | Nothing caps `textStyleRanges`, while `clearedTextStyleRanges` is capped at 64. `getTextStyleRuns` is O(edges × spans) per line, and `layoutTextStyleRuns` measures a prefix twice per run, so about O(runs × line length) per line. Both run on the render path from `renderElement.ts`, `staticSvgScene.ts` and the wysiwyg overlay. About 1 MB of JSON (20k alternating-colour ranges on a 40k-char line) costs about 8e8 span checks plus about 1.6e9 characters measured per line drawn. Any `.excalidraw` file, shared link, library item, paste or room peer can deliver this, and plain text of the same size stays linear. Confidence: high on the complexity, impact not measured. | Add `MAX_TEXT_STYLE_RANGES` (e.g. 1000) next to `MAX_CLEARED_TEXT_STYLE_RANGES` and enforce it in `resolveState`, keeping the highest seq, so restore, merge, create and apply all share one deterministic rule. Optionally replace the nested loop in `getTextStyleRuns` with a sweep. Add a restore test for an oversized list. |
| Low | Surface (unbounded memory) | `packages/element/src/textStyleRanges.ts:58`, `:673`, `:678` | The module-level `mergedRangeVersions` map is only ever written with `set` and read with `get`. Nothing evicts it, so it outlives the editor instance and the room. Range ids come from peers (up to 64 chars), so a peer can grow it on every update by sending fresh ids. It is keyed by range id alone, so a peer-chosen id can also collide with a local id on another element and affect `omitMergedTextStyleChanges`. | Key it per element (e.g. a `WeakMap` or element id plus range id) and bound its size, or evict entries below the versions still referenced by the store snapshot. |
| Low | Data integrity (crafted seq) | `packages/element/src/textStyleRanges.ts:136` (`isValidSeq`), `:344` (`nextSeq`) | A file or peer can set `seq` to `Number.MAX_SAFE_INTEGER`, which passes validation. The next local range then gets seq 2^53, which `isValidSeq` rejects, so restore silently drops it on peers and on reload. The user's colouring on that element stops persisting. | Tighten `isValidSeq` to a much lower ceiling (e.g. `<= 2 ** 31`), so `highest + 1` can't leave the valid range in practice. |
| Info | Robustness (public API) | `packages/excalidraw/data/reconcile.ts:80` (`mergeStyleRanges`), `packages/element/src/textStyleRanges.ts:597` (`mergeTextStyles`) | `reconcileElements` is exported and now dereferences `textStyleRanges` without restoring first. Every in-repo caller passes restored elements, but a third-party host passing raw remote elements would throw on a non-array value such as `textStyleRanges: 1`, or carry unclamped offsets into `mapRange`. Before this change the function read only version-style fields. | Guard with `Array.isArray` in `getTextStyleState`, or document in the API docs and changelog that remote elements must be restored first. |

## Passing checks
- Injection sinks: run text uses `textContent` or `createTextNode`; colours use `style.*`, `setAttribute` or canvas `fillStyle`. No `innerHTML` in the diff.
- Validation: `sanitizeRange` rebuilds each range from known keys, clamps offsets and allowlists colours, so `url(...)` cannot reach an SVG `fill` from restored data. The colour regexes have no backtracking risk, and length is checked before they run.
- Ingress: restore runs before use on collab (`Collab.tsx:782`), firebase, backend import and local storage (`excalidraw-app/App.tsx:243,269`), blob load, paste/library (`App.tsx:4625`) and `initialData`. `updateScene` was not traced; it is a host API.
- `applyDarkModeFilter` does not throw on a name that passes the validator; tinycolor falls back to black.
- Privacy: range ids come from `randomId` (nanoid), and ranges and tombstones hold offsets, colours, ids and seqs only, with no user, session or text content.
- Secrets: no hits on a case-insensitive scan, broader than the checklist grep, over all added lines and new files, tests and fixtures included. Docs and changelog additions contain no URLs or script.
- Secrets & config: `.env.example` and `.env` handling n/a — not in the touched set.
- Dependency risk: no manifest or lockfile in the touched set, so unchanged; `npm audit` not run.
- PII handling: n/a — not in the touched set.
- Authn & authz: n/a — not in the touched set. New actions are client-side, gated on `editingTextElement`.
- Audit log integrity: n/a — not in the touched set.
- Surface & headers (helmet, rate limiting, error filter): n/a — not in the touched set.

## Required fixes before sign-off
- `packages/element/src/textStyleRanges.ts`: cap live ranges, as in the Medium finding above.

The Low and Info items are recommended but not blocking.

## Noted (pre-existing, out of scope)
- `packages/common/src/colors.ts:13`: `DARK_MODE_COLORS_CACHE` is an unbounded `Map`. This file is untouched, but range colours now also feed it in dark mode.

Tool calls: 9
