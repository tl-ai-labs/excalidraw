# Security Review — pass1

Mode: brownfield, intent feature-new, run `20261109-120000-feature-new-text-styling`. Scope: the 19 files in `provenance.json`, diffed against `git_head_before` 14bb42ed (15 edited, 4 new).

## Summary
This run adds client-side rich-text styling: `styleRanges` (per-span color and highlight) on text elements, with canvas and SVG rendering, a highlight picker, and restore-time sanitization. There is no server, auth, PII or audit-log surface in the touched set. The one new untrusted-input path is `styleRanges` arriving from files or collaboration. Both go through `restoreElement` → `sanitizeTextStyleRanges`. That function requires integer offsets, accepts only color strings that match `^[#a-z0-9(),.%\s/-]+$`, are at most 64 characters and contain no `url(`, and then clamps and normalizes the ranges. Collab remote elements also pass through `restoreElements` (`excalidraw-app/collab/Collab.tsx:782`). The SVG export writes styled text with `textContent` and colors with `setAttribute`, with no `innerHTML`, so there is no markup injection. No blocking findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Surface (SVG export) | packages/excalidraw/renderer/staticSvgScene.ts (styled-run block, `rect`/`tspan` `fill`) | `run.color` / `run.backgroundColor` go into the SVG `fill` unvalidated when elements skip `restore` (e.g. host `updateScene` with raw elements). A host could put a `url(#…)` or `url(http…)` paint reference in an exported SVG. This matches how `element.strokeColor` is already handled, so it adds no new kind of risk. Confidence: high that the path exists, low impact. | Optional: run `isValidColorString` (or `sanitizeTextStyleRanges`) at render time as well, or note that hosts must pass elements through `restoreElements`. Not a blocker. |

## Passing checks
- PII encryption / masking / audit-before-access: n/a, not in the touched set (client-side drawing library, no PII fields).
- Route guards, role + `reports_to`, JWT secret, password hashing: n/a, not in the touched set (no controllers or auth).
- Audit log append-only / auditor-only / entry fields: n/a, not in the touched set.
- Untrusted input: `restore.ts` sanitizes `styleRanges` (type, integer offsets, color allowlist regex, clamp to `originalText` length). The collab path goes through `restoreElements`. After normalization the range count is at most the text length, so array size cannot be abused.
- DOM sinks: no `innerHTML`, `dangerouslySetInnerHTML`, `eval` or `new Function` in the diff. `TextHighlightPicker.tsx` renders only the constant `DEFAULT_ELEMENT_BACKGROUND_PICKS` through React-escaped props.
- Listener lifecycle: `textWysiwyg.tsx` removes every added listener in `cleanup()`, and the selection source is cleared only when it still matches (`expected`). Registries are `WeakMap`s keyed by the app, so nothing leaks between instances.
- Secrets in committed code: no credential or key patterns in the 19 touched files. Test fixtures (`packages/element/tests/textStyleRanges.test.ts`, `packages/excalidraw/tests/textStyleRanges.test.tsx`) hold only text and color literals.
- Docs: the `packages/excalidraw/CHANGELOG.md` entry has no secrets or credentials in its examples.
- `.env.example` / `.env` gitignore: n/a, not in the touched set.
- Helmet, rate limiting, global error filter: n/a, not in the touched set (no server).
- Dependencies: no manifest or lockfile in the touched set, so `npm audit` was not run and dependencies are unchanged.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- `element.strokeColor` (and other element colors) also reach SVG `fill`/`stroke` attributes without validation when they come in through `updateScene`. This was already the case before this run. Advisory only.

Tool calls: 5
