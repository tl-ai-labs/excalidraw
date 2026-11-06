# Requirements — Bugfix: Dark-theme eyedropper saves the dark-mode-transformed colour

- **Run ID**: `20261106-103201-bugfix-dark-eyedropper`
- **Mode**: brownfield
- **Intent**: bugfix
- **Upstream issue**: `excalidraw/excalidraw#10867`

---

## Reproduce + Diagnose

### Reproduction

1. Switch Excalidraw to dark theme (`appState.theme === THEME.DARK`).
2. Create a near-black rectangle with colour `#1e1e1e` on the canvas. In dark theme, the canvas renderer draws this colour through `applyDarkModeFilter("#1e1e1e")`, producing pixel `#d3d3d3` on the canvas.
3. Select a target shape (or activate the bucket fill tool's temporary eyedropper via `openTemporaryEyeDropper`) and use the eyedropper to pick the pixel from the `#1e1e1e` rectangle for stroke, background, or bucket fill.

- **Observed**: The eyedropper reads the dark-mode-transformed canvas pixel `#d3d3d3` and saves `#d3d3d3` (a near-white hex value) as the element's colour and `appState.currentItem*Color`. The dark-mode renderer then applies `applyDarkModeFilter` a second time to `#d3d3d3`, drawing the target shape as `#383838` on the dark canvas instead of `#d3d3d3`, while the colour picker hex input (`ColorInput`) shows `#d3d3d3` instead of `#1e1e1e`.
- **Expected**: Picking the pixel drawn from `#1e1e1e` saves `#1e1e1e` (and in general, for any dark-rendered pixel `p`, saves `s = invertDarkModeFilter(p)` such that `applyDarkModeFilter(s) === p`), so the target shape renders on the dark canvas as `#d3d3d3` (matching the picked rectangle) and the colour picker's hex value matches `#1e1e1e`.

### Diagnosis

- **Root cause**: In dark theme, Excalidraw draws every colour through `applyDarkModeFilter` (`packages/common/src/colors.ts:83`), which applies `cssInvert(..., 93)` followed by `cssHueRotate(..., 180°)` (each step rounding and clamping to `0–255`). In `packages/excalidraw/components/EyeDropper.tsx:87-94`, `getCurrentColor` reads the raw pixel from the 2D canvas context (`ctx.getImageData` → `rgbToHex`) and passes that already dark-transformed hex value unchanged to both `onChange` (live preview while dragging with pointer down) and `onSelect` (on `pointerup`). Downstream callers (`LayerUI.tsx:512-557`, `ColorPicker/*`, and `App.bucketFill.ts:91-109` → `actionChangeBucketFillBackgroundColor` at `actions/actionProperties.tsx:492`) write this transformed colour into element properties and `appState.currentItem*Color`, causing the renderer to run `applyDarkModeFilter` a second time.

---

## In scope

1. **`packages/common/src/colors.ts`**: Extract the uncached forward dark-mode colour computation from `applyDarkModeFilter` into an internal (unexported) helper shared by both `applyDarkModeFilter` and `invertDarkModeFilter`, and implement and export `invertDarkModeFilter(color: string): string` next to `applyDarkModeFilter` as a single general inverse computation (no special-case branches or lookups for black, white, or any specific colour) that preserves alpha, refines its estimate via the uncached helper without touching `DARK_MODE_COLORS_CACHE`, and guarantees `applyDarkModeFilter(invertDarkModeFilter(p)) === p` for every reachable pixel `p`, while returning a valid hex best estimate without throwing for unreachable pixels.
2. **`packages/common/src/colors.test.ts`** (and `packages/common/src/__snapshots__/colors.test.ts.snap` only if `yarn test:update` rewrites it; no new snapshot is planned): Add unit tests verifying the redraw round-trip across a sampled RGB grid, exact hex recovery for `#1e1e1e`, `#000000`, and `#ffffff`, alpha preservation (`#rrggbbaa`), valid non-throwing hex output for unreachable pixels, and the cache-untouched spy test (`Map.prototype.set` never called by `invertDarkModeFilter` on unreachable or reachable pixels).
3. **`packages/excalidraw/components/EyeDropper.tsx`**: Convert the canvas pixel through `invertDarkModeFilter` in `getCurrentColor` when `appState.theme === THEME.DARK` for both `onChange` (live preview) and `onSelect` (saved colour on pointerup, covering stroke, background, and bucket fill), while keeping `colorPreviewDiv.style.background` set to the raw on-screen pixel and leaving light-theme behaviour unchanged.
4. **`packages/excalidraw/tests/eyeDropper.test.tsx`**: Add jsdom tests covering dark-theme eyedropper colour picking (failing before the fix and passing after), dark-theme bucket-fill temporary eyedropper (`openTemporaryEyeDropper`), and unchanged light-theme colour picking.
5. **`packages/excalidraw/CHANGELOG.md`**: Add one line under the unreleased fixes section for `@excalidraw/excalidraw`.

---

## Out of scope

1. Recovering the exact original pre-transform hex for every colour that `applyDarkModeFilter` clamps or merges (not possible because the 93% invert rounding and 180° hue-rotate clamping make the forward transform many-to-one, reaching 6,163,468 of 16,777,216 RGB colours; only redraw equivalence `applyDarkModeFilter(invertDarkModeFilter(p)) === p` is in scope).
2. Modifying the read-only files `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/components/App.bucketFill.ts`, or `packages/excalidraw/components/App.cursor.ts` (converting in `EyeDropper.tsx` covers all callers, including `App.bucketFill.ts` and `App.cursor.ts` via `currentItemBackgroundColor`).
3. Exporting `invertDarkModeFilter` from the public `@excalidraw/excalidraw` entry point (`packages/excalidraw/index.tsx`).
4. Changing `applyDarkModeFilter`'s results or caching behaviour (beyond extracting its uncached forward computation into an internal helper), the dark-mode palette, or how any element or canvas is rendered.
5. Closest-colour search or error-bound guarantees for pixels `applyDarkModeFilter` cannot reach (such as untransformed raster images, some anti-aliased edges, or pure `#ffffff`, `#000000`, `#0000ff`).
6. Changing how the eyedropper reads images, gradients, or anti-aliased edges (it still reads a single pixel).
7. Phone layout changes (`LayerUI` does not open the eyedropper on phones).
8. Adding `.sdlc/` to `.gitignore` (it remains ignored through `.git/info/exclude`).
9. Exporting `DARK_MODE_COLORS_CACHE` (or any test-only accessor to it).

---

## Functional requirements per module

### Module: `@excalidraw/common` (`packages/common/src/colors.ts`, `packages/common/src/colors.test.ts`)

- **FR-1 (General inverse `invertDarkModeFilter` using shared uncached forward helper)**: Extract the uncached forward computation from `applyDarkModeFilter` into an internal (not exported) helper that both `applyDarkModeFilter` and `invertDarkModeFilter` use, and export `invertDarkModeFilter(color: string): string` next to `applyDarkModeFilter` in `packages/common/src/colors.ts`. `invertDarkModeFilter` must compute the analytic inverse of `cssHueRotate(..., 180°)` followed by the inverse of `cssInvert(..., 93)`, and refine that estimate against the same forward transform through the internal uncached helper (searching a small neighbourhood such as `±3` per RGB channel while keeping the initial estimate itself when its forward transform already matches `p`). `invertDarkModeFilter` must never call the cached `applyDarkModeFilter` and must never read or write `DARK_MODE_COLORS_CACHE`. It must be a single general computation with no special-case branch or lookup table for `#000000`, `#ffffff`, `#1e1e1e`, or any other specific colour.
- **FR-2 (Redraw-exact guarantee for reachable pixels)**: For every pixel `p` reachable by the dark-mode transform (`p = applyDarkModeFilter(c)` for some colour `c`), `s = invertDarkModeFilter(p)` must satisfy `applyDarkModeFilter(s) === p`. Because the initial analytic estimate is kept whenever it already satisfies the forward check, `#1e1e1e`, `#000000`, and `#ffffff` must round-trip to the exact same hex (`invertDarkModeFilter(applyDarkModeFilter(c)) === c`).
- **FR-3 (Alpha preservation)**: `invertDarkModeFilter` must preserve the input colour's alpha channel the same way `applyDarkModeFilter` does (extracting alpha via `tinycolor` and passing it to `rgbToHex`), so an `#rrggbbaa` input returns an `#rrggbbaa` output with identical alpha.
- **FR-4 (Best estimate for unreachable pixels — option (a))**: For any pixel `p` that `applyDarkModeFilter` cannot produce (e.g. pure `#ffffff`, `#000000`, `#0000ff`, or untransformed raster pixels), `invertDarkModeFilter(p)` must return its best estimate as a valid hex string and must never throw.

### Module: `@excalidraw/excalidraw` (`packages/excalidraw/components/EyeDropper.tsx`, `packages/excalidraw/tests/eyeDropper.test.tsx`, `packages/excalidraw/CHANGELOG.md`)

- **FR-5 (Dark-theme conversion in `EyeDropper.tsx`)**: In `packages/excalidraw/components/EyeDropper.tsx`, `getCurrentColor` must convert the sampled canvas pixel hex through `invertDarkModeFilter` when `appState.theme === THEME.DARK`. Both `onChange` (live preview while holding pointer down) and `onSelect` (saving the picked colour on `pointerup` for stroke, background, or bucket fill) must receive the converted colour.
- **FR-6 (Preview swatch shows on-screen pixel)**: The eyedropper preview swatch (`colorPreviewDiv.style.background`) in `EyeDropper.tsx` must continue to be assigned the raw on-screen canvas pixel hex (unconverted), so the floating swatch visually matches the pixel under the cursor.
- **FR-7 (Light theme unchanged)**: When `appState.theme !== THEME.DARK`, `EyeDropper.tsx` must pass the raw canvas pixel hex unchanged to `onChange` and `onSelect`.
- **FR-8 (Changelog entry)**: Add one line under the unreleased fixes section in `packages/excalidraw/CHANGELOG.md` describing the dark-theme eyedropper fix.

---

## Non-functional requirements

- **NFR-1 (Test performance)**: The RGB grid round-trip unit test in `packages/common/src/colors.test.ts` must run in under 1 second.
- **NFR-2 (No forward transform, caching, or rendering changes)**: The only permitted change to `applyDarkModeFilter` is extracting its uncached forward computation into an internal helper; its results for every input and its own caching behaviour (`DARK_MODE_COLORS_CACHE` lookups and sets) must stay exactly as today, and `COLOR_PALETTE` and the canvas rendering pipeline must remain unchanged.
- **NFR-3 (Static verification and lint cleanliness)**: All modified and added code must pass TypeScript strict typechecking (`yarn test:typecheck`) and ESLint with zero warnings (`yarn test:code`).
- **NFR-4 (Dark-mode colour cache untouched by inverse)**: `invertDarkModeFilter` must leave `DARK_MODE_COLORS_CACHE` unchanged (no entries added, read-modified, or removed), including for unreachable pixels where the refinement search runs its full neighbourhood, verified by AC-8.

---

## PII inventory

None applies (purely client-side colour math with no personal data, persistence, or network transmission).

---

## Role matrix

None applies (purely client-side canvas colour-picking utility with no user roles, permissions, or access control).

---

## Acceptance criteria

1. **AC-1 — Reproducing test first (eyedropper)**: A jsdom test in `packages/excalidraw/tests/eyeDropper.test.tsx` fails on the current code and passes after the fix. In dark theme, with a near-black rectangle (`#1e1e1e`) and a selected target shape, it opens the eyedropper and picks the rectangle's pixel. Then the colour picker's hex value (the target element's colour and `currentItem*Color`, which `ColorInput` shows) is `#1e1e1e`, the picked rectangle's colour, not the transformed `#d3d3d3`. Because `vitest-canvas-mock` does not rasterise, the test stubs `getImageData` on the canvas context to return the pixel the dark renderer draws: `applyDarkModeFilter("#1e1e1e")`.
2. **AC-2 — Bucket fill**: A test in `packages/excalidraw/tests/eyeDropper.test.tsx` picks a colour in dark theme with bucket fill's temporary eyedropper (`App.bucketFill.ts` `openTemporaryEyeDropper`) and checks that `appState.currentItemBackgroundColor` stores the corrected colour, `#1e1e1e`. Bucket fill is fixed through `EyeDropper.tsx`; `actionProperties.tsx`, `App.bucketFill.ts`, and `App.cursor.ts` stay read-only.
3. **AC-3 — Light theme unchanged**: A test in `packages/excalidraw/tests/eyeDropper.test.tsx` in light theme picks a pixel and saves exactly that hex.
4. **AC-4 — Round-trip unit tests**: Unit tests in `packages/common/src/colors.test.ts` verify:
   - on a broad sample of colours (an RGB grid at a step that keeps the test under a second): for each colour `c`, with `p = applyDarkModeFilter(c)`, `applyDarkModeFilter(invertDarkModeFilter(p)) === p`;
   - `#1e1e1e`, `#000000`, and `#ffffff` come back as the same hex: `invertDarkModeFilter(applyDarkModeFilter(c)) === c`;
   - alpha is kept: an `#rrggbbaa` input returns an `#rrggbbaa` output with the same alpha.
5. **AC-5 — General inverse**: `invertDarkModeFilter` is one general computation. It has no branch and no lookup for black, white, or any other specific colour.
6. **AC-6 — Pixels the transform cannot reach (option (a), approved at Gate 0)**: `invertDarkModeFilter` returns its best estimate for an unreachable pixel: always a valid hex, never throws. The tests check only that for these pixels. The exact redraw guarantee applies to every pixel the transform can draw; no closest-colour search and no error bound is in scope.
7. **AC-7 — Test command**: Running the fixed verification command word for word passes completely:
   ```sh
   yarn test:typecheck && yarn test:code && yarn test:app --watch=false
   ```
8. **AC-8 — Cache untouched by the inverse**: A unit test in `packages/common/src/colors.test.ts` spies on `Map.prototype.set` (`vi.spyOn`), calls `invertDarkModeFilter` on an unreachable pixel (`#0000ff`, where the full `±3` search runs) and on a reachable one (`#d3d3d3 = applyDarkModeFilter("#1e1e1e")`, computed before the spy is installed so the forward call's own cache write is not counted), asserts `set` was never called, and restores the spy afterwards (`mockRestore`, also on failure, e.g. in a `finally` or `afterEach`). `DARK_MODE_COLORS_CACHE` is not exported for this; the test relies on the vitest `jsdom` environment (`vitest.config.mts` line 84; `colors.test.ts` has no `@vitest-environment` override), where the cache is a live `Map`.

---

## Open questions for HITL

None. Gate 0 resolved all open decisions:
- **Round-trip definition**: Redraw equivalence `applyDarkModeFilter(invertDarkModeFilter(p)) === p` for all reachable dark-mode pixels.
- **Unreachable pixels**: Option (a) — return the best estimate as a valid hex string without throwing.
- **File scope**: Frozen 6-file write allowlist (`packages/common/src/colors.ts`, `packages/common/src/colors.test.ts`, `packages/common/src/__snapshots__/colors.test.ts.snap`, `packages/excalidraw/components/EyeDropper.tsx`, `packages/excalidraw/tests/eyeDropper.test.tsx`, `packages/excalidraw/CHANGELOG.md`), with `actionProperties.tsx`, `App.bucketFill.ts`, and `App.cursor.ts` kept read-only.
