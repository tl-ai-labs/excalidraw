# Requirements — Bugfix: Eyedropper Saves Dark-Mode-Transformed Colour

## 1. Reproduction

### Environment & Preconditions
- Excalidraw editor running with dark theme enabled (`appState.theme === "dark"` / `THEME.DARK`).
- Issue reference: `excalidraw/excalidraw#10867`.

### Exact Steps to Reproduce
1. Switch the Excalidraw canvas to **Dark theme** (`appState.theme = "dark"`).
2. Draw a source rectangle (**Rectangle A**) with canonical background colour white (`#ffffff`, `COLOR_PALETTE.white`) or canonical black (`#1e1e1e`, `COLOR_PALETTE.black`):
   - In dark theme, `applyDarkModeFilter("#ffffff")` renders Rectangle A on the canvas as near-black `#121212` (`rgb(18, 18, 18)`).
   - In dark theme, `applyDarkModeFilter("#1e1e1e")` renders Rectangle A on the canvas as near-white `#d3d3d3` (`rgb(211, 211, 211)`).
3. Draw and select a second target shape (**Rectangle B**), or open a colour picker / activate the eyedropper via any entry point:
   - Keyboard shortcut `I` / `Shift+G` (background) or `Shift+S` (stroke),
   - Clicking the eyedropper trigger icon inside `<ColorInput>` (`actionProperties.tsx` stroke/background/bucket-fill colour pickers), or
   - Holding `Alt` while the Bucket Fill tool (`bucketfill`) is active (`App.bucketFill.ts`).
4. Move the cursor over **Rectangle A** and click (`pointerdown` + `pointerup`) to sample and apply its colour.

### Observed vs. Expected Colour

| Picked Shape Canonical Colour | Rendered Canvas Pixel in Dark Theme (`applyDarkModeFilter`) | Observed Saved Colour & Target Rendering (Bug) | Expected Saved Colour & Target Rendering (Fix) |
| :--- | :--- | :--- | :--- |
| `#ffffff` (`COLOR_PALETTE.white`, visually near-black on dark canvas) | `#121212` (`rgb(18, 18, 18)`) | Saves `#121212` as the canonical colour; colour picker hex input shows `121212`; target shape is then drawn through `applyDarkModeFilter("#121212")` as `#dcdcdc` (visually near-white). | Inverts `#121212` back to `#ffffff`; saves `#ffffff`; colour picker hex input shows `ffffff`; target shape renders as `#121212` (visually matching the picked near-black shape). |
| `#1e1e1e` (`COLOR_PALETTE.black`, visually near-white on dark canvas) | `#d3d3d3` (`rgb(211, 211, 211)`) | Saves `#d3d3d3` as the canonical colour; colour picker hex input shows `d3d3d3`; target shape is then drawn through `applyDarkModeFilter("#d3d3d3")` as `#2c2c2c` (visually near-black). | Inverts `#d3d3d3` back to `#1e1e1e`; saves `#1e1e1e`; colour picker hex input shows `1e1e1e`; target shape renders as `#d3d3d3` (visually matching the picked near-white shape). |
| `#000000` (pure black, visually near-white on dark canvas) | `#ededed` (`rgb(237, 237, 237)`) | Saves `#ededed`; target shape renders through `applyDarkModeFilter("#ededed")` as `#141414` (near-black). | Inverts `#ededed` back to `#000000`; saves `#000000`; target shape renders as `#ededed`. |

---

## 2. Diagnosis

### Root Cause Analysis
Excalidraw stores canonical (untransformed / light-mode) hex colours in element properties (`element.strokeColor`, `element.backgroundColor`) and `appState` (`currentItemStrokeColor`, `currentItemBackgroundColor`, `viewBackgroundColor`). In dark theme:
- DOM UI swatches (`.color-picker-swatch`, `.color-picker__button`, `.excalidraw-eye-dropper-preview`) visually transform canonical colours via CSS `filter: var(--theme-filter)` (`invert(93%) hue-rotate(180deg)` in `packages/excalidraw/css/theme.scss:186`).
- The HTML5 `<canvas>` is **not** CSS-filtered; instead, the canvas rendering pipeline transforms every colour in JavaScript using `applyDarkModeFilter` before painting to the 2D context.
- When the eyedropper samples a pixel from `app.canvas` using `ctx.getImageData(...)`, it reads the **post-filter** RGB values directly from the canvas bitmap and returns them without inverting the dark-mode transformation. Consequently, the dark-mode-transformed pixel colour is persisted as the new canonical colour and gets transformed a second time when rendered on the dark canvas (and double-filtered in the `.excalidraw-eye-dropper-preview` bubble).

