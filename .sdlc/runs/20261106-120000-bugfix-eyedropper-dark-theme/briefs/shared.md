## Conventions

- TypeScript with strict mode, double quotes, semicolons, 2-space indentation, and trailing commas (enforced by ESLint + Prettier via eslint --max-warnings=0).
- Use separate type imports (`import type { ... } from ...`) per `@typescript-eslint/consistent-type-imports`.
- Order imports with blank lines between groups: builtin/external first, then `@excalidraw/**` packages, then parent (`../`), then sibling (`./`), then type imports (`import/order` with `newlines-between: always-and-inside-groups`).
- All hex colour strings produced by `rgbToHex` and `colorToHex` are lowercase 6-digit `#rrggbb` (or 8-digit `#rrggbbaa` when `0 <= alpha < 1`).
- Vitest with globals (`describe`, `it`, `expect`, `vi`) and `@testing-library/react` (`render`, `fireEvent`, `waitFor`, `act`) via `packages/excalidraw/tests/test-utils`; never run `yarn test:update`.

## Decisions

- Exported dark-mode inverse function name and signature in `@excalidraw/common`: Export `invertDarkModeFilter = (color: string, enable = true): string` from `packages/common/src/colors.ts` (re-exported via `packages/common/src/index.ts`). (not unapplyDarkModeFilter; not reverseDarkModeFilter) — `invertDarkModeFilter` pairs directly with `applyDarkModeFilter(color: string, enable = true): string` and shares the identical `(color: string, enable = true): string` signature.
- Exact palette recovery + algebraic inverse with neighbourhood refinement in `invertDarkModeFilter`: Lazily build a reverse palette `Map<string, string>` over `COLOR_PALETTE` and `DEFAULT_CANVAS_BACKGROUND_PICKS` for exact palette hex equality, and for non-palette colours invert `cssHueRotate(..., 180)` then `Math.round(clamp((237.15 - v) / 0.86, 0, 255))` per channel, refining within a `[-2, 2]` Manhattan-ordered neighbourhood when needed so `applyDarkModeFilter(invertDarkModeFilter(x)) === x` holds for every `x` in the transform's image. (not Pure algebraic formula without palette map or neighbourhood check; not Hardcoded black/white lookup only) — Guarantees both exact palette round trips (`invertDarkModeFilter(applyDarkModeFilter(c)) === c`) and exact on-screen round trips (`applyDarkModeFilter(invertDarkModeFilter(x)) === x`) while keeping per-channel error <= 3 on unclamped custom colours.
- Dark-theme colour resolution order in `EyeDropper.tsx` `getCurrentColor`: In dark theme (`appState.theme === THEME.DARK`), check hit elements under the cursor in top-down z-order via `hitElementItself` (preferring the property matching `colorPickerType` when both `strokeColor` and `backgroundColor` render to `pixelHex`), then check `app.state.viewBackgroundColor`, and finally fall back to `invertDarkModeFilter(pixelHex, true)` (including for semi-transparent/blended pixels where `pixelHex` does not match the unblended dark-mode colour). (not Pixel-only inverse without checking scene elements under cursor; not Global scene colour search ignoring cursor position; not Returning unblended element colour for semi-transparent shapes) — Recovers the exact stored hex for clamped saturated shapes (e.g. `#ff00ff` rendering `#ff70ff`), resolves ties in favour of the shape under the cursor in z-order, and preserves light-theme-consistent composite fallback for blended/image/grid pixels.

## Files of this change

- `packages/common/src/colors.test.ts` (U01, edit)
- `packages/excalidraw/tests/eyeDropper.test.tsx` (U02, edit)
- `packages/common/src/colors.ts` (U03, edit) — import: `import { invertDarkModeFilter } from "@excalidraw/common";`
  - `function invertDarkModeFilter(color: string, enable: boolean): string`
- `packages/excalidraw/components/EyeDropper.tsx` (U04, edit)
