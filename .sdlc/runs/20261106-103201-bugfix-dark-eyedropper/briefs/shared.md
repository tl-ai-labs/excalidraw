## Conventions

- TypeScript 5.9 strict mode with ESM; format with Prettier (double quotes, semicolons, trailing commas, 80-column print width) and pass ESLint with --max-warnings=0.
- Group imports with a blank line between groups in ESLint import/order sequence: external packages first, then @excalidraw/* workspace packages, then parent/sibling relative imports, and separate-type-imports (import type) last.
- Export shared utilities from packages/common/src/colors.ts as typed arrow functions (export const fn = ...), which are re-exported from @excalidraw/common via export * from './colors' in packages/common/src/index.ts.
- Vitest tests use globals (bare describe, it, expect, vi) under jsdom with vitest-canvas-mock; editor integration tests in packages/excalidraw/tests/*.test.tsx render <Excalidraw /> via ./test-utils and drive interactions with API, Keyboard, Pointer, and fireEvent.

## Decisions

- Uncached forward dark-mode helper and invertDarkModeFilter algorithm: Extract an unexported applyDarkModeFilterToRgb(r, g, b) helper in packages/common/src/colors.ts that runs cssInvert(r, g, b, 93) followed by cssHueRotate(..., 180 as Degrees), and use it in both applyDarkModeFilter and invertDarkModeFilter; invertDarkModeFilter parses the color with tinycolor, computes the analytic inverse (cssHueRotate by 180 degrees followed by the per-channel inverse of 93% cssInvert: Math.round(clamp((c - 255 * 0.93) / (1 - 2 * 0.93), 0, 255))), keeps that initial estimate if applyDarkModeFilterToRgb already matches the target RGB, else searches offsets in [-3, 3] per channel for a match, and returns rgbToHex(..., alpha) without reading or writing DARK_MODE_COLORS_CACHE. (not Special-casing #000000, #ffffff, or #1e1e1e in a lookup table; not Calling the cached applyDarkModeFilter inside the refinement loop) — A single general inverse with [-3, 3] neighbourhood refinement and initial-estimate preservation recovers #1e1e1e, #000000, and #ffffff identically, satisfies applyDarkModeFilter(invertDarkModeFilter(p)) === p on all 6,163,468 reachable dark-mode colours, returns the clamped analytic estimate as valid hex for unreachable pixels, and leaves DARK_MODE_COLORS_CACHE untouched.
- Dark-theme pixel conversion and preview swatch in EyeDropper.tsx: In EyeDropper.tsx, getCurrentColor({ clientX, clientY }) takes no raw parameter and returns invertDarkModeFilter(rgbToHex(pixel[0], pixel[1], pixel[2])) when appState.theme === THEME.DARK, else the raw hex (adding appState.theme to the useEffect dependency array); mouseMoveListener keeps its existing single const currentColor = getCurrentColor({ clientX, clientY }) feeding both stableProps.onChange and colorPreviewDiv.style.background, and pointerUpListener passes getCurrentColor(event) to onSelect. This supersedes requirements FR-6 ('raw on-screen pixel'), by the person's Gate 2 decision, because .excalidraw-eye-dropper-preview has filter: var(--theme-filter) in dark mode (EyeDropper.scss:29, theme.scss:186), so feeding it the converted colour makes it render as the on-screen pixel. (not Converting the colour separately in LayerUI.tsx, App.bucketFill.ts, and ColorPicker callers; not Passing the raw dark-transformed pixel to colorPreviewDiv.style.background (which --theme-filter transforms a second time)) — Converting once in EyeDropper.tsx getCurrentColor fixes live preview (onChange), selection (onSelect) for stroke, background, and bucket fill, and the CSS-filtered preview swatch in one place while keeping read-only callers untouched.

## Files of this change

- `packages/common/src/colors.test.ts` (U01, edit)
- `packages/excalidraw/tests/eyeDropper.test.tsx` (U02, edit)
- `packages/common/src/colors.ts` (U03, edit) — import: `import { invertDarkModeFilter } from "@excalidraw/common";`
  - `function invertDarkModeFilter(color: string): string`
- `packages/excalidraw/components/EyeDropper.tsx` (U04, edit)
- `packages/excalidraw/CHANGELOG.md` (U05, edit)