### Code Citations
1. **`packages/common/src/colors.ts` (`cssHueRotate` lines 16–57, `cssInvert` lines 59–81, `applyDarkModeFilter` lines 83–114)**:
   - `applyDarkModeFilter(color, enable = true)` parses `color` with `tinycolor`, applies `cssInvert(rgb.r, rgb.g, rgb.b, 93)` (`Math.round(clamp(c * 0.07 + (255 - c) * 0.93, 0, 255))`), and then applies `cssHueRotate(inverted.r, inverted.g, inverted.b, 180 as Degrees)` before formatting with `rgbToHex(rotated.r, rotated.g, rotated.b, alpha)`.
   - No inverse function exists in `packages/common/src/colors.ts` to reverse `cssHueRotate(..., 180)` followed by the inverse of `cssInvert(..., 93)`.
2. **`packages/excalidraw/components/EyeDropper.tsx` (`getCurrentColor` lines 80–95, `mouseMoveListener` lines 97–131, `pointerUpListener` lines 151–162)**:
   - `getCurrentColor` reads `ctx.getImageData((clientX - appState.offsetLeft) * window.devicePixelRatio, (clientY - appState.offsetTop) * window.devicePixelRatio, 1, 1).data` and unconditionally returns `rgbToHex(pixel[0], pixel[1], pixel[2])` regardless of `appState.theme`.
   - `mouseMoveListener` sets `colorPreviewDiv.style.background = currentColor` (line 130) and, while holding pointer down, invokes `stableProps.onChange(colorPickerType, currentColor, stableProps.selectedElements, { altKey })` (lines 121–128).
   - `pointerUpListener` invokes `onSelect(getCurrentColor(event), event)` (line 161).
3. **`packages/excalidraw/actions/actionProperties.tsx` (`actionChangeStrokeColor` lines 343–403, `actionChangeBackgroundColor` lines 405–490, `actionChangeBucketFillBackgroundColor` lines 492–539)**:
   - Each action's `PanelComponent` renders `<ColorPicker>` bound to canonical element/appState colours (`currentItemStrokeColor`, `currentItemBackgroundColor`).
   - `<ColorPicker>` (`ColorPicker.tsx:173–193`) and `<ColorInput>` (`ColorInput.tsx:128–138`) configure `activeEyeDropperAtom` with `onSelect: onChange`, feeding the colour sampled by `EyeDropper.tsx` directly into `updateData` and the hex text input.
4. **`packages/excalidraw/components/App.bucketFill.ts` (`openTemporaryEyeDropper` lines 91–109, `restyle` lines 126–147, `fill` lines 149–280)**:
   - `openTemporaryEyeDropper` sets `activeEyeDropperAtom` when `Alt` is held in the `bucketfill` tool, passing the sampled `color` in `onSelect` to `actionChangeBucketFillBackgroundColor` (`{ currentItemBackgroundColor: color }`). `fill` and `restyle` subsequently apply `getBucketFillBackgroundColor(this.app.state.currentItemBackgroundColor)` to elements on the canvas.
5. **`packages/excalidraw/components/App.cursor.ts` (`createBucketFillCursorDataURL` lines 30–41, `AppCursor.applyForTool` lines 100–162)**:
   - `applyForTool` reads `getBucketFillBackgroundColor(this.app.state.currentItemBackgroundColor)` and builds the SVG cursor data URL with `fill="${color}"` (updating when the bucket fill colour changes via the eyedropper or picker).

---

## 3. In Scope

1. **`packages/common/src/colors.ts`**: Implement and export an inverse of `applyDarkModeFilter` whose output, when put through `applyDarkModeFilter`, gives back the sampled pixel (with no lookup tables and no colour-specific branches).
2. **`packages/common/src/index.ts`**: Re-export the inverse dark-mode filter helper if not already covered by `export * from "./colors"`.
3. **`packages/common/src/colors.test.ts`**: Add unit tests verifying `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` on every `COLOR_PALETTE` colour, `#000000`, `#ffffff`, and a spread of other colours, and exact `inverse(applyDarkModeFilter(c)) === c` for `#000000`, `#ffffff`, and `COLOR_PALETTE.black`, using plain assertions.
4. **`packages/excalidraw/components/EyeDropper.tsx`** (and any required coordination in eyedropper callers **`packages/excalidraw/actions/actionProperties.tsx`**, **`packages/excalidraw/components/App.bucketFill.ts`**, **`packages/excalidraw/components/App.cursor.ts`**): Apply the inverse dark-mode transform to sampled canvas pixels when `appState.theme === THEME.DARK` while keeping `THEME.LIGHT` behaviour completely unchanged.
5. **`packages/excalidraw/tests/eyeDropper.test.tsx`**: Add a jsdom reproduction test covering dark-theme eyedropper colour picking (using a colour that comes back exactly so it checks the exact hex, failing before the fix and passing after) and verifying light-theme behaviour.

