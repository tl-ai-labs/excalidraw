# Requirements — bugfix — Eyedropper saves the dark-mode-transformed colour

Run: `20261109-bugfix-eyedropper-dark-theme` · Intent: bugfix (reproduce + diagnose) · Source: `intent_brief.md` (authoritative), excalidraw/excalidraw#10867

## Reproduction
1. Switch the editor to dark theme.
2. Draw a rectangle with a near-black stroke or background (e.g. `#1e1e1e`).
3. Select another shape, open the stroke or background colour picker, and use the eyedropper on the rectangle.
4. Observed: the target shape gets a near-white colour and the picker's hex shows that near-white value.
5. Expected: the target shape gets the rectangle's own colour (`#1e1e1e`), and the picker's hex matches it.

## Diagnosis
- In dark theme every element colour is drawn through `applyDarkModeFilter` (`packages/common/src/colors.ts`), i.e. `invert(93%)` then `hue-rotate(180deg)`, so the canvas pixel holds the transformed colour.
- `EyeDropper.tsx` `getCurrentColor` reads that pixel (`ctx.getImageData` -> `rgbToHex`) and passes it to `onChange` / `onSelect` unchanged, so the transformed colour is saved as the element's colour.
- Nothing in `packages/common` reverses the transform today, so the fix needs an inverse of the dark-mode transform, applied wherever the eyedropper's picked colour becomes a saved colour (the eyedropper itself and/or its users: `actions/actionProperties.tsx`, `components/App.bucketFill.ts`, `components/App.cursor.ts`), only when the theme is dark.

## In scope
1. An inverse of the dark-mode colour transform in `packages/common/src/colors.ts`, exported next to `applyDarkModeFilter`.
2. The eyedropper path in dark theme saving the original (untransformed) colour.
3. Reproducing tests in `packages/common/src/colors.test.ts` and `packages/excalidraw/tests/eyeDropper.test.tsx`.
4. Companion: a `packages/excalidraw/CHANGELOG.md` entry; a re-export from `packages/excalidraw/index.tsx` only if `applyDarkModeFilter` is re-exported there.

## Out of scope
1. Any change to how dark mode renders: `applyDarkModeFilter`'s output stays the same, and the existing palette snapshot is unchanged.
2. Any change to the eyedropper's behaviour in light theme.
3. Any file outside the 11-path allowlist frozen at Gate 0.

## Functional requirements
- **FR-1** `packages/common/src/colors.ts` exports an inverse of the dark-mode transform (inverse hue-rotate(180deg), then inverse invert(93%)), taking a colour string and returning a hex string, keeping the alpha channel the same way `applyDarkModeFilter` does.
- **FR-2** The inverse round-trips: for every palette colour `c` (and black and white), `inverse(applyDarkModeFilter(c))` equals `c`, or differs by at most 1 per RGB channel where 8-bit rounding of the forward transform makes the exact value unrecoverable. It must not special-case black, white or any other value. The tolerance is fixed at ±1 per channel and is never widened: if the forward transform's hue-rotate clamping (to [0, 1] before rounding) makes a palette colour miss ±1, that colour is not covered by the general ±1 assertion. Instead it is listed explicitly in the test, by name and hex, with its measured round-trip result and per-channel error asserted as exact values. Every other palette colour stays under the ±1 assertion.
- **FR-3** In dark theme, a colour picked with the eyedropper (both the `onChange` preview while the pointer is held and the `onSelect` on pointer up) is passed through the inverse before it is applied to elements or to the colour picker, so the saved colour is the element's original colour.
- **FR-4** In light theme the eyedropper's picked colour is unchanged (no inverse applied).
- **FR-5** The eyedropper's other users (bucket-fill's temporary eyedropper, the cursor preview) show and apply the same untransformed colour in dark theme as the main eyedropper does, with the inverse applied once only (never twice).

## Non-functional requirements
- **NFR-1** No change to `applyDarkModeFilter`'s behaviour or cache; existing `colors.test.ts` tests and snapshots stay green without update.
- **NFR-2** TypeScript strict passes (`yarn test:typecheck`).
- **NFR-3** Follows the repository's conventions (CLAUDE.md, `.github/copilot-instructions.md`: TypeScript, immutability, no performance regression on the eyedropper's per-move path).

## PII inventory
| Field | Sensitivity | Protection |
|---|---|---|
| none | — | The change handles colour values only. |

## Role matrix
| Role | Resource | Action |
|---|---|---|
| Editor user | Element stroke/background colour | Pick via eyedropper (unchanged permissions) |

## Acceptance criteria
- **AC-1** `packages/common/src/colors.test.ts` has a round-trip test over the palette (plus black and white) for the inverse; it fails before the fix (the inverse does not exist) and passes after. The test asserts ±1 per RGB channel for every palette colour. The only exceptions are the colours named in an explicit exceptions list in the test, where each entry states the colour, its measured round-trip hex and its measured per-channel error, and the test asserts those exact values. No tolerance above ±1 appears anywhere in the test. If the exceptions list is empty, the test still keeps it, empty, so a future regression has to be added there on purpose.
- **AC-2** `packages/excalidraw/tests/eyeDropper.test.tsx` has a jsdom test that, in dark theme, picks a colour from a canvas pixel holding `applyDarkModeFilter(<original>)` and asserts the target element's colour (and the picker's value) is `<original>`; it fails before the fix and passes after.
- **AC-3** The existing light-theme eyedropper behaviour is unchanged (existing eyedropper tests pass).
- **AC-4** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` passes, apart from any failure that was already there before the run.

## Assumptions
- The canvas pixel the eyedropper reads in dark theme is the `applyDarkModeFilter` output for element colours (per discovery's pointers, renderElement/shape apply it per colour). Canvas background and other UI drawn under a CSS filter are not separately handled.

## Open questions for HITL
- None blocking.
