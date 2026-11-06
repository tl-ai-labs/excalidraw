# Security Review — pass1 (brownfield, feature-new: rich-text-spans)

## Summary
Scope is the 19 files in `provenance.json` (12 source, 6 test, 1 doc / 1 locale), diffed against `14bb42ed`. Excalidraw is a client-side canvas library. It has no server routes, no PII fields, no auth and no audit table, so most of the checklist does not apply. The one new trust boundary is the persisted `styleRanges` field on text elements. It reaches the app from files, paste, library, `initialData` and collab peers. Every one of those paths goes through `restoreElements` → `sanitizeStyleRanges` (`restore.ts:609`; callers confirmed at `App.tsx:3621`, `App.tsx:4625`, `blob.ts:163`, `Collab.tsx:782`). The sanitizer checks types, requires integer offsets, clamps and normalises, and it builds new objects (so no prototype pollution). One medium issue: the sanitizer puts no limit on how many ranges an element can carry, and the normaliser is quadratic. A crafted scene or a collab peer can therefore freeze the client, and because the renderer normalises again on every redraw, the freeze repeats. Colour strings go into SVG `fill` attributes without validation. That matches how `strokeColor` is handled today (low, advisory). No secrets in the touched source, tests or docs.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Surface (untrusted input / DoS) | packages/element/src/textStyleRanges.ts:107 (`normalizeStyleRanges` inner loop), :473 (`sanitizeStyleRanges`); called per render from :300 (`getStyledLines`), renderElement.ts ~713, staticSvgScene.ts:823 | `sanitizeStyleRanges` accepts any number of ranges. `normalizeStyleRanges` then checks every range against every boundary segment, roughly O(text length × range count). A shared link, an imported file or a collab update with 10^5 ranges on a long text hangs the tab. `getStyledLines` re-normalises on every canvas redraw and SVG export, so the hang comes back each time. Confidence: high. | In `sanitizeStyleRanges`, cap the input (e.g. at most `textLength` ranges, or a fixed limit such as 10k) before normalising. Change the sweep to sort plus a single pass (O(n log n)). Since stored ranges are already normalised, `getStyledLines` should skip re-normalising them. |
| Low | Surface (output encoding) | packages/excalidraw/renderer/staticSvgScene.ts ~860 (`rect` fill), ~889 (`tspan` fill); textStyleRanges.ts:491 | `color`/`highlight` only have to be non-empty strings. In light theme they go into the exported SVG `fill` attribute unchanged. `setAttribute` escapes markup, so a value cannot inject elements. It can still be a paint reference such as `url(https://host/x.svg#p)`, which some SVG viewers outside the browser may fetch. `strokeColor` already has the same behaviour, so this is a new instance of an existing pattern. Confidence: medium. | In `sanitizeStyleRanges`, accept only parseable colours (e.g. `tinycolor(c).isValid()`, or reject values containing `url(`), and cap string length. |

## Passing checks
- Untrusted ingress: all restore, paste, collab and library paths sanitise `styleRanges`. Values that fail are dropped and the key is removed (restore.ts:607-620).
- No prototype pollution: ranges are rebuilt through `makeRange`, and input objects are never spread.
- No HTML injection: SVG text uses `textContent` and attributes use `setAttribute`. The new code adds no `innerHTML`.
- textWysiwyg.tsx: the `selectionchange`/`select`/`keyup`/`pointerup` listeners are removed and the selection atom is cleared in cleanup, so no listener outlives the editor. The atom is UI-only and is not persisted.
- Secrets in committed code: none in the touched source. The six test files and fixtures have no credentials or tokens (grep). CHANGELOG.md and en.json have no secrets in examples.
- PII encryption / masking / audit-before-access: n/a, not in the touched set (no PII fields).
- Route guards, role + `reports_to`, JWT secret, password hashing: n/a, not in the touched set (no server or auth code).
- Audit log append-only / auditor-only / entry fields: n/a, not in the touched set.
- `.env.example` / `.env` gitignored: n/a, not in the touched set.
- Helmet, auth rate limiting, global error filter: n/a, not in the touched set (client library).
- Dependencies: no manifest or lockfile touched, so `npm audit` was not run (unchanged from baseline).

## Required fixes before sign-off
- packages/element/src/textStyleRanges.ts: limit the number of ranges `sanitizeStyleRanges` accepts, and make `normalizeStyleRanges` sub-quadratic (or stop re-normalising stored ranges in `getStyledLines`). This closes the hang that a crafted scene or collab peer can cause.

## Noted (pre-existing, out of scope)
- `strokeColor`/`backgroundColor` are also written raw into exported SVG `fill` (restore.ts:491 only defaults when falsy). This is the same class as the Low finding above.
- Not security, for the orchestrator: the failing undo/redo test is consistent with `shiftRangesTo` in textWysiwyg.tsx calling `mutateElement(..., { informMutation: false })`, and with the editor's text commit bypassing history capture for `styleRanges`. The two typecheck errors are in packages/excalidraw/tests/textStyleRanges.test.tsx:29,190.

Tool calls: 8
