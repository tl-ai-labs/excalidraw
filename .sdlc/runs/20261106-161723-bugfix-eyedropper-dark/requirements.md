# Requirements — bugfix — Eyedropper picks dark-mode-rendered colour

Run: `20261106-161723-bugfix-eyedropper-dark` · intent: bugfix (reproduce + diagnose) · revision 2
(Gate 1 revise: exact hex match for any shape colour; the inverse helper and its round-trip tests
are mandatory).

## Reproduction

1. Open the editor with `theme: "dark"`.
2. Draw an element whose stored colour is known (e.g. `backgroundColor: "#ff00ff"`).
3. Press `i` (eyedropper), move over the element and release the pointer.
4. Observed: the colour handed to `onSelect` / `onChange` is the on-screen colour, i.e.
   `applyDarkModeFilter("#ff00ff")` (= `#ff70ff`), not `#ff00ff`. Re-applying it renders a
   different (double-transformed) colour.
5. Expected: the colour handed on is exactly the shape's stored scene colour, `#ff00ff`.

## Diagnosis

- `packages/excalidraw/components/EyeDropper.tsx`, `getCurrentColor` (lines ~80–95) reads one
  canvas pixel with `ctx.getImageData(...)` and returns `rgbToHex(r, g, b)` unchanged.
- In dark theme the renderer draws element (and canvas background) colours through
  `applyDarkModeFilter` (`packages/common/src/colors.ts`, lines 83–117): `cssInvert(…, 93)` then
  `cssHueRotate(…, 180)`, each step rounding and clamping to `[0, 255]`.
- So in dark theme the pixel is the transformed colour, and nothing maps it back.
- **The filter is not injective, so no function of the pixel alone can return the stored hex
  exactly.** Measured over the filter as written: the 93 % invert step maps 256 integer levels
  onto ~220 (slope 0.86, then rounding), and the hue-rotate step clamps saturated colours
  (`#ff00ff` → `(18,237,18)` → `(1.30, 0.44, 1.30)` clamped to `#ff70ff`). 41 of the 62 colours
  in `COLOR_PALETTE` share their dark-mode rendering with at least one other colour (e.g.
  `#c2255c` with 151 others, `#ffd43b` with 134 others).
- Consequence: the exact-match guarantee the brief asks for (FR-1) has to come from the scene —
  the stored colour of what is under the cursor — with the inverse helper (FR-4) as the
  render-equivalent fallback for pixels no scene colour accounts for.

## In scope

1. Make the eyedropper return the shape's stored (light-theme) colour exactly when
   `appState.theme` is dark.
2. A reproducing test in `packages/excalidraw/tests/eyeDropper.test.tsx` that fails before the fix.
3. **An inverse of the dark-mode transform, exported from `packages/common/src/colors.ts`.**
4. **Round-trip unit tests for that inverse in `packages/common/src/colors.test.ts`** (and its
   snapshot file `packages/common/src/__snapshots__/colors.test.ts.snap` only if a snapshot is used).

## Out of scope

1. Changing how dark mode renders (`applyDarkModeFilter` behaviour and cache must not change).
2. Eyedropper UI, hotkeys, preview positioning, bucket-fill flow.
3. Any file outside the frozen allowlist (other modules may be imported, not edited).

## Functional requirements

- **FR-1 Exact stored colour for shapes.** In dark theme, when the sampled pixel is the dark-mode
  rendering of a colour stored in the scene under the cursor — an element's `strokeColor` or
  `backgroundColor` at that point, or `appState.viewBackgroundColor` where no element is hit — the
  colour passed to `onChange` (live, while held) and `onSelect` (pointer up) is that stored value,
  byte for byte as stored (e.g. `#ff00ff` → `#ff00ff`), for any colour, including saturated ones
  where the filter clamps and colours whose rendering collides with others. Where several stored
  candidates render to the same pixel, the topmost element under the cursor wins.
- **FR-2 Fallback.** In dark theme, when no stored candidate renders to the sampled pixel
  (anti-aliased edges, images, semi-transparent overlaps), the colour passed on is
  `inverse(pixel)` from FR-4, so that re-applying it renders the same pixel.
- **FR-3 Light theme unchanged.** In light theme, the picked colour is the pixel colour as-is.
- **FR-4 Inverse helper (mandatory).** `colors.ts` exports a pure function that maps a dark-mode
  rendered colour back to a light-theme colour (name and signature: the architect's), with this
  round-trip property for **every** colour `c` (6-digit hex):
  `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)`.
  Where the forward filter is injective at `c`, `inverse(applyDarkModeFilter(c)) === c` follows.
  It must not mutate or pollute `applyDarkModeFilter`'s cache in a way that changes its results.
- **FR-5 Preview swatch.** The swatch background may show either the on-screen or the picked
  colour; the architect states the choice. Callbacks follow FR-1/FR-2.

## Non-functional requirements

- **NFR-1** No change to rendering output or to `applyDarkModeFilter`'s results.
- **NFR-2** `yarn test:typecheck`, `yarn test:code` (eslint, max-warnings 0) and
  `yarn test:app --watch=false` pass.
- **NFR-3** Per-move cost stays small: at most one hit-test at the cursor plus a constant number
  of `applyDarkModeFilter` calls and one inverse; the inverse must not search the whole 24-bit space
  per call.

## PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| none | — | the change handles colour values only |

## Role matrix

| Role | Resource | Action |
|---|---|---|
| Editor user | Eyedropper | sample colour from canvas (unchanged) |

## Acceptance criteria

- **AC-1** A new test in `eyeDropper.test.tsx` sets `theme: "dark"`, places a shape with a known
  stored colour that the filter clamps (e.g. `#ff00ff`) under the cursor, makes the canvas pixel
  there its dark-mode rendering, picks it, and asserts the picked colour equals the stored colour
  exactly; it fails on the current code.
- **AC-2** The same scenario in light theme returns the pixel colour as-is.
- **AC-3** Existing eyedropper, colour-picker and bucket-fill tests still pass.
- **AC-4** `yarn test:typecheck` passes.
- **AC-5** `colors.test.ts` has round-trip tests for the inverse: the FR-4 property holds for every
  colour of `COLOR_PALETTE`, for saturated colours (`#ff00ff`, `#00ff00`, `#0000ff`, `#ff0000`,
  `#000000`, `#ffffff`), and for a deterministic sample across the RGB cube; plus exact
  `inverse(applyDarkModeFilter(c)) === c` for at least one colour where the filter is injective.

## Open questions for HITL

- None blocking. Assumption: jsdom's canvas mock does not render, so the reproducing test may stub
  `getImageData` to return the dark-mode pixel of the shape's colour.
- Note for Gate 2: the bugfix plan rules allow only reproducing tests plus the fix. The
  `colors.test.ts` round-trip tests are a second reproducing test (they fail before the helper
  exists); the architect plans them that way, and adding a helper makes the plan design-affecting,
  so Gate 2 is expected to open.
