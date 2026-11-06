# Intent Brief — bugfix — Eyedropper saves dark-mode-transformed colour

## Context
In dark theme Excalidraw draws every colour through a dark-mode transform
(`applyDarkModeFilter` in `packages/common/src/colors.ts`: invert 93% then hue-rotate 180°).
The eyedropper (pick a colour from the canvas for stroke or background) reads the transformed
canvas pixel via `ctx.getImageData` in `packages/excalidraw/components/EyeDropper.tsx` and saves
it as the new colour. Picking a near-black rectangle turns the target shape near-white.
Reported in excalidraw/excalidraw#10867.

## Goal
In dark theme, the target shape shows the same colour as the picked rectangle, and the colour
picker's hex value matches it.

## Files in scope
- `packages/common/src/colors.ts` — an inverse of the dark-mode colour transform. It must round-trip, not special-case black and white.
- `packages/common/src/colors.test.ts` — round-trip unit tests
- `packages/common/src/index.ts` — only if the new helper needs re-exporting
- `packages/excalidraw/components/EyeDropper.tsx` — the eyedropper
- `packages/excalidraw/actions/actionProperties.tsx` — eyedropper user
- `packages/excalidraw/components/App.bucketFill.ts` — eyedropper user (temporary eyedropper)
- `packages/excalidraw/components/App.cursor.ts` — eyedropper user (cursor)
- `packages/excalidraw/tests/eyeDropper.test.tsx` — jsdom reproducing test (fails before the fix)

## Files off-limits
Project defaults (`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus `.claude/**`,
`CLAUDE.md`, `.gitignore`, every existing snapshot (`**/__snapshots__/**`), and generated output
(`packages/excalidraw/types/**`, `dev-dist/**`, `coverage/**`,
`packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`).
Anything not in the allowlist is out of scope.

## Acceptance criteria
1. In dark theme, picking a colour from an element and applying it to another shape gives the
   target the same colour as the picked element, and the colour picker's hex value matches it.
2. `packages/common/src/colors.test.ts`: unit tests for the round trip
   (inverse(applyDarkModeFilter(c)) returns c), no special-casing of black and white.
3. `packages/excalidraw/tests/eyeDropper.test.tsx`: jsdom tests picking a colour in dark theme;
   the test fails before the fix and passes after.
4. Light theme behaviour unchanged.
5. The test command passes, word for word:
   `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
6. No existing snapshot changes. Never run `yarn test:update` (overrides CLAUDE.md for this run).

## Non-goals
- Changing the dark-mode rendering transform itself.
- Exact inversion of pixels outside the transform's output range (e.g. over embedded images):
  they clamp to the nearest invertible colour — accepted limitation.
- Adding `.sdlc/` to `.gitignore` (it stays ignored via `.git/info/exclude`).
- UI/UX changes to the colour picker.
