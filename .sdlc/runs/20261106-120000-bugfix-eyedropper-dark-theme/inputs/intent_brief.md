# Intent Brief — bugfix — eyedropper saves dark-mode colour in dark theme

## Context
In dark theme Excalidraw draws every colour through a dark-mode transform
(`applyDarkModeFilter` in `packages/common/src/colors.ts`: `invert(93%)` then `hue-rotate(180deg)`,
baked into the static canvas). The eyedropper (pick a colour from the canvas for stroke or background)
reads the transformed pixel via `getImageData` and saves it as the new colour. Picking a near-black
rectangle turns the target shape near-white. Reported in excalidraw/excalidraw#10867.

The bucket-fill tool's Alt eyedropper (`App.bucketFill.ts`, added in 4872083c) goes through the same
component and has the same defect.

## Goal
In dark theme, a colour picked with the eyedropper is converted back from the on-screen dark-mode colour
to the underlying scene colour before it is applied, so the target renders identically to the picked source.

## Files in scope
- `packages/common/src/colors.ts` — add an exported inverse of the dark-mode colour transform
- `packages/common/src/colors.test.ts` — round-trip unit tests (+ its `__snapshots__` if touched)
- `packages/excalidraw/components/EyeDropper.tsx` — apply the inverse to picked pixels in dark theme
- `packages/excalidraw/actions/actionProperties.tsx` — eyedropper users
- `packages/excalidraw/components/App.bucketFill.ts` — bucket-fill Alt eyedropper
- `packages/excalidraw/components/App.cursor.ts` — eyedropper user
- `packages/excalidraw/tests/eyeDropper.test.tsx` — reproducing jsdom test (dark theme pick)

## Files off-limits
Project defaults (`.env*`, `.mcp.json`, `node_modules/**`, `.claude/**`, `dist/**`, `.sdlc/**`, `.git/**`),
detected AI configs (`CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/`), and
`packages/excalidraw/types/**`, `.yarn/**`, build outputs.

## Acceptance criteria
1. In dark theme, picking a colour from a shape with the eyedropper and applying it to another shape makes
   the target render the same colour as the source, and the colour picker's hex value matches the source's
   stored colour (no near-black → near-white flip).
2. The inverse is a general inverse of the transform, not a special case for black/white. Round trip:
   `applyDarkModeFilter(inverse(x)) === x` for on-screen colours in the transform's range, and
   `inverse(applyDarkModeFilter(c))` reproduces `c` (exactly for the default palette; within rounding
   tolerance for arbitrary colours, since the 93% invert is lossy).
3. Light theme behaviour is unchanged.
4. Unit tests in `packages/common/src/colors.test.ts` cover the round trip; jsdom tests in
   `packages/excalidraw/tests/eyeDropper.test.tsx` pick a colour in dark theme. The reproducing test
   fails before the fix and passes after.
5. `yarn test:typecheck`, `yarn test:code` and `yarn test:app --watch=false` pass.

## Non-goals
- Changing the dark-mode transform itself or how the canvas renders in dark theme.
- Redesigning the eyedropper UI.
- Picking exact colours from images (best-effort inverse applies).

## Gate 0 — approved 2026-11-06
- Auth mode: estimated. Policy: argon4-plus-sonnet55. Intent: bugfix.
- Test command: `yarn test:app --watch=false` (plus `yarn test:typecheck`, `yarn test:code`).
- Allowlist frozen as "Files in scope" above, plus `packages/common/src/__snapshots__/colors.test.ts.snap`.
- `EyeDropper.scss` not added; `.gitignore` not changed (note in final report).
- Round-trip definition in Acceptance criteria #2 accepted.
