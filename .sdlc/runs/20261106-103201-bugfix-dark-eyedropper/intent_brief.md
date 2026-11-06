# Intent Brief — bugfix — Dark-theme eyedropper saves the dark-mode-transformed colour

## Context

In dark theme, Excalidraw draws every colour through `applyDarkModeFilter`
(`packages/common/src/colors.ts:83`): `cssInvert(…, 93)`, then `cssHueRotate(…, 180°)`,
each step rounding and clamping to 0–255. The eyedropper reads the canvas pixel
(`packages/excalidraw/components/EyeDropper.tsx:87-94`, `getCurrentColor`:
`ctx.getImageData` → `rgbToHex`) and passes that hex unchanged to both `onChange`
(live preview while dragging) and `onSelect` (on pointerup). In dark theme the pixel is
already transformed, so the transformed colour is saved as the element's colour, and the
renderer transforms it a second time. Picking a near-black rectangle (`#1e1e1e`, drawn as
`#d3d3d3`) saves `#d3d3d3` as the colour. That is a near-white colour value, and it draws
as `#383838` on the dark canvas instead of the picked `#d3d3d3`.
Reported in excalidraw/excalidraw#10867.

The person's own words:

> Observed: in dark theme Excalidraw draws every colour through a dark-mode transform. The
> eyedropper (pick a colour from the canvas for stroke or background) reads the transformed
> pixel and saves it as the new colour. Picking a near-black rectangle turns the target shape
> near-white. Reported in excalidraw/excalidraw#10867.
>
> Expected: the target shape shows the same colour as the picked rectangle, and the colour
> picker's hex value matches it.
>
> Files involved: packages/common/src/colors.ts (an inverse of the dark-mode colour transform)
> and the eyedropper and its users in packages/excalidraw (components/EyeDropper.tsx,
> actions/actionProperties.tsx, App.bucketFill.ts, App.cursor.ts). The inverse must
> round-trip, not special-case black and white.
>
> How we know it's fixed: unit tests in packages/common/src/colors.test.ts for the round trip
> and jsdom tests in packages/excalidraw/tests/eyeDropper.test.tsx picking a colour in dark
> theme; the test fails before the fix; yarn test:typecheck, yarn test:code and yarn test:app
> pass.

**What "round-trip" means (agreed at Gate 0, measured before this brief).** For a picked
pixel `p`, the saved colour `s = invertDarkModeFilter(p)` satisfies
`applyDarkModeFilter(s) === p`: drawn through the dark-mode transform, it gives back
exactly that pixel.

The dark transform is not one-to-one. Rounding after the 93% invert merges neighbouring
values, and the hue rotate clamps about 43% of colours: palette red `#e03131` and orange
`#f08c00` are among them. So no inverse can recover the original hex of every colour; the
agreed guarantee is the redraw one above. It also means the transform reaches only
6,163,468 of the 16,777,216 RGB colours (36.7%, counted exhaustively). Every pixel the dark
renderer draws for a shape, stroke, text or the canvas background is one of these, since
it is `applyDarkModeFilter` output. For those, the guarantee is achievable: a plain
analytic inverse (the matrix inverse of the hue rotate, then the inverse of the 93% invert)
meets it on about 61% of a sampled grid. Refining that estimate against the forward
transform (searching the colours within ±3 per channel of it for one whose forward
transform is `p`, and keeping the estimate itself when it already matches) met it on all
6,163,468 reachable colours, checked exhaustively. Keeping the estimate when it matches is
what makes `#1e1e1e`, `#000000` and `#ffffff` come back as the same hex. It is general, not
a special case.

A pixel the transform cannot reach (a raster image, which dark mode draws untransformed;
some anti-aliased edges; pure `#ffffff`, `#000000`, `#0000ff`) has no colour that redraws as
it. See "Pixels the transform cannot reach" under the acceptance criteria.