---

## 4. Out of Scope

1. Changing the forward dark-mode rendering transform (`applyDarkModeFilter`) or CSS `--theme-filter` definition.
2. Exact inversion of canvas pixels outside `applyDarkModeFilter`'s output range (such as raw pixels sampled over un-inverted embedded images): a pixel that no colour maps to returns the colour whose transform is nearest — accepted limitation.
3. Modifying `.gitignore` (`.sdlc/` remains ignored exclusively via `.git/info/exclude`).
4. Visual or UX redesigns to `<ColorPicker>` or `<EyeDropper>`.
5. Updating or regenerating any existing Jest/Vitest snapshot files (`**/__snapshots__/**`) or running `yarn test:update`.
6. Modifying any file outside the 8 files listed in the brief's allowlist.

---

## 5. Functional Requirements per Module

### Module: `@excalidraw/common` (`packages/common/src/colors.ts`, `packages/common/src/index.ts`)

- **FR-1 (Inverse Dark-Mode Transform Implementation)**:
  `packages/common/src/colors.ts` MUST provide an exported inverse dark-mode colour transformation function (and re-export it via `packages/common/src/index.ts`) that reverses `applyDarkModeFilter(color, enable)`. The specific algorithm is not prescribed (for example, starting from the algebraic inverse and performing a small search within a few units per channel around it is fine), provided that the inverse's output, when put through `applyDarkModeFilter`, gives back the sampled pixel, preserves alpha (formatting via `rgbToHex`), and returns `color` unchanged when `enable === false`.

- **FR-2 (Round-Trip Guarantees Without Lookup Tables or Special-Casing & Out-of-Range Handling)**:
  Because `applyDarkModeFilter` is many-to-one for some inputs, an exact `inverse(applyDarkModeFilter(c)) === c` cannot hold for every colour. The inverse function MUST satisfy:
  1. `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` for every colour `c` (including every `COLOR_PALETTE` colour, `#000000`, `#ffffff`, and arbitrary colours).
  2. Exact round-trip (`inverse(applyDarkModeFilter(c)) === c`) for `#000000`, `#ffffff`, and `COLOR_PALETTE.black` (`#1e1e1e`).
  3. No lookup tables and no colour-specific branches.
  4. For a pixel outside the transform's output range that no colour maps to (e.g., over embedded images), it returns the colour whose transform is nearest.

### Module: `@excalidraw/excalidraw` Eyedropper & Callers (`packages/excalidraw/components/EyeDropper.tsx`, `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/components/App.bucketFill.ts`, `packages/excalidraw/components/App.cursor.ts`)

- **FR-3 (Dark-Theme Pixel Inversion in Eyedropper)**:
  When `appState.theme === THEME.DARK`, `getCurrentColor` in `packages/excalidraw/components/EyeDropper.tsx` MUST transform the raw hex colour sampled from `ctx.getImageData(...)` through the inverse dark-mode filter before returning it. This ensures that:
  1. The floating preview `.excalidraw-eye-dropper-preview` (`colorPreviewDiv.style.background`) receives the inverted colour (so CSS `filter: var(--theme-filter)` filters it once to match the canvas pixel).
  2. Live pointer-down drag preview (`onChange`) and pointer-up commit (`onSelect`) deliver the inverted colour to all callers (`actionProperties.tsx` colour pickers and hex inputs, `App.bucketFill.ts` temporary eyedropper, `App.cursor.ts` bucket-fill cursor state, and `App.tsx` shortcut eyedropper).
  3. `appState.theme` is included in the `EyeDropper` effect dependencies so theme changes are always respected.

- **FR-4 (Light-Theme Behaviour Preservation)**:
  When `appState.theme === THEME.LIGHT` (i.e., not `THEME.DARK`), `EyeDropper` MUST NOT apply the inverse dark-mode filter; `getCurrentColor` MUST return `rgbToHex(pixel[0], pixel[1], pixel[2])` identically to existing behaviour.

### Module: Test Suites (`packages/common/src/colors.test.ts`, `packages/excalidraw/tests/eyeDropper.test.tsx`)

- **FR-5 (Round-Trip Unit Tests in `colors.test.ts`)**:
  `packages/common/src/colors.test.ts` MUST include unit tests using plain `expect(...).toBe(...)` assertions (no snapshots) verifying:
  1. `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` on every `COLOR_PALETTE` colour, `#000000`, `#ffffff`, and a spread of other colours.
  2. Exact round-trip (`inverse(applyDarkModeFilter(c)) === c`) for `#000000`, `#ffffff`, and `COLOR_PALETTE.black` (`#1e1e1e`).
  3. Alpha channel preservation (`#rrggbbaa`, `rgba(...)`, `transparent`), `enable = false` pass-through, and out-of-range pixels (which no colour maps to) returning the colour whose transform is nearest.

