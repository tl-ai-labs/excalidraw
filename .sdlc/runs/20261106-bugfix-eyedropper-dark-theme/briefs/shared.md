## Conventions

- Use double quotes, semicolons, 2-space indentation, and trailing commas in multiline lists per @excalidraw/prettier-config and @excalidraw/eslint-config.
- Order imports with blank lines between groups: builtin/external first, then @excalidraw/** packages, then parent/sibling relative imports, with separate `import type` statements (`@typescript-eslint/consistent-type-imports`).
- Tests run under Vitest with globals (`describe`, `it`, `expect`, `vi`) in jsdom; use plain assertions (`expect(...).toBe(...)`) and never use or update snapshots.
- Never import from the barrel `@excalidraw/excalidraw` inside `packages/excalidraw/` non-test source files; use `@excalidraw/common` and relative imports.

## Decisions

- Inverse dark-mode transform function signature and export: Export `invertDarkModeFilter = (color: string, enable = true): string` from `packages/common/src/colors.ts` (automatically re-exported by `export * from "./colors"` in `packages/common/src/index.ts`). (not Private helper inside EyeDropper.tsx; not Redundant named re-export in packages/common/src/index.ts) — FR-1 and FR-5 require the inverse helper to be exported from `@excalidraw/common` for both `EyeDropper.tsx` and `colors.test.ts`, and `packages/common/src/index.ts` already re-exports all exports from `./colors`.
- Inverse dark-mode colour calculation algorithm: Find integer inverted channels `(invR, invG, invB)` in `[18, 237]^3` whose `cssHueRotate(invR, invG, invB, 180 as Degrees)` minimizes squared RGB distance to target `tc.toRgb()` (checking the 3x3x3 neighborhood of `cssHueRotate(r, g, b, 180)` first, then scanning `invG` in `18..237` using `0.426 * invR + 0.430 * invG + 0.144 * invB = G` to recover channels clamped to 0 or 255 by `cssHueRotate`), then un-invert each channel via `Math.round(clamp((255 * 0.93 - inv) / 0.86, 0, 255))` and format with `rgbToHex(r, g, b, alpha)`. (not Lookup tables or special-case branches for black/white; not Direct algebraic matrix inverse without handling `cssHueRotate` clamping at 0 and 255) — Saturated colours such as `COLOR_PALETTE.yellow` and pure RGB primaries clamp in `cssHueRotate`, so scanning `invG` in `18..237` when the direct neighborhood does not match achieves exact round-trip `applyDarkModeFilter(invertDarkModeFilter(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` for all colours and exact `invertDarkModeFilter(applyDarkModeFilter(c)) === c` for `#000000`, `#ffffff`, and `#1e1e1e` in O(1) time without lookup tables.
- Eyedropper dark-theme inversion point: Apply `invertDarkModeFilter(rgbToHex(pixel[0], pixel[1], pixel[2]), appState.theme === THEME.DARK)` inside `getCurrentColor` in `packages/excalidraw/components/EyeDropper.tsx` and add `appState.theme` to its `useEffect` dependencies. (not Storing dark-mode-filtered colours in appState or element properties) — `getCurrentColor` in `EyeDropper.tsx` feeds the preview bubble (which is CSS-filtered by `var(--theme-filter)`), live drag `onChange`, and pointer-up `onSelect` with the canonical colour.
- Bucket-fill cursor droplet dark-theme colour and memo key: In `packages/excalidraw/components/App.cursor.ts` (`AppCursor.applyForTool`), include `activeTool.type === "bucketfill"` in `theme` for `toolCursorMemo` and pass `applyDarkModeFilter(bucketFillColor!, this.app.state.theme === THEME.DARK)` to `createBucketFillCursorDataURL`. (not Drawing the bucket-fill cursor droplet with the untransformed canonical colour in dark theme) — The canvas cursor SVG is not CSS-filtered, so in dark theme the droplet must apply `applyDarkModeFilter` to match the picked/painted canvas colour and `toolCursorMemo` must record `theme` for `bucketfill` when `applyForTool` runs.

## Files of this change

- `packages/common/src/colors.test.ts` (U01, edit)
- `packages/excalidraw/tests/eyeDropper.test.tsx` (U02, edit)
- `packages/common/src/colors.ts` (U03, edit)
  - `function invertDarkModeFilter(color: string, enable: boolean): string`
- `packages/excalidraw/components/EyeDropper.tsx` (U04, edit)
- `packages/excalidraw/components/App.cursor.ts` (U05, edit)