**How the picked colour flows.** `EyeDropper` → `LayerUI.tsx:512-557` (`onChange` mutates
the selected elements' `strokeColor` / `backgroundColor` or sets `currentItem*Color`;
`onSelect` calls the opener's `onSelect`) → openers: `ColorPicker/ColorPicker.tsx`,
`ColorPicker/Picker.tsx`, `ColorPicker/ColorInput.tsx`, `ColorPicker/keyboardNavHandlers.ts`
(the `i` hotkey), and `App.bucketFill.ts:91-109` (`openTemporaryEyeDropper` →
`actionChangeBucketFillBackgroundColor`, `actions/actionProperties.tsx:492`). Converting
once in `EyeDropper`'s `getCurrentColor` covers every path, the live preview included.

## Goal

In dark theme, a colour picked with the eyedropper — for stroke, background, or the bucket
fill tool — is saved as the colour that redraws as the pixel the person picked, so the
target shape looks the same as the picked shape. In light theme, behaviour is unchanged.

## Files in scope

Approved at Gate 0 on 2026-11-06 and frozen in the write contract (run
`20261106-103201-bugfix-dark-eyedropper`, 6 allowlist entries, 20 off-limits patterns).
Run settings confirmed there: auth mode `vendor`, policy `argon4-agsdk-only`, test command
`yarn test:typecheck && yarn test:code && yarn test:app --watch=false` (word for word).

Allowlist:

- `packages/common/src/colors.ts` — add the exported inverse (proposed name
  `invertDarkModeFilter(color: string): string`), next to `applyDarkModeFilter`. It must not
  special-case black and white. It must keep the alpha the way `applyDarkModeFilter` does.
- `packages/common/src/colors.test.ts` — round-trip unit tests (see acceptance criteria).
- `packages/common/src/__snapshots__/colors.test.ts.snap` — only if the run's
  `yarn test:update` rewrites it; no new snapshot is planned.
- `packages/excalidraw/components/EyeDropper.tsx` — in `getCurrentColor`, convert the pixel
  through the inverse when `appState.theme === THEME.DARK`. Both the live preview
  (`onChange`) and the saved colour (`onSelect`) use it. The preview swatch
  (`colorPreviewDiv.style.background`) keeps showing the on-screen pixel, so the swatch
  still matches what the person is pointing at.
- `packages/excalidraw/tests/eyeDropper.test.tsx` — the reproducing jsdom test (see below).
  **Bugfix rule:** the run proves the fix with a test that fails on the bug first; a bugfix
  plan without a test file it may write is refused before any file is written.
- `packages/excalidraw/CHANGELOG.md` — one line under the unreleased fixes section, since
  `@excalidraw/excalidraw` is published to npm.

Named by the person, **read-only** for this run (agreed at Gate 0): `packages/excalidraw/actions/actionProperties.tsx`,
`packages/excalidraw/components/App.bucketFill.ts`,
`packages/excalidraw/components/App.cursor.ts`. Reading them showed none needs a change
once the conversion happens in `EyeDropper`: bucket fill's `onSelect` receives the already
converted colour; `App.cursor.ts` draws the bucket cursor from
`getBucketFillBackgroundColor(currentItemBackgroundColor)`, which then holds the correct
colour. The bucket-fill path is covered by a test in `eyeDropper.test.tsx`, not by edits.

Considered and left out: exporting the inverse from `packages/excalidraw/index.tsx` (which
re-exports `applyDarkModeFilter`) — adding a public API is out of scope for a bugfix.

## Files off-limits

From `.sdlc/project.json` `off_limits_default`: `.env`, `.env.*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`,
`build/**`, `.next/**`, `.sdlc/**`, `.git/**`.

AI configs detected (default off-limits): `.claude/**`, `CLAUDE.md`,
`.github/copilot-instructions.md`.

Added for this ticket from discovery: `yarn.lock`, `dev-dist/**`, `coverage/**`,
`packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`,
`packages/excalidraw/subset/woff2/woff2-wasm.ts`.

## Acceptance criteria

1. **Reproducing test first (eyedropper).** A jsdom test in
   `packages/excalidraw/tests/eyeDropper.test.tsx` fails on the current code and passes
   after the fix. In dark theme, with a near-black rectangle (`#1e1e1e`) and a selected
   target shape, it opens the eyedropper and picks the rectangle's pixel. Then the colour
   picker's hex value (the target element's colour and `currentItem*Color`, which
   `ColorInput` shows) is `#1e1e1e`, the picked rectangle's colour, not the transformed
   `#d3d3d3`. vitest-canvas-mock does not rasterise, so the test stubs `getImageData` on the
   canvas context to return the pixel the dark renderer draws: `applyDarkModeFilter("#1e1e1e")`.
2. **Bucket fill.** A test in the same file picks a colour in dark theme with bucket fill's
   temporary eyedropper (`App.bucketFill.ts` `openTemporaryEyeDropper`) and checks that
   `appState.currentItemBackgroundColor` stores the corrected colour, `#1e1e1e`. Bucket fill
   is fixed through `EyeDropper.tsx`; `actionProperties.tsx`, `App.bucketFill.ts` and
   `App.cursor.ts` stay read-only.
3. **Light theme unchanged.** A test in light theme picks a pixel and saves exactly that hex.
4. **Round-trip unit tests** in `packages/common/src/colors.test.ts`:
   - on a broad sample of colours (an RGB grid at a step that keeps the test under a
     second): for each colour `c`, with `p = applyDarkModeFilter(c)`,
     `applyDarkModeFilter(invertDarkModeFilter(p)) === p`;
   - `#1e1e1e`, `#000000` and `#ffffff` come back as the same hex:
     `invertDarkModeFilter(applyDarkModeFilter(c)) === c`;
   - alpha is kept: an `#rrggbbaa` input returns an `#rrggbbaa` output with the same alpha.
5. **General inverse.** `invertDarkModeFilter` is one general computation. It has no branch
   and no lookup for black, white or any other specific colour.
6. **Pixels the transform cannot reach** (option (a), approved at Gate 0). The inverse
   returns its best estimate for such a pixel: always a valid hex, never throws. The tests
   check only that for these pixels. The exact guarantee above applies to every pixel the
   transform can draw. No closest-colour search and no error bound is in scope.
7. **Test command** (the study's fixed command, run word for word):
   `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`. It passes after
   the change. Before the run, on 2026-11-06 at HEAD `4872083c0`, every part passes:
   `yarn test:typecheck`, `yarn test:code` (eslint, 0 warnings), and
   `yarn test:app --watch=false` (121 files; 1839 passed, 47 skipped, 1 todo).

## Non-goals

- Recovering the exact original hex for colours the transform clamps or merges (not
  possible: the transform is not one-to-one). The goal is a colour that redraws identically.
- Adding `.sdlc/` to `.gitignore`: it stays ignored through `.git/info/exclude`.
- Changing `applyDarkModeFilter`, the dark-mode palette, or how anything is rendered.
- The phone layout: `LayerUI` does not open the eyedropper on phones.
- Exporting the inverse from the public `@excalidraw/excalidraw` entry point.
- Changing how the eyedropper reads images, gradients or anti-aliased edges (it still
  reads one pixel).
- Any change to `App.cursor.ts`, `App.bucketFill.ts` or `actionProperties.tsx` beyond what
  Gate 0 explicitly moves into scope.
