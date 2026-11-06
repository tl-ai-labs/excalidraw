# Intent Brief — bugfix — Eyedropper picks dark-mode-rendered colour

## Context
In dark theme, element colours are drawn to the canvas through `applyDarkModeFilter`
(`packages/common/src/colors.ts`), which emulates `invert(93%) hue-rotate(180deg)`.
`EyeDropper.tsx` → `getCurrentColor` reads the raw canvas pixel via `ctx.getImageData` and
returns `rgbToHex` of it, so it records the on-screen (transformed) colour.

## Goal
Observed: in dark theme, the eyedropper saves the on-screen dark-mode colour instead of the
element's real colour.
Expected: the eyedropper yields the colour as stored in the scene (the light-theme value),
so that re-applying it renders the same as the sampled element. Light theme behaviour is unchanged.

## Files in scope
- `packages/excalidraw/components/EyeDropper.tsx` — the fix (colour sampling)
- `packages/common/src/colors.ts` — only if an inverse dark-mode helper is needed
- `packages/excalidraw/tests/eyeDropper.test.tsx` — reproducing test (fails on the bug first)
- `packages/common/src/colors.test.ts` (+ its `__snapshots__/colors.test.ts.snap`) — unit test for any new colour helper

## Files off-limits
Project defaults + detected AI configs (`.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`),
`.env*`, generated wasm files, `**/node_modules/**`, `**/dist/**`, `.sdlc/**`, `.git/**`.

## Acceptance criteria
1. A new test in `eyeDropper.test.tsx` sets `theme: "dark"`, samples a pixel rendered from a known
   stored colour, and asserts the picked colour equals the stored colour; it fails before the fix.
2. The same scenario in light theme still returns the pixel colour as-is.
3. Existing eyedropper, colour picker, and bucket-fill tests still pass.
4. `yarn test:typecheck` passes.

## Non-goals
- Changing how dark mode renders.
- Reworking the eyedropper UI, hotkeys, or bucket-fill flow.

## Gate 0 — approved
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Auth mode: estimated
- Policy: opus55-plus-flash38
- Intent: bugfix
- .gitignore `.sdlc/` entry: declined (note in final report)
- Allowlist (frozen): packages/excalidraw/components/EyeDropper.tsx, packages/common/src/colors.ts,
  packages/excalidraw/tests/eyeDropper.test.tsx, packages/common/src/colors.test.ts,
  packages/common/src/__snapshots__/colors.test.ts.snap
- Off-limits (frozen): project defaults + AI configs + generated wasm + packages/excalidraw/types/**
