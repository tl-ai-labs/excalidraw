# Intent Brief — bugfix — Eyedropper saves dark-mode on-screen colour instead of real colour

> Status: APPROVED at Gate 0 (2026-11-04). Auth: estimated. Policy: opus55-only. Adaptive profile: skipped. .gitignore: not touched.
> Test command: `yarn test:app --watch=false` (targeted: `yarn test:app --watch=false packages/excalidraw/tests/eyeDropper.test.tsx packages/common/src/colors.test.ts`) + `yarn test:typecheck`. Do NOT run `yarn test:update` (snapshot churn outside scope).

## Context
In dark theme the eyedropper saves the on-screen dark-mode colour instead of the element's real colour.

`packages/excalidraw/components/EyeDropper.tsx` (`getCurrentColor`, ~L80-95) samples a raw pixel from the
rendered static canvas via `ctx.getImageData` and returns `rgbToHex(r,g,b)` unchanged. In dark theme every
element colour is rendered through `applyDarkModeFilter` (`packages/common/src/colors.ts:83` —
`invert(93%)` then `hue-rotate(180deg)`), so the sampled pixel is the transformed colour, and that value is
written to `strokeColor` / `backgroundColor` / `currentItem*Color` (via `App.openEyeDropper` and the
bucket-fill temporary eyedropper).

## Goal
In dark theme, the eyedropper resolves the sampled on-screen pixel back to the element's real (light-theme)
colour before passing it to `onChange` / `onSelect`. The live preview swatch keeps showing the on-screen
colour so it matches what is under the cursor. Light theme behaviour is unchanged.

## Files in scope
- `packages/excalidraw/components/EyeDropper.tsx` — map sampled pixel back when `theme === "dark"`
- `packages/common/src/colors.ts` — add an inverse of `applyDarkModeFilter` next to the forward transform
- `packages/common/src/colors.test.ts` — round-trip tests for the inverse
- `packages/excalidraw/tests/eyeDropper.test.tsx` — reproducing test (fails before the fix): dark theme,
  mocked `getImageData` returning a dark-rendered pixel, assert the saved colour is the original colour

## Files off-limits
Project defaults + AI configs (`CLAUDE.md`, `.github/copilot-instructions.md`) + generated files
(`packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`,
`packages/excalidraw/types/**`). Everything not in the allowlist.

## Acceptance criteria
- New eyedropper test, dark theme: picked colour equals the original element colour (or within ±2 per
  channel before any snapping to an exact palette / in-scene colour).
- Light-theme pick unchanged.
- Existing `eyeDropper`, `bucketFill`, `colorPickerHotkeys`, `colors` tests still pass.
- `yarn test:typecheck` clean.

## Non-goals
- Changing how dark mode is rendered.
- Changing the preview swatch's displayed colour.
- Exact recovery of colours lost to `invert(93%)` clamping beyond the stated tolerance.
