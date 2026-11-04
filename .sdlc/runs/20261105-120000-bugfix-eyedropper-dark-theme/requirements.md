# Requirements — bugfix — Eyedropper picks dark-mode-filtered colour

Run: `20261105-120000-bugfix-eyedropper-dark-theme` · Intent: `bugfix` (reproduce + diagnose) · Policy: `opus55-plus-sonnet55` · Auth: `estimated`

## 1. Reproduction

1. Switch the editor to dark theme (`appState.theme === "dark"`).
2. Draw an element whose stroke or background is a palette colour `X` (e.g. `#e03131`).
3. Open the eyedropper (`i`, or the stroke/background picker's eyedropper, or Alt with the bucket fill), then click the element.
4. Observed: the stored colour is `applyDarkModeFilter(X)` (the colour drawn on screen). Switching back to light theme shows a different colour from `X`.
5. Expected: the stored colour is `X`.

## 2. Diagnosis (verified against HEAD `4872083c`)

- `packages/excalidraw/components/EyeDropper.tsx`, `getCurrentColor` (lines 80-95): reads one pixel with `ctx.getImageData(...)` and returns `rgbToHex(pixel[0], pixel[1], pixel[2])` with no regard to the theme.
- In dark theme the canvas is not CSS-filtered. The renderer converts every colour before drawing with `applyDarkModeFilter` (`packages/common/src/colors.ts` lines 83-118: `cssInvert(…, 93)` then `cssHueRotate(…, 180°)`, each rounding and clamping to 0-255, results memoised in `DARK_MODE_COLORS_CACHE`). It is called from `packages/element/src/renderElement.ts`, `packages/element/src/shape.ts`, `packages/excalidraw/renderer/staticScene.ts`, `renderer/helpers.ts` and others.
- So the pixel under the cursor in dark theme is `applyDarkModeFilter(X)`, and `getCurrentColor` returns that.
- Every consumer goes through `getCurrentColor`: the live preview and `onChange` (pointer move while held), and `onSelect` (pointer up), which serve the LayerUI stroke/background pickers, `App.openEyeDropper` and the bucket-fill Alt eyedropper.
- The filter is lossy (rounding at both steps and clamping after the hue rotation), so a purely numeric inverse cannot recover every `X` exactly. An exact result for known colours needs a reverse lookup over candidate colours; any other pixel gets a best-effort numeric inverse.

## 3. In scope

1. A test that reproduces the bug on HEAD (fails now, passes after the fix).
2. An inverse of the dark-mode filter in `packages/common/src/colors.ts`, exported through `@excalidraw/common`.
3. Applying that inverse in `EyeDropper.tsx` `getCurrentColor` only when the theme is dark.
4. Unit tests for the inverse in `packages/common/src/colors.test.ts`.

## 4. Out of scope

1. Changing `applyDarkModeFilter` or how dark mode is rendered.
2. Hit-testing elements to read their stored properties.
3. Exact recovery for anti-aliased edge pixels, blended overlaps, opacity-blended pixels or images (the numeric fallback gives an approximation).
4. The phone form factor (no eyedropper is rendered there).
5. Any file outside the frozen write contract allowlist: `packages/excalidraw/components/EyeDropper.tsx`, `packages/common/src/colors.ts`, `packages/common/src/colors.test.ts`, `packages/excalidraw/tests/eyeDropper.test.tsx`.

## 5. Functional requirements

- **FR-1 (reproducing test).** `packages/excalidraw/tests/eyeDropper.test.tsx` gains a case that renders the editor in dark theme, stubs the canvas 2D context's `getImageData` (the tests run on `vitest-canvas-mock`) so it returns the RGBA of `applyDarkModeFilter(X)`, picks with the eyedropper, and asserts the colour that reaches the app state (or the `onSelect`/`onChange` consumer) is `X`. On HEAD it gets `applyDarkModeFilter(X)` and fails.
- **FR-2 (inverse helper).** `packages/common/src/colors.ts` exports a function that maps a dark-mode on-screen colour back to the colour that produced it. Given optional candidate colours, it returns the first candidate `c` whose `applyDarkModeFilter(c)` equals the pixel (compared as normalised 6-digit lowercase hex, ignoring alpha). With no exact candidate, it inverts the filter numerically (inverse hue rotation, then inverse of the 93% invert, clamped and rounded to 0-255) and returns a hex colour. It is pure: it does not read or change `DARK_MODE_COLORS_CACHE` except as `applyDarkModeFilter` already does.
- **FR-3 (default candidates).** The default palette colours (every shade of `COLOR_PALETTE`, plus the default stroke, background and canvas-background picks) are always among the candidates, so a palette colour round-trips exactly without the caller passing anything.
- **FR-4 (eyedropper applies it in dark theme).** `getCurrentColor` in `EyeDropper.tsx`, when `appState.theme` is dark, passes the raw hex through the inverse, with the scene's candidate colours (the non-deleted elements' `strokeColor` and `backgroundColor`, and `appState.viewBackgroundColor`) in addition to the defaults. Every consumer (preview, `onChange`, `onSelect`) gets the resolved colour.
- **FR-5 (light theme unchanged).** In light theme `getCurrentColor` returns exactly what it returns today.

