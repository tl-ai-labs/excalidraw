# Requirements — bugfix — Eyedropper saves dark-mode on-screen colour instead of real colour

Run: `20261104-061406-bugfix-eyedropper-dark-theme` · Intent: bugfix (reproduce + diagnose) · Policy: opus55-only · Auth: estimated

## Reproduction

1. Set the editor to dark theme (`appState.theme === "dark"`).
2. Open the eyedropper (e.g. key `i`, or the stroke/background picker's eyedropper, or the bucket-fill temporary eyedropper).
3. Hover/click over an element whose real stroke or background colour is, e.g., `#1971c2`.
4. Observed: the picked colour is the dark-mode rendered colour (`applyDarkModeFilter("#1971c2")`), and that value is written to `strokeColor` / `backgroundColor` / `currentItem*Color`.
5. Expected: the picked colour is `#1971c2` (or within ±2 per channel of it).

In a unit test the canvas is mocked (`vitest-canvas-mock`), so the reproduction mocks the 2D context's `getImageData` to return the dark-rendered pixel of a known colour, sets dark theme, and asserts on the colour handed to `onChange` / `onSelect` (observable as the selected element's colour or `appState.currentItemStrokeColor` / `currentItemBackgroundColor`).

## Diagnosis

- `packages/excalidraw/components/EyeDropper.tsx`, `getCurrentColor` (L80-95): reads one pixel from `app.canvas` via `ctx.getImageData(...)` and returns `rgbToHex(r, g, b)` unchanged.
- In dark theme each element colour is rendered through `applyDarkModeFilter` (`packages/common/src/colors.ts` ~L83): `cssInvert(r, g, b, 93)` then `cssHueRotate(…, 180deg)`, each step rounding and clamping to `[0, 255]`.
- So the sampled pixel is the transformed colour; nothing maps it back. The same value is used for the live preview swatch (correct: it should match what is under the cursor) and for `onChange` / `onSelect` (wrong in dark theme).
- Root cause: the eyedropper has no inverse of the dark-mode filter. Fix: add an inverse transform next to the forward one in `colors.ts` and apply it in `EyeDropper.tsx` to the colour passed to `onChange` / `onSelect` when `theme === "dark"`.

Inverse math notes (for the architect): `invert(p)` is affine per channel, `x' = x(1-2p) + 255p`, invertible for `p = 0.93` (`x = (x' - 255p) / (1-2p)`, i.e. divide by `-0.86`). The 180deg hue-rotate matrix is a fixed 3x3 matrix; its inverse is the matrix inverse (hue-rotate(180) is not exactly self-inverse with the CSS luminance coefficients, so use the true inverse or an equivalent closed form). Clamping in the forward transform makes some inputs unrecoverable; the result is clamped to `[0, 255]` and rounded.

## In scope

1. An exported inverse of `applyDarkModeFilter` in `packages/common/src/colors.ts` (e.g. `revertDarkModeFilter(color: string): string`), returning a hex colour, preserving alpha the way `applyDarkModeFilter` does.
2. `EyeDropper.tsx`: when `appState.theme === "dark"`, the colour passed to `onChange` and `onSelect` is the inverse-mapped colour; the preview swatch keeps the raw sampled colour.
3. A reproducing test in `packages/excalidraw/tests/eyeDropper.test.tsx` (fails before the fix).
4. Round-trip unit tests for the inverse in `packages/common/src/colors.test.ts`.

## Out of scope

1. Changing how dark mode is rendered (`applyDarkModeFilter` behaviour and its cache stay as they are).
2. Changing the preview swatch's displayed colour.
3. Exact recovery of colours lost to the forward transform's clamping beyond the stated tolerance.
4. Snapping the picked colour to a palette or in-scene colour.
5. Any file outside the frozen allowlist.

## Functional requirements

- **FR-1** `colors.ts` exports an inverse of the dark-mode filter that, for any colour `c` whose forward transform does not clamp, satisfies `inverse(applyDarkModeFilter(c))` within ±2 per RGB channel of `c`. Alpha is preserved (same alpha handling as `applyDarkModeFilter`: full opacity omits alpha).
- **FR-2** In dark theme, `EyeDropper` passes the inverse-mapped colour of the sampled pixel to `onChange` (pointer-held move) and `onSelect` (pointer up).
- **FR-3** In dark theme, the preview swatch (`colorPreviewDiv.style.background`) still shows the raw sampled on-screen colour.
- **FR-4** In light theme, `EyeDropper` behaviour is unchanged: the raw sampled colour is passed to `onChange` / `onSelect` and shown in the preview.

## Non-functional requirements

- **NFR-1** No new dependencies; reuse `tinycolor2`, `clamp`, `degreesToRadians`, `rgbToHex` already imported/available.
- **NFR-2** `yarn test:typecheck` clean; code style follows the repo (Prettier, eslint `max-warnings=0`).
- **NFR-3** The inverse is pure and cheap (per-pointer-move call); an optional cache is acceptable but not required.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| None | — | The change handles colour values only. |

## Role matrix

Not applicable: client-side editor UI, no roles or resources.

## Acceptance criteria

- **AC-1** New eyedropper test, dark theme: with `getImageData` mocked to return the dark-rendered pixel of a known colour, the picked colour (as applied to the selected element / `currentItem*Color`) equals the original colour within ±2 per channel. This test fails on the code as it is.
- **AC-2** Light-theme pick unchanged: with `getImageData` mocked to return a pixel, the picked colour equals that pixel's hex.
- **AC-3** Round-trip tests in `colors.test.ts`: for a set of palette colours (e.g. `#1971c2`, `#e03131`, `#2f9e44`, `#868e96`, `#ffffff`, `#000000` or those not clamped), `inverse(applyDarkModeFilter(c))` is within ±2 per channel of `c`; alpha preserved.
- **AC-4** Existing `eyeDropper`, `bucketFill`, `colorPickerHotkeys` and `colors` tests still pass.
- **AC-5** `yarn test:typecheck` clean.

## Open questions for HITL

None blocking. Note for Gate 1: whether palette colours like pure white/black round-trip within ±2 depends on forward clamping; the round-trip tests will use only colours whose forward transform does not clamp, per Non-goals.
