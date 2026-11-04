## Conventions

- TypeScript strict; Prettier 2.6 via @excalidraw/prettier-config (80 columns, double quotes, trailing commas, semicolons); eslint runs with --max-warnings=0.
- Import order (eslint import/order): external packages, then @excalidraw/* packages, then a blank line, then type-only imports (`import type`) in their own group, then parent/sibling relative imports; type imports use `import type`, never inline `type` specifiers.
- Inside an import's braces keep the existing case-insensitive alphabetical order (e.g. `EVENT, KEYS, revertDarkModeFilter, rgbToHex, THEME`).
- Tests run under vitest 3 with globals (describe/it/expect/vi are global, never imported); assertions use expect(...).toBe / toBeLessThanOrEqual; editor tests render <Excalidraw /> with ./test-utils `render` and read state through `const { h } = window;`.
- Every colour helper in packages/common/src/colors.ts returns lowercase hex built with rgbToHex (6 chars when opaque, 8 chars with alpha otherwise).
- Do not touch applyDarkModeFilter, cssInvert, cssHueRotate or DARK_MODE_COLORS_CACHE: the dark-mode render path stays byte-identical.
- Never run or require `yarn test:update`; no snapshot file changes.

## Decisions

- Name and signature of the inverse: export const revertDarkModeFilter = (color: string): string in packages/common/src/colors.ts, placed directly after applyDarkModeFilter, re-exported through the existing `export * from "./colors"` in @excalidraw/common. (not a `revert` flag on applyDarkModeFilter; not a new module file) — A separate pure function keeps the forward path and its cache untouched and matches the requirements' suggested name.
- Inverse math: Undo hue-rotate(180deg) with the same matrix (it equals 2L - I where L is the luminance projection with weights 0.213/0.715/0.072 summing to 1, so it is its own inverse; sin(180deg) terms are ~1e-16), computed unrounded as y = 0.213r + 0.715g + 0.072b and v = 2y - channel; then undo invert(93%) per channel as x = (237.15 - v) / 0.86; clamp x to [0,255] and round once at the end. (not calling cssHueRotate(…, 180) again (it rounds and clamps mid-way, which pushes worst-case error past ±2); not a numeric 3x3 matrix inversion) — Closed form is exact for the unclamped case, single final rounding keeps the round-trip error within ±2 per channel (worst case ~1.83 before rounding).
- Inverse caching: No cache for revertDarkModeFilter; never read or write DARK_MODE_COLORS_CACHE from it. (not sharing DARK_MODE_COLORS_CACHE; not a second Map cache) — The function is a handful of arithmetic ops per pointer move; the shared cache maps light->dark and must not be polluted with dark->light entries.
- Where the eyedropper maps the colour back: EyeDropper.tsx keeps getCurrentColor returning the raw sampled hex (used for the preview swatch) and adds a local getPickedColor(color) inside the same useEffect that returns revertDarkModeFilter(color) when appState.theme === THEME.DARK, else color; only the onChange and onSelect arguments go through getPickedColor; appState.theme is added to the effect's dependency array. (not mapping inside getCurrentColor (would change the preview swatch, violating FR-3); not mapping in LayerUI/App callbacks (outside the allowlist and duplicated across three call paths)) — One choke point covers the stroke/background picker, the `i` hotkey and the bucket-fill temporary eyedropper, while the preview keeps showing what is under the cursor.
- How tests simulate a dark-rendered pixel: Render <Excalidraw theme={THEME.DARK} … /> (or theme light), open the background eyedropper with Keyboard.keyPress("i"), stub `vi.spyOn(h.app.canvas.getContext("2d")!, "getImageData").mockReturnValue({ data: new Uint8ClampedArray([r, g, b, 255]) } as ImageData)` with the channels of applyDarkModeFilter("#1971c2"), then fire pointerDown and pointerUp on the `.excalidraw-eye-dropper-backdrop` element and assert on h.state.currentItemBackgroundColor. (not asserting on a selected element's backgroundColor (needs element setup with no extra coverage); not hardcoding the dark pixel (#56a2e8)) — vitest-canvas-mock caches one 2D context per canvas, so the stub is the same ctx EyeDropper reads; with no selection App's onSelect writes currentItemBackgroundColor.
- Tolerance comparison in tests: Each test file defines a local helper that parses #rrggbb[aa] with parseInt(hex.slice(i, i + 2), 16) and asserts Math.abs(actual - expected) <= 2 for each of r, g, b. (not importing tinycolor2 in tests; not exact string equality for dark-theme results) — The round-trip of #1971c2 yields #1971c3, so exact equality is wrong by design; a tiny local parser needs no new import.

## Files of this change

- `packages/excalidraw/tests/eyeDropper.test.tsx` (U01, edit)
- `packages/common/src/colors.test.ts` (U02, edit)
- `packages/common/src/colors.ts` (U03, edit) — import: `import { revertDarkModeFilter } from "@excalidraw/common";`
  - `const arrow function revertDarkModeFilter(color: string): string`
- `packages/excalidraw/components/EyeDropper.tsx` (U04, edit)