## 6. Non-functional requirements

- **NFR-1.** No new dependency. Uses `tinycolor2` and the existing helpers in `colors.ts` only.
- **NFR-2.** Cost per pixel read stays small: the candidate lookup is linear over a few hundred colours at most and reuses `applyDarkModeFilter`'s cache; it runs only in dark theme.
- **NFR-3.** The change passes the project's typecheck and eslint with `--max-warnings=0`, and follows the files' existing style (prettier).
- **NFR-4.** Existing tests keep passing; no existing test is changed or removed.

## 7. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| (none) | — | The change handles colour strings only; no user data is read, stored or sent. |

## 8. Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Eyedropper | Picks a colour from the canvas (unchanged; no permission change) |

## 9. Acceptance criteria

- **AC-1.** The reproducing test (FR-1) fails on HEAD: in dark theme, eyedropping a pixel rendered from `X` yields `applyDarkModeFilter(X)` instead of `X`.
- **AC-2.** After the fix that test passes: the picked colour equals `X`, for a default palette colour and for the canvas background colour.
- **AC-3.** For every default palette colour `X`, `inverse(applyDarkModeFilter(X)) === X` (unit test in `colors.test.ts`).
- **AC-4.** With a candidate list, an exact candidate is returned; with a pixel that matches no candidate, the numeric inverse returns a valid 7-character hex colour whose `applyDarkModeFilter` is within a small per-channel distance of the pixel (unit test).
- **AC-5.** Light theme: the eyedropper still returns the raw pixel; the existing eyedropper and colour-picker tests still pass.
- **AC-6.** The exact command `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`, run from the repository root as one command, exits 0. There is no exemption: a failure that already fails on HEAD still fails this criterion. HEAD is measured once as a diagnostic (section 11). That measurement only explains a failure and never lowers this bar. If HEAD fails in a way the four allowlisted files cannot fix, AC-6 is reported as not met, with the failing command and its error. It is not reworded, and the person decides whether to widen the scope in a new run.

## 10. Open questions for HITL

None blocking. Assumptions taken:

1. The inverse's name and signature are the architect's choice (the brief suggests a reverse-match helper with a numeric fallback; FR-2 fixes the behaviour, not the name).
2. Alpha is ignored in the comparison: the eyedropper already drops alpha (`rgbToHex(r, g, b)`).

## 11. HEAD diagnostic (measured 2026-11-05, HEAD `4872083c`, clean tree)

This section only explains where the code starts from. It does not relax AC-6. Each part of the test command was run once on HEAD:

| Part | Exit | Result |
|---|---|---|
| `yarn test:typecheck` | 0 | clean |
| `yarn test:code` (eslint, `--max-warnings=0`) | 0 | clean (jsx-ast-utils prints `MetaProperty` notices on stderr; they are not warnings and do not affect the exit code) |
| `yarn test:app --watch=false` | 0 | 121 test files passed; 1839 tests passed, 47 skipped, 1 todo |

HEAD has no failures before the change, so any failure after it belongs to this run and must be fixed for AC-6 to pass.