- **FR-6 (Reproducing Integration Test in `eyeDropper.test.tsx`)**:
  `packages/excalidraw/tests/eyeDropper.test.tsx` MUST include a jsdom test that renders `<Excalidraw />` in dark theme, samples a rendered element's pixel via the eyedropper, and verifies that the target renders identically to the picked element and the picker's hex is the inverse's colour. The jsdom test MUST use a colour that comes back exactly, so it checks the exact hex and fails before the fix and passes after the fix (while also verifying light theme sampling remains unchanged).

---

## 6. Non-Functional Requirements

- **NFR-1 (Strict File Allowlist)**:
  Only the 8 files listed in the brief may be modified:
  - `packages/common/src/colors.ts`
  - `packages/common/src/colors.test.ts`
  - `packages/common/src/index.ts`
  - `packages/excalidraw/components/EyeDropper.tsx`
  - `packages/excalidraw/actions/actionProperties.tsx`
  - `packages/excalidraw/components/App.bucketFill.ts`
  - `packages/excalidraw/components/App.cursor.ts`
  - `packages/excalidraw/tests/eyeDropper.test.tsx`
- **NFR-2 (Snapshot Integrity)**:
  Zero existing snapshot files (`**/__snapshots__/**`) may be modified, and `yarn test:update` MUST NEVER be run. All new tests MUST use plain assertions.
- **NFR-3 (Performance)**:
  The inverse dark-mode colour calculation runs per pointer move event during eyedropper usage and MUST execute in $O(1)$ time with negligible CPU and memory overhead.
- **NFR-4 (Type Safety & Test Suite Gate)**:
  All changes must pass strict TypeScript typechecking, linting/code checks, and the full application test suite via the exact command:
  `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`

---

## 7. PII Inventory

None — not applicable. This bugfix operates exclusively on in-memory RGBA colour values and canvas pixels on the client; no Personal Identifiable Information (PII) is collected, processed, stored, or transmitted.

| Field | Sensitivity | Protection |
| :--- | :--- | :--- |
| None (N/A) | N/A | N/A |

---

## 8. Role Matrix

None — not applicable. The eyedropper and colour transformation helpers are client-side drawing utilities accessible to any interactive editor user (when `viewModeEnabled` is false); no authentication or role-based access control applies.

| Role | Resource | Action |
| :--- | :--- | :--- |
| N/A (Interactive Editor User) | Canvas Eyedropper / Element Colour | Sample pixel colour and apply to stroke or background in light and dark themes |

---

## 9. Acceptance Criteria

1. **AC-1 (Dark-Theme Eyedropper Visual & Hex Match)**: In dark theme (`THEME.DARK`), picking a colour from a rendered element with the eyedropper and applying it to a target shape (or `appState` via keyboard shortcut, `<ColorPicker>`/`<ColorInput>` in `actionProperties.tsx`, or temporary eyedropper in `App.bucketFill.ts`) causes the target shape to render identically to the picked element on the dark canvas, and the colour picker's hex value is the inverse's colour.
2. **AC-2 (Round-Trip Unit Tests Without Special-Casing)**: `packages/common/src/colors.test.ts` contains unit tests verifying `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` for every `COLOR_PALETTE` colour, `#000000`, `#ffffff`, and a spread of other colours, and exact `inverse(applyDarkModeFilter(c)) === c` for `#000000`, `#ffffff`, and `COLOR_PALETTE.black` (`#1e1e1e`), implemented in `packages/common/src/colors.ts` with no lookup tables and no colour-specific branches.
3. **AC-3 (Reproducing jsdom Test)**: `packages/excalidraw/tests/eyeDropper.test.tsx` contains a jsdom test for picking a colour in dark theme using a colour that comes back exactly, checking the exact hex so that the test fails before the fix and passes after the fix.
4. **AC-4 (Light Theme Unchanged)**: In light theme (`THEME.LIGHT`), eyedropper pixel sampling returns the exact canvas pixel hex unchanged.
5. **AC-5 (Exact Verification Command Passes)**: Running `yarn test:typecheck && yarn test:code && yarn test:app --watch=false` exits with code `0` with all checks and tests passing.
6. **AC-6 (No Snapshot Changes)**: `git status` / `git diff` shows zero modifications to any `**/__snapshots__/**` file, `.gitignore`, or any file outside the 8 in-scope files, and `yarn test:update` is never executed.

---

## 10. Open Questions for HITL

None. All technical and verification decisions were fixed at Gate 0.
