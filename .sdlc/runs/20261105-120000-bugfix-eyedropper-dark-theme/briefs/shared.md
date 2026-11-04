## Conventions

- TypeScript strict, ESM; Prettier 2.6 via @excalidraw/prettier-config (2-space indent, double quotes, trailing commas, 80-col wrap); eslint runs prettier as a rule, so formatting is a lint error.
- Import groups separated by one blank line, in this order: external (react) / @excalidraw/* values / @excalidraw/* type imports / parent and sibling relative values / scss / relative types; type-only imports use a separate `import type` line (eslint import/order and consistent-type-imports, --max-warnings=0).
- Across packages import through the @excalidraw/<pkg> alias (e.g. `@excalidraw/common`); inside a package use relative paths. Never import from the @excalidraw/excalidraw barrel inside packages/excalidraw source.
- Exported helpers are `export const name = (...) => {...}` arrow functions; module-private helpers are plain `const`. Section dividers in colors.ts are `// ---...` comment lines.
- Tests run on Vitest 3 with globals (describe/it/expect/vi, no imports for them), jsdom and vitest-canvas-mock (canvas pixels are not real). Assertions use expect(...).toBe / toMatch / toBeLessThanOrEqual; no new snapshots.
- Integration tests render the full editor with `await render(<Excalidraw ... />)` from ./test-utils and read editor state through `const { h } = window;` (`h.state`, `h.app`).
- Colour strings produced by code are lowercase `#rrggbb` built with `rgbToHex`; alpha is dropped where the eyedropper is concerned.
- No new dependency; colour parsing uses tinycolor2 (already imported in colors.ts).
- Do not change `applyDarkModeFilter`, `cssInvert` or `cssHueRotate` in colors.ts, and do not change or remove any existing test.

## Decisions

- Name and signature of the inverse helper: `export const revertDarkModeFilter = (color: string, candidates: readonly string[] = []): string` in packages/common/src/colors.ts, reached through the existing `export * from "./colors"` of @excalidraw/common. (not invertDarkModeFilter (confusable with the 93% css invert step); not a candidates-only lookup with no numeric fallback) — Reads as the opposite of applyDarkModeFilter, and FR-2 requires the numeric fallback for colours outside every candidate list.
- Candidate order and precedence: Caller candidates are tried first, in the order given, then the module's default candidates; the first candidate whose filtered colour matches wins. (not defaults first) — The filter is lossy, so two colours can share one on-screen pixel; the colours actually present in the scene are the better guess.
- Shape of the returned colour: Always a lowercase 6-digit `#rrggbb` (rgbToHex of the RGB channels), both for a candidate match and for the numeric fallback; an invalid input colour is returned unchanged. (not returning the candidate string verbatim; not keeping the candidate's alpha) — The eyedropper has always emitted 6-digit hex with no alpha, and palette colours are already lowercase 6-digit hex so they round-trip exactly.
- Numeric inverse: Apply the private cssHueRotate(r, g, b, 180 as Degrees) again (the 180 degree hue-rotate matrix is its own inverse), then invert the 93% css invert per channel with `(v - 255 * p) / (1 - 2 * p)` where p = 0.93, then Math.round(clamp(x, 0, 255)) and rgbToHex. (not cssInvert(…, 93) a second time (not the inverse of a partial invert); not an iterative search over the 16M colour space) — Exact algebraic inverse of the two steps up to their rounding and clamping, constant cost per pixel.
- Where the scene candidates are built: Inside EyeDropper.tsx getCurrentColor, only when the theme is dark: appState.viewBackgroundColor first, then every element's strokeColor and backgroundColor from useExcalidrawElements(), deduplicated with a Set, read at event time through the existing useStable object. (not a useMemo in the component body; not a new exported helper module) — Keeps the change inside getCurrentColor and the stable props, adds no file, and costs nothing in light theme (FR-5).
- How the reproducing test injects the pixel: After the eyedropper is open, `vi.spyOn(h.app.canvas.getContext("2d")!, "getImageData").mockReturnValue({ data: new Uint8ClampedArray([r, g, b, 255]) } as unknown as ImageData)`; vitest-canvas-mock returns the same context object for every getContext("2d") call on a canvas, so EyeDropper's ctx is the spied one. (not spying on CanvasRenderingContext2D.prototype (the mock binds methods per instance at construction)) — Targets exactly the context EyeDropper reads, with no global side effect on other tests.

## Files of this change

- `packages/excalidraw/tests/eyeDropper.test.tsx` (U01, edit)
- `packages/common/src/colors.test.ts` (U02, edit)
- `packages/common/src/colors.ts` (U03, edit) — import: `import { revertDarkModeFilter } from "@excalidraw/common";`
  - `const arrow function revertDarkModeFilter(color: string, candidates: readonly string[] (default [])): string`
- `packages/excalidraw/components/EyeDropper.tsx` (U04, edit)
