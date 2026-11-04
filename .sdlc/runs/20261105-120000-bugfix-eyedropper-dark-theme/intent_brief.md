# Intent Brief — bugfix — Eyedropper picks dark-mode-filtered colour

## Context
Observed (user's words): "In dark theme the eyedropper saves the on-screen dark-mode colour instead of the element's real colour."

In dark theme the canvas is not CSS-filtered; each colour is converted before drawing via
`applyDarkModeFilter` (`packages/common/src/colors.ts`: invert 93% then hue-rotate 180°).
`EyeDropper.tsx`'s `getCurrentColor` reads the raw canvas pixel (`ctx.getImageData` → `rgbToHex`)
and returns it unchanged, so every eyedropper consumer (live preview/`onChange`, stroke/background
picker `onSelect`, bucket-fill Alt eyedropper) stores the dark-mode on-screen colour. Toggling back to
light theme then shows a different colour from the one sampled.

## Goal
When `appState.theme === "dark"`, the eyedropper resolves the sampled pixel back to the colour that
was rendered to produce it (the light-theme / stored colour) before handing it to `onChange` /
`onSelect`. Light-theme behaviour is unchanged.

Suggested approach (architect decides): add an inverse of `applyDarkModeFilter` in
`packages/common/src/colors.ts`. Prefer an exact reverse match against known candidate colours (scene
element stroke/background colours, `viewBackgroundColor`, palette colours) where
`applyDarkModeFilter(candidate) === pixel`, falling back to a numeric inverse of the filter maths
otherwise. Apply it in `getCurrentColor` only in dark theme.

## Files in scope
- `packages/excalidraw/components/EyeDropper.tsx` — apply the inverse in `getCurrentColor` when theme is dark
- `packages/common/src/colors.ts` — new inverse helper (exported via existing `export * from "./colors"`)
- `packages/common/src/colors.test.ts` — reproducing/regression unit tests for the inverse (round-trip of palette colours)
- `packages/excalidraw/tests/eyeDropper.test.tsx` — reproducing test: dark theme + stubbed `getImageData` returning `applyDarkModeFilter(X)`; picking sets `X`, not the filtered value

## Files off-limits
Project defaults (`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`) plus detected AI configs
(`.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`), `**/node_modules/**`, `**/dist/**`,
`**/build/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `.yarn/**`,
`packages/excalidraw/subset/woff2/woff2-wasm.ts`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`.

## Acceptance criteria
1. A test fails on current HEAD: in dark theme, eyedropping a pixel rendered from colour `X` yields the filtered colour instead of `X`.
2. After the fix, that test passes: the picked/stored colour equals `X` for `X` in the default palette and for the canvas background.
3. For every default palette colour `X`, `inverse(applyDarkModeFilter(X)) === X`.
4. Light theme: picked colour is the raw pixel (unchanged behaviour); existing eyedropper and colour-picker tests still pass.
5. The test command, run as one command, exits 0: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (typecheck, then eslint with `--max-warnings=0`, then the full vitest run).

## Gate 0 (approved 2026-11-05)
- Auth mode: estimated · Policy: opus55-plus-sonnet55 · `.gitignore` `.sdlc/` entry: declined
- Allowlist and off-limits frozen as listed above (write contract).

## Test command
`yarn test:typecheck && yarn test:code && yarn test:app --watch=false`

## Non-goals
- Changing `applyDarkModeFilter` itself or how dark mode is rendered.
- Hit-testing elements to read stored properties directly.
- Exact recovery for anti-aliased edge pixels or images: the numeric fallback gives a best-effort approximation.
- The phone form factor (no eyedropper is rendered there).
