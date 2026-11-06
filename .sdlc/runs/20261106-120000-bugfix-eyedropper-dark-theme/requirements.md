# Requirements — Bugfix: Eyedropper Saves Dark-Mode Colour in Dark Theme

- **Run ID:** `20261106-120000-bugfix-eyedropper-dark-theme`
- **Mode:** Brownfield
- **Intent:** Bugfix (excalidraw/excalidraw#10867)

---

## In scope

1. **`packages/common/src/colors.ts`**: Add and export a general inverse function for the dark-mode colour transform (`applyDarkModeFilter`) that converts an on-screen dark-mode colour back to a scene colour (and returns the input colour unchanged when disabled), satisfying:
   - Exact on-screen round trip `applyDarkModeFilter(inverse(x)) === x` for every on-screen colour `x` in the image of `applyDarkModeFilter`.
   - Exact stored-colour round trip `inverse(applyDarkModeFilter(c)) === c` for every colour `c` in `COLOR_PALETTE` (and `DEFAULT_CANVAS_BACKGROUND_PICKS`).
   - Bounded per-channel error ($|\hat{R} - R| \le 3, |\hat{G} - G| \le 3, |\hat{B} - B| \le 3$) plus exact on-screen render-equivalence `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` for arbitrary unclamped scene colours `c`.
   - Exact on-screen render-equivalence `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` for clamped/saturated colours `c` (such as `#ff00ff` $\rightarrow$ `#ff70ff` $\rightarrow$ `#d832d8` $\rightarrow$ `#ff70ff`) when used as a pure pixel fallback with no matching scene element under the cursor.
2. **`packages/common/src/colors.test.ts`** (and `packages/common/src/__snapshots__/colors.test.ts.snap` if touched): Add unit tests verifying the general inverse and round-trip properties with concrete named test cases, including all `COLOR_PALETTE` colours, unclamped arbitrary colours (`#6496c8`, `#585858`), clamped saturated colours (`#ff00ff`, `#ff0000`, `#00ff00`, `#0000ff`), and alpha preservation.
3. **`packages/excalidraw/components/EyeDropper.tsx`**: Update `getCurrentColor` in dark theme (`appState.theme === THEME.DARK`) to resolve the sampled canvas pixel (`pixelHex = rgbToHex(pixel[0], pixel[1], pixel[2])`) to the **exact stored colour** of the picked scene shape by checking the elements under the cursor in z-order (top-most first) via `hitElementItself` (`@excalidraw/element`) and taking the first whose stored `strokeColor`/`backgroundColor` renders as `pixelHex`, checking `app.state.viewBackgroundColor` after them, and falling back to the general `inverse(pixelHex, true)` last — before passing the colour to `onChange`, `onSelect`, and `colorPreviewDiv.style.background`.
4. **`packages/excalidraw/actions/actionProperties.tsx`**, **`packages/excalidraw/components/App.bucketFill.ts`**, **`packages/excalidraw/components/App.cursor.ts`**: Ensure all eyedropper consumers (stroke/background ColorPicker actions, bucket-fill `Alt` temporary eyedropper, and bucket-fill cursor colour) receive and apply the exact stored scene colour in both light and dark themes.
5. **`packages/excalidraw/tests/eyeDropper.test.tsx`**: Add reproducing jsdom tests in dark theme covering palette shapes (`#1e1e1e`), clamped saturated custom shapes (`#ff00ff` saving `#ff00ff`), tie-breaking between two shapes whose stored colours share the same dark-mode pixel (`#ff00ff` vs. `#d832d8`), multi-layer overlap tie-breaking (an unmatched shape on top of a `#ff00ff` shape, with a `#d832d8` shape elsewhere at a higher z-index, saving `#ff00ff`), stroke vs. background disambiguation on a single shape, general-inverse fallback when no element under the cursor matches, and light-theme invariance.

---

## Out of scope

1. Changing the forward dark-mode transform (`applyDarkModeFilter`, `cssInvert`, `cssHueRotate`, or `DARK_THEME_FILTER`) or altering how elements, grid lines, or canvas backgrounds are rendered in dark theme.
2. Redesigning the eyedropper UI or modifying `packages/excalidraw/components/EyeDropper.scss`.
3. Recovering exact pre-render colours from raster/SVG image elements beyond the general dark-mode pixel inverse (best-effort inverse applies, per the brief's Non-goals).
4. Modifying `.gitignore` or any files outside the 8-file allowlist (`.env*`, `.mcp.json`, `node_modules/**`, `.claude/**`, `dist/**`, `.sdlc/**`, `.git/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `packages/excalidraw/types/**`, `.yarn/**`, `packages/excalidraw/components/App.tsx`, `packages/element/**`).
5. Running `yarn test:update` (which rewrites snapshots across the repository).

---

## Reproduction

### Exact steps to reproduce (in dark theme)

1. Render `<Excalidraw />` and switch the editor to dark theme (`appState.theme = "dark"` / `THEME.DARK`).
2. Draw or load a shape (e.g., an opaque rectangle at 100% opacity) with a known scene colour:
   - Default black stroke/fill `COLOR_PALETTE.black` (`#1e1e1e`, RGB `30, 30, 30`), which `renderElement.ts` / `shape.ts` draws onto the static 2D canvas through `applyDarkModeFilter("#1e1e1e", true)` as `#d3d3d3` (RGB `211, 211, 211`, near-white/light gray).
   - Pure black `#000000` (RGB `0, 0, 0`), which is drawn onto the static canvas as `#ededed` (RGB `237, 237, 237`, near-white).
   - Pure white `COLOR_PALETTE.white` (`#ffffff`, RGB `255, 255, 255`), which is drawn onto the static canvas as `#121212` (RGB `18, 18, 18`, near-black).
   - Palette shade `COLOR_PALETTE.red[2]` (`#ff8787`, RGB `255, 135, 135`), which is drawn onto the static canvas as `#b44d4d` (RGB `180, 77, 77`).
   - Saturated non-palette magenta `#ff00ff` (RGB `255, 0, 255`), which is drawn onto the static canvas as `#ff70ff` (RGB `255, 112, 255`).
3. Activate the eyedropper tool via any of its entry points:
   - Pressing `i` (`openEyeDropper` in `App.tsx`),
   - Clicking the eyedropper icon inside `ColorPicker` / `ColorInput`, or
   - Holding `Alt` while the `bucketfill` tool is active (`App.bucketFill.ts` `openTemporaryEyeDropper`).
4. Move the pointer over an interior stroke or fill pixel of the rendered shape (`pointermove`) and click/release (`pointerdown` + `pointerup`) to sample the colour and apply it to a target shape or `currentItemStrokeColor` / `currentItemBackgroundColor`.

### Observed vs. expected colour (in dark theme)

| Source Shape Stored Colour `c` | On-Screen Canvas Pixel `x = applyDarkModeFilter(c)` | Observed Picked & Saved Colour (Bug: saves `x`) | Observed Target Rendering on Dark Canvas (`applyDarkModeFilter(x)`) | Expected Picked & Saved Colour (Fix) | Expected Target Rendering on Dark Canvas |
|---|---|---|---|---|---|
| `#1e1e1e` (`COLOR_PALETTE.black`) | `#d3d3d3` (`rgb(211, 211, 211)`) | `#d3d3d3` | `#2b2b2b` (flips from light on-screen back to dark) | `#1e1e1e` (exact match) | `#d3d3d3` (matches source) |
| `#000000` (pure black) | `#ededed` (`rgb(237, 237, 237)`) | `#ededed` | `#222222` (flips near-white on-screen to near-black) | `#000000` (exact match) | `#ededed` (matches source) |
| `#ffffff` (`COLOR_PALETTE.white`) | `#121212` (`rgb(18, 18, 18)`) | `#121212` | `#dadada` (flips near-black on-screen to near-white) | `#ffffff` (exact match) | `#121212` (matches source) |
| `#ff8787` (`COLOR_PALETTE.red[2]`) | `#b44d4d` (`rgb(180, 77, 77)`) | `#b44d4d` | `#d87c7c` (double-filtered) | `#ff8787` (exact match) | `#b44d4d` (matches source) |
| `#6496c8` (unclamped custom) | `#4d78a3` (`rgb(77, 120, 163)`) | `#4d78a3` | `#a4c5e6` (double-filtered) | `#6496c8` (exact match) | `#4d78a3` (matches source) |
| `#ff00ff` (clamped saturated custom) | `#ff70ff` (`rgb(255, 112, 255)`) | `#ff70ff` | `#d053d0` (double-filtered, darker purple) | `#ff00ff` (exact match via cursor shape lookup; `#d832d8` if pixel-only fallback) | `#ff70ff` (matches source) |

Additionally, while hovering in dark theme, `.excalidraw-eye-dropper-preview` has `filter: var(--theme-filter)` in `EyeDropper.scss` (line 29). Because `EyeDropper.tsx` sets `colorPreviewDiv.style.background = currentColor` with the already-filtered pixel `#d3d3d3` (or `#ff70ff`), the CSS filter transforms it a second time in the preview bubble (`#2b2b2b` or `#d053d0`). When `getCurrentColor` returns the underlying scene colour (`#1e1e1e` or `#ff00ff`), the CSS filter on `.excalidraw-eye-dropper-preview` renders `#d3d3d3` or `#ff70ff`, matching the canvas pixel under the cursor.

---

## Diagnosis

### 1. Mathematical analysis of `applyDarkModeFilter` in `packages/common/src/colors.ts` and what information it loses

In `packages/common/src/colors.ts` (lines 16–114), `applyDarkModeFilter(color: string, enable = true): string` implements the JavaScript equivalent of CSS `filter: invert(93%) hue-rotate(180deg)`:

1. **Step 1 — `cssInvert(rgb.r, rgb.g, rgb.b, 93)` (lines 59–81)**:
   For each channel $c \in \{0, \dots, 255\}$ with $p = 0.93$:
   $$c_{\text{inv}} = \text{round}(\text{clamp}(c \cdot (1 - p) + (255 - c) \cdot p,\ 0,\ 255)) = \text{round}(237.15 - 0.86 \cdot c)$$
   - **Information loss #1 (Quantization)**: This affine map compresses $256$ discrete input values $[0, 255]$ into $220$ discrete output values $[18, 237]$. Because the slope has magnitude $0.86 < 1$, $36$ pairs of adjacent input integers (e.g., $88$ and $89$, both mapping to $\text{round}(161.47) = \text{round}(160.61) = 161$) collide into the same integer $c_{\text{inv}}$. Inverting $c_{\text{inv}}$ via $\text{round}((237.15 - c_{\text{inv}}) / 0.86)$ introduces at most $\pm 1$ integer step of quantization error per channel from this step alone.

2. **Step 2 — `cssHueRotate(inverted.r, inverted.g, inverted.b, 180)` (lines 16–57)**:
   Normalizes $v = (r_{\text{inv}}, g_{\text{inv}}, b_{\text{inv}}) / 255$, applies the W3C hue-rotation matrix for $\theta = 180^\circ$ ($\cos 180^\circ = -1$, $\sin 180^\circ = 0$):
   $$M_{180^\circ} = \begin{bmatrix} -0.574 & 1.430 & 0.144 \\ 0.426 & 0.430 & 0.144 \\ 0.426 & 1.430 & -0.856 \end{bmatrix}$$
   Algebraically, with BT.709 luminance $Y(v) = 0.213 r_{\text{inv}} + 0.715 g_{\text{inv}} + 0.072 b_{\text{inv}}$, each rotated channel before clamping is $2Y(v) - v_i$, which is then clamped and rounded:
   $$c_{\text{rot},i} = \text{round}(\text{clamp}(2Y(v) - v_i,\ 0,\ 255))$$
   - **Information loss #2 (Out-of-gamut clamping — non-injectivity on saturated colours)**:
     Without clamping, $M_{180^\circ}$ is an involution ($M_{180^\circ}^2 = I$). However, whenever $2Y(v) - v_i > 255$ or $2Y(v) - v_i < 0$, `Math.max(0, Math.min(1, newC))` **clamps** the channel to $255$ or $0$. Clamping alters the luminance $Y(c_{\text{rot}}) \ne Y(v)$, making the forward transform **many-to-one** on saturated colours.

#### Concrete worked example: `#ff00ff` (magenta)

- **Forward transform `applyDarkModeFilter("#ff00ff")`**:
  1. Input `rgb = (255, 0, 255)`.
  2. `cssInvert(255, 0, 255, 93)` produces `inverted = (18, 237, 18)`.
  3. `cssHueRotate(18, 237, 18, 180)` computes luminance $Y = 0.213(18) + 0.715(237) + 0.072(18) = 174.585$ ($2Y = 349.17$). The unclamped rotated channels are:
     - $R_{\text{unclamped}} = 349.17 - 18 = 331.17 \xrightarrow{\text{clamp to } [0, 255]} 255$ (`0xff`) — **$76.17$ units clamped off**.
     - $G_{\text{unclamped}} = 349.17 - 237 = 112.17 \xrightarrow{\text{round}} 112$ (`0x70`).
     - $B_{\text{unclamped}} = 349.17 - 18 = 331.17 \xrightarrow{\text{clamp to } [0, 255]} 255$ (`0xff`) — **$76.17$ units clamped off**.
     Output: **`#ff70ff`** (`rgb(255, 112, 255)`).
- **Many-to-one collision and what a pixel-only inverse recovers from `#ff70ff`**:
  - Multiple distinct scene colours map to `#ff70ff`: for example, `#d832d8` (`rgb(216, 50, 216)`) inverts to `(51, 194, 51)` ($2Y = 306.49$) and rotates to $(\text{clamp}(255.49) = 255,\ \text{round}(112.49) = 112,\ 255) = \text{"#ff70ff"}$.
  - Given only the pixel `#ff70ff` (`255, 112, 255`), `cssHueRotate(255, 112, 255, 180)` has clamped luminance $Y' = 152.755$ ($2Y' = 305.51$) and returns `(51, 194, 51)`, which inverts via $\text{round}((237.15 - \hat{c}_{\text{inv}}) / 0.86)$ to **`#d832d8`** (`216, 50, 216`).
  - While `#d832d8` satisfies `applyDarkModeFilter("#d832d8") === "#ff70ff"` (on-screen render-equivalence), a pixel-only inverse **cannot** distinguish `#ff00ff` from `#d832d8`.
  - All 63 colours in `COLOR_PALETTE` (62 opaque + `transparent`) map to 63 distinct dark-mode outputs (`packages/common/src/__snapshots__/colors.test.ts.snap`, lines 96–184), so a reverse palette map inside `inverse()` recovers all `COLOR_PALETTE` colours exactly.

### 2. Pixel sampling in `EyeDropper.tsx` and the cursor hit-stack lookup architecture

In `packages/excalidraw/components/EyeDropper.tsx` (lines 80–95), `getCurrentColor` currently reads a $1 \times 1$ pixel from `app.canvas.getContext("2d").getImageData(...)`, converts it via `rgbToHex(pixel[0], pixel[1], pixel[2])`, and passes it to `stableProps.onChange` (line 122), `colorPreviewDiv.style.background` (line 130), and `onSelect` (line 161) without checking `appState.theme`.

To guarantee `picked === source stored colour` for every shape colour in the scene (including clamped custom colours like `#ff00ff` and overlapping shapes) while keeping the general inverse for pixels with no stored colour, `getCurrentColor` in `EyeDropper.tsx` performs a **cursor hit-stack lookup followed by canvas background and general inverse fallback** when `appState.theme === THEME.DARK`:

1. **Step 1 — Elements under the cursor in z-order (top-most first) via `hitElementItself`**:
   - Convert `{ clientX, clientY }` to scene coordinates `{ x: sceneX, y: sceneY } = viewportCoordsToSceneCoords({ clientX, clientY }, app.state)` (exported from `@excalidraw/common`, `packages/common/src/utils.ts:288`).
   - Build the z-ordered hit stack at `point = pointFrom(sceneX, sceneY)` (`@excalidraw/math`) directly in `EyeDropper.tsx` without touching `App.tsx`:
     - Obtain the non-deleted elements from `useExcalidrawElements()` (and `elementsMap = app.scene.getNonDeletedElementsMap()`).
     - Iterate the non-deleted scene elements from **top-most to bottom-most** (reverse array order), keeping each element where `hitElementItself({ point, element, threshold: app.getElementHitThreshold(element), elementsMap, frameNameBound: isFrameLikeElement(element) ? app.frameNameBoundsCache.get(element) : null })` is `true` (`hitElementItself` and `isFrameLikeElement` are publicly exported from `@excalidraw/element`, `packages/element/src/collision.ts:132`; `app.getElementHitThreshold` at `App.tsx:6572` and `app.frameNameBoundsCache` at `App.tsx:2064` are public on `App`).
   - For each hit element under the cursor (top-most first, skipping `"image"` elements), inspect its stored opaque colour candidates (`element.strokeColor` and `element.backgroundColor`, normalized via `colorToHex`):
     - **Stroke vs. background disambiguation**: Compare `applyDarkModeFilter(hex, true)` against the sampled `pixelHex`:
       - If only `strokeColor` satisfies `applyDarkModeFilter(strokeHex, true) === pixelHex` (cursor is over the stroke), return `strokeHex`.
       - If only `backgroundColor` satisfies `applyDarkModeFilter(bgHex, true) === pixelHex` (cursor is over the fill), return `bgHex`.
       - If both `strokeColor` and `backgroundColor` on that element render to `pixelHex`, return the one matching `colorPickerType` (`"elementStroke"` $\rightarrow$ `strokeHex`, `"elementBackground"` $\rightarrow$ `bgHex`, defaulting to `strokeHex`).
     - Take the **first** hit element in top-down z-order whose stored `strokeColor` or `backgroundColor` renders as `pixelHex`.
   - **Tie resolution & overlap resolution**:
     - When Shape A (`#ff00ff`) and Shape B (`#d832d8`) both render `#ff70ff` at different positions, only the shape at `(sceneX, sceneY)` passes `hitElementItself`, so **the shape under the cursor always wins**.
     - When an unmatched shape (e.g., hollow or hachured with stroke `#1e1e1e`) sits on top of a `#ff00ff` shape at `(sceneX, sceneY)`, and a `#d832d8` shape sits elsewhere in the scene at a higher z-index: the `#d832d8` shape is not under the cursor (`hitElementItself` is `false`), the top unmatched shape's colour (`#1e1e1e` $\rightarrow$ `#d3d3d3`) does not match `pixelHex` (`#ff70ff`), and the next element in the cursor hit stack is the `#ff00ff` shape, whose colour matches `#ff70ff` and returns `#ff00ff`.

2. **Step 2 — Canvas background (`app.state.viewBackgroundColor`)**:
   - If no hit element under the cursor has a stored colour rendering to `pixelHex`, check `app.state.viewBackgroundColor`: if non-transparent and `applyDarkModeFilter(colorToHex(app.state.viewBackgroundColor), true) === pixelHex`, return `colorToHex(app.state.viewBackgroundColor)`.

3. **Step 3 — General dark-mode inverse fallback (`packages/common/src/colors.ts`)**:
   - If neither Step 1 nor Step 2 matches `pixelHex` (e.g., pixels from raster/SVG images, canvas grid lines, antialiased/alpha-blended pixels, or standalone pixel mocks with no element under the cursor), return `inverse(pixelHex, true)` from `packages/common/src/colors.ts`.

### 3. Precise definition of "every shape colour in the scene" and category behaviour

A **pick of a shape's colour** is defined as sampling an interior (un-antialiased) pixel of a non-deleted scene element's stroke or fill under the cursor at **100% effective opacity** (`element.opacity === 100`, containing frame `opacity === 100`, not pending erasure, and stored colour has alpha $= 1$), where the static canvas rendered `applyDarkModeFilter(storedColor, true)` without blending (`pixelHex === applyDarkModeFilter(colorToHex(storedColor), true)`).

| Scene / Pixel Category | Canvas Rendering in Dark Theme | Eyedropper Resolution & Guarantee |
|---|---|---|
| **Opaque vector shapes** (`rectangle`, `diamond`, `ellipse`, `line`, `arrow`, polygon fills) at 100% effective opacity — interior of stroke or solid/hachure/cross-hatch fill | `shape.ts` (lines 222, 236, 249, 384) draws with `applyDarkModeFilter(strokeColor \| backgroundColor, true)` | **Exact stored hex (`picked === colorToHex(storedColor)`)** via Step 1 (`hitElementItself` stack under cursor), including palette (`#1e1e1e`), unclamped custom (`#6496c8`), and clamped saturated custom (`#ff00ff`). |
| **Text (`text`, including bound text) & Freedraw (`freedraw`)** at 100% effective opacity — interior of glyph or freedraw stroke/fill | `renderElement.ts` (lines 356, 489) draws with `applyDarkModeFilter(element.strokeColor, true)` (and `shape.ts:249` for closed freedraw fill) | **Exact stored hex (`picked === colorToHex(storedColor)`)** via Step 1 (`hitElementItself` stack under cursor). |
| **Two shapes with colliding dark-mode renders** (e.g., Shape A `#ff00ff` and Shape B `#d832d8`, both rendering `#ff70ff`, including when an unmatched shape overlaps Shape A) | Both shapes render `#ff70ff` on the static canvas | **Exact stored hex of the matching shape under the cursor**: Step 1 filters to elements where `hitElementItself` is `true` at `(sceneX, sceneY)` in top-down z-order, so Shape A returns `#ff00ff` and Shape B returns `#d832d8`. |
| **Canvas background (`app.state.viewBackgroundColor`)** | `renderer/helpers.ts` (line 76) fills with `applyDarkModeFilter(viewBackgroundColor, true)` | **Exact stored hex (`colorToHex(viewBackgroundColor)`)** via Step 2 (or Step 3 palette lookup for default background picks). |
| **Raster / SVG `image` elements & canvas grid lines** | SVG images use `DARK_THEME_FILTER` (`renderElement.ts:456`); raster images are unfiltered; grid uses `applyDarkModeFilter` | **General inverse fallback (Step 3 `inverse(pixelHex, true)`)**: no stored element stroke/fill colour applies; returns the general inverse of `pixelHex`. |
| **Semi-transparent shapes/frames (`opacity < 100`, `containingFrame.opacity < 100`, or `#rrggbbaa` with $\alpha < 1$) and antialiased stroke/glyph edge pixels** | `renderElement.ts` (line 729) sets `context.globalAlpha < 1` (or 2D canvas antialiases edge pixels), blending `applyDarkModeFilter(storedColor, true)` with the backdrop (`pixelHex !== applyDarkModeFilter(storedColor, true)`) | In both light and dark themes, `getImageData` reads the composited pixel. Because `pixelHex` does not equal `applyDarkModeFilter(storedColor, true)`, Step 1 does not match `pixelHex` and resolution falls through to Step 3 (`inverse(pixelHex, true)`), unless HITL directs returning the hit element's unblended stored colour (see **Open questions for HITL #1**). |

---

## Functional requirements per module

All functional requirements map strictly to files within the **8-file Gate 0 allowlist**. **No file outside the 8-file allowlist is needed** (`viewportCoordsToSceneCoords`, `applyDarkModeFilter`, `colorToHex`, and `THEME` are exported from `@excalidraw/common`; `hitElementItself` and `isFrameLikeElement` are exported from `@excalidraw/element`; `pointFrom` is exported from `@excalidraw/math`; `app.getElementHitThreshold`, `app.frameNameBoundsCache`, and `app.scene.getNonDeletedElementsMap` are public on `App`).

### Module 1: `packages/common/src/colors.ts`

- **FR-1 (Exported Dark-Mode Inverse Function)**: Export an inverse dark-mode colour transformation function from `packages/common/src/colors.ts` (automatically re-exported via `packages/common/src/index.ts`) with signature `(color: string, enable = true): string` that:
  1. Returns `color` unchanged when `enable` is `false`.
  2. Uses a precomputed reverse lookup over `COLOR_PALETTE` (and `DEFAULT_CANVAS_BACKGROUND_PICKS`) for opaque RGB channels so that every palette colour `c` is recovered with **exact hex equality**: `inverse(applyDarkModeFilter(c)) === c` (preserving the input's alpha channel).
  3. For any colour not in the palette reverse map, applies the algebraic inverse:
     - Reverses the $180^\circ$ hue rotation via `cssHueRotate(r, g, b, 180)`,
     - Reverses the $93\%$ invert via $c = \text{round}(\text{clamp}((237.15 - c_{\text{inv}}) / 0.86,\ 0,\ 255))$ per channel, and
     - Ensures exact on-screen round trip `applyDarkModeFilter(inverse(x)) === x` for every `x` in the image of `applyDarkModeFilter` (searching the $\pm 1$ per-channel neighbourhood of the algebraic candidate if integer rounding shifted the forward result by 1 LSB), preserving alpha via `rgbToHex(r, g, b, alpha)` and caching results in a browser-only `Map`.

### Module 2: `packages/excalidraw/components/EyeDropper.tsx`

- **FR-2 (Dark-Theme Cursor Hit-Stack Lookup + Inverse Fallback in `EyeDropper.tsx`)**: In `packages/excalidraw/components/EyeDropper.tsx`, update `getCurrentColor({ clientX, clientY })` so that:
  1. It reads `pixel = ctx.getImageData(...)` and computes `pixelHex = rgbToHex(pixel[0], pixel[1], pixel[2])`.
  2. When `appState.theme !== THEME.DARK`, it returns `pixelHex` unchanged.
  3. When `appState.theme === THEME.DARK`:
     - **Step 1 (Elements under cursor in top-down z-order)**: Computes `{ x: sceneX, y: sceneY } = viewportCoordsToSceneCoords({ clientX, clientY }, app.state)`, `point = pointFrom(sceneX, sceneY)`, and `elementsMap = app.scene.getNonDeletedElementsMap()`. Iterates non-deleted `elements` from `useExcalidrawElements()` from top-most to bottom-most, keeping those (excluding `"image"` elements) where `hitElementItself({ point, element, threshold: app.getElementHitThreshold(element), elementsMap, frameNameBound: isFrameLikeElement(element) ? app.frameNameBoundsCache.get(element) : null })` is `true`. For each hit element in top-down order, checks its opaque `strokeColor` and `backgroundColor` (preferring the property matching `colorPickerType` when both render to `pixelHex`) and returns the first candidate whose `applyDarkModeFilter(candidateHex, true) === pixelHex`.
     - **Step 2 (Canvas background)**: If no hit element under the cursor matches `pixelHex`, checks `app.state.viewBackgroundColor`; if opaque and `applyDarkModeFilter(bgHex, true) === pixelHex`, returns `bgHex`.
     - **Step 3 (General inverse fallback)**: Otherwise returns `inverse(pixelHex, true)` from `@excalidraw/common`.
- **FR-3 (Effect Dependencies & Stable Props in `EyeDropper.tsx`)**: Include `elements` in `stableProps` and `appState.theme` in the `useEffect` dependency array in `packages/excalidraw/components/EyeDropper.tsx` so `getCurrentColor` always accesses current scene elements and theme state.

### Module 3: `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/components/App.bucketFill.ts`, `packages/excalidraw/components/App.cursor.ts`

- **FR-4 (Eyedropper Consumers & Bucket-Fill Integration)**: Ensure all consumers in `packages/excalidraw/actions/actionProperties.tsx`, `packages/excalidraw/components/App.bucketFill.ts`, and `packages/excalidraw/components/App.cursor.ts` receive the resolved scene colour from `EyeDropper.tsx` in dark theme without double-filtering.

### Module 4: `packages/common/src/colors.test.ts` (and `packages/common/src/__snapshots__/colors.test.ts.snap` if touched)

- **FR-5 (Unit Tests for General Inverse in `packages/common/src/colors.test.ts`)**: Add unit tests in `packages/common/src/colors.test.ts` covering:
  1. **Exact palette round trip**: `inverse(applyDarkModeFilter(c)) === c` for every colour `c` in `COLOR_PALETTE` (`black` `#1e1e1e`, `white` `#ffffff`, `transparent`, and all 60 shades across the 12 colour families) and `DEFAULT_CANVAS_BACKGROUND_PICKS`.
  2. **Exact on-screen round trip**: `applyDarkModeFilter(inverse(x)) === x` for on-screen colours `x = applyDarkModeFilter(c)` in the transform's image across palette colours, unclamped custom colours, and clamped custom colours.
  3. **Unclamped custom colours (per-channel bound $\le 3$ and render-equivalence)**: Named test cases for `#6496c8` (`applyDarkModeFilter("#6496c8") === "#4d78a3"`, `inverse("#4d78a3") === "#6496c8"`) and quantization-colliding pair `#585858` / `#595959` (`applyDarkModeFilter` is `#a1a1a1` for both, `inverse("#a1a1a1") === "#595959"`, per-channel error $\le 1 \le 3$, and `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === "#a1a1a1"`).
  4. **Clamped / out-of-gamut custom colours (concrete `#ff00ff`, `#ff0000`, `#00ff00`, `#0000ff`)**:
     - Named test for `#ff00ff`: `applyDarkModeFilter("#ff00ff") === "#ff70ff"`, `inverse("#ff70ff") === "#d832d8"`, and `applyDarkModeFilter(inverse(applyDarkModeFilter("#ff00ff"))) === "#ff70ff"`.
     - Named tests for `#ff0000` (`#ff9090` $\rightarrow$ `#b73636` $\rightarrow$ `#ff9090`), `#00ff00` (`#008f00`), and `#0000ff` (`#cdcdff`) verifying `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)`.
  5. **Alpha preservation & disabled flag**: `#ff000080`, `rgba(255, 0, 0, 0.5)`, `transparent`, and `inverse(c, false) === c`.

### Module 5: `packages/excalidraw/tests/eyeDropper.test.tsx`

- **FR-6 (Reproducing Jsdom Tests in `packages/excalidraw/tests/eyeDropper.test.tsx`)**: Add named jsdom tests in `packages/excalidraw/tests/eyeDropper.test.tsx` covering:
  1. **Dark-theme palette shape pick (`#1e1e1e`)**: A scene shape under the cursor with `COLOR_PALETTE.black` (`#1e1e1e`, rendered pixel `#d3d3d3` `[211, 211, 211, 255]`) picked in dark theme saves `#1e1e1e` (fails before the fix where `#d3d3d3` is saved; passes after).
  2. **Dark-theme clamped saturated custom shape pick (`#ff00ff`)**: A scene shape under the cursor with `#ff00ff` (rendered pixel `#ff70ff` `[255, 112, 255, 255]`) picked in dark theme saves `#ff00ff` (fails before the fix; passes after).
  3. **Dark-theme tie-breaking between colliding shape colours (`#ff00ff` vs. `#d832d8`)**: Two shapes in the scene — Shape A with `#ff00ff` and Shape B with `#d832d8` (both producing pixel `#ff70ff` `[255, 112, 255, 255]` on the dark canvas). Picking at Shape A's coordinates saves `#ff00ff`; picking at Shape B's coordinates saves `#d832d8`.
  4. **Dark-theme overlap case with colliding colour elsewhere**: An unmatched shape sits on top of a `#ff00ff` shape at the cursor position, while a `#d832d8` shape sits elsewhere in the scene at a higher z-index; picking `#ff70ff` at the overlapping cursor position saves `#ff00ff`.
  5. **Dark-theme stroke vs. background disambiguation on one shape**: A shape under the cursor with `strokeColor: "#ff00ff"` (dark pixel `#ff70ff`) and `backgroundColor: "#1e1e1e"` (dark pixel `#d3d3d3`) saves `#ff00ff` when `getImageData` returns `#ff70ff` and `#1e1e1e` when `getImageData` returns `#d3d3d3`.
  6. **Dark-theme general-inverse fallback (no matching shape under cursor)** and **Light-theme invariance**: Picking a pixel with no matching shape under the cursor in dark theme returns `inverse(pixelHex, true)`; picking in light theme returns the raw `pixelHex` unchanged.

---

## Non-functional requirements

- **NFR-1 (Performance & Caching)**: Both the dark-mode inverse function in `packages/common/src/colors.ts` and the cursor hit-stack lookup in `EyeDropper.tsx` (`hitElementItself` with its built-in bounding-box fast path and WeakRef cache + `DARK_MODE_COLORS_CACHE`-backed `applyDarkModeFilter`) must execute without frame drops during `pointermove`.
- **NFR-2 (Type Safety & Lint Cleanliness)**: `yarn test:typecheck` and `yarn test:code` must pass with zero errors.
- **NFR-3 (Test Suite Execution)**: `yarn test:app --watch=false` must pass completely. `yarn test:update` must **never** be run.
- **NFR-4 (Strict File Allowlist)**: Only files in the Gate 0 8-file allowlist may be modified:
  1. `packages/common/src/colors.ts`
  2. `packages/common/src/colors.test.ts`
  3. `packages/common/src/__snapshots__/colors.test.ts.snap` (only if touched)
  4. `packages/excalidraw/components/EyeDropper.tsx`
  5. `packages/excalidraw/actions/actionProperties.tsx`
  6. `packages/excalidraw/components/App.bucketFill.ts`
  7. `packages/excalidraw/components/App.cursor.ts`
  8. `packages/excalidraw/tests/eyeDropper.test.tsx`

---

## PII inventory

None. This bugfix operates purely on in-memory RGB/hex colour strings, scene element properties, and HTML5 canvas pixel values on the client.

| Field | Sensitivity | Protection |
|---|---|---|
| None | N/A | N/A |

---

## Role matrix

N/A. Eyedropper colour picking and dark-mode colour math are client-side canvas UI operations with no authentication, authorization roles, or access-control boundaries.

| Role | Resource | Action | Permission |
|---|---|---|---|
| N/A | N/A | N/A | N/A |

---

## Acceptance criteria

1. **AC-1 (Dark-theme exact hex equality for every shape colour in the scene)**:
   - In dark theme, picking an interior stroke or fill pixel of any opaque (100% effective opacity) shape in the scene with the eyedropper and applying it to another shape saves the **exact stored hex colour** of the source shape (`pickedColor === colorToHex(sourceColor)`) — across all `COLOR_PALETTE` colours (e.g. `#1e1e1e`), unclamped custom colours (e.g. `#6496c8`), and clamped saturated custom colours (**specifically including `#ff00ff` saved as `#ff00ff`**) — and makes the target shape render the exact same on-screen colour as the source (no near-black $\leftrightarrow$ near-white flip).
   - When two shapes in the scene have distinct stored colours that render to the same dark-mode pixel (e.g. `#ff00ff` and `#d832d8`, both rendering `#ff70ff`), picking over either shape returns that shape's own stored colour (the shape under the cursor wins, including when an unmatched shape overlaps the `#ff00ff` shape under the cursor and the `#d832d8` shape is elsewhere at a higher z-index).
   - When a shape has both `strokeColor` and `backgroundColor`, the property whose `applyDarkModeFilter` matches the sampled pixel is returned.
2. **AC-2 (General inverse & round-trip definitions for fallback / unit tests)**: The exported inverse in `packages/common/src/colors.ts` is a general inverse of `applyDarkModeFilter` (used as the fallback for pixels with no matching stored colour under the cursor, such as images, grid, or blended pixels), satisfying:
   - **(a) Exact round trips**:
     1. **On-screen round trip**: `applyDarkModeFilter(inverse(x)) === x` for every on-screen colour `x` in the image of `applyDarkModeFilter`.
     2. **Default palette round trip**: `inverse(applyDarkModeFilter(c)) === c` with exact hex equality for every colour `c` in `COLOR_PALETTE` (and `DEFAULT_CANVAS_BACKGROUND_PICKS`).
   - **(b) Arbitrary scene colours `c` (pure pixel inverse without scene lookup)**:
     1. **Unclamped colours**: When `cssHueRotate(cssInvert(c, 93), 180)` does not clamp any channel outside $[0, 255]$ (and `applyDarkModeFilter(c)` does not collide with a `COLOR_PALETTE` dark-mode hex), `inverse(applyDarkModeFilter(c))` is within **$\pm 3$ per RGB channel** of `c` and satisfies `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)`.
     2. **Clamped colours (e.g., `#ff00ff`)**: When `cssHueRotate` clamps one or more channels to $0$ or $255$, `inverse(applyDarkModeFilter(c))` returns the canonical unclamped preimage (`#d832d8` for `#ff00ff`) satisfying exact on-screen render-equivalence: `applyDarkModeFilter(inverse(applyDarkModeFilter(c))) === applyDarkModeFilter(c)` (`"#ff70ff"` for `#ff00ff`).
3. **AC-3 (Light-theme invariance)**: Light theme behaviour is unchanged (`getCurrentColor` returns the raw `rgbToHex` of the sampled canvas pixel when `appState.theme !== THEME.DARK`).
4. **AC-4 (Named unit & reproducing jsdom tests)**:
   - Unit tests in `packages/common/src/colors.test.ts` (`yarn vitest run packages/common/src/colors.test.ts`) verify:
     - Exact `inverse(applyDarkModeFilter(c)) === c` for all `COLOR_PALETTE` colours,
     - Exact `applyDarkModeFilter(inverse(x)) === x` for `x` in the transform's image,
     - Per-channel bound $\le 3$ and render-equivalence for unclamped custom colours (`#6496c8`, `#585858`), and
     - Concrete clamped colour `#ff00ff` (`applyDarkModeFilter("#ff00ff") === "#ff70ff"`, `inverse("#ff70ff") === "#d832d8"`, `applyDarkModeFilter("#d832d8") === "#ff70ff"`), plus `#ff0000`, `#00ff00`, `#0000ff`, and alpha formats.
   - Jsdom tests in `packages/excalidraw/tests/eyeDropper.test.tsx` (`yarn vitest run packages/excalidraw/tests/eyeDropper.test.tsx`) verify:
     1. Picking a `#1e1e1e` shape (canvas pixel `#d3d3d3`) in dark theme saves `#1e1e1e` (fails before the fix, passes after),
     2. Picking a `#ff00ff` shape (canvas pixel `#ff70ff`) in dark theme saves `#ff00ff` (fails before the fix, passes after),
     3. Tie-resolution case: with both a `#ff00ff` shape and a `#d832d8` shape in the scene (both rendering `#ff70ff`), picking over the `#ff00ff` shape saves `#ff00ff` and picking over the `#d832d8` shape saves `#d832d8`,
     4. Overlap case: an unmatched shape on top of a `#ff00ff` shape at the cursor, with a `#d832d8` shape elsewhere at a higher z-index — picking saves `#ff00ff`,
     5. Stroke vs. background disambiguation on a shape with distinct `strokeColor` and `backgroundColor` in dark theme, and
     6. Light-theme pick invariance (`#d3d3d3` $\rightarrow$ `#d3d3d3`).
5. **AC-5 (Verification gates)**: `yarn test:typecheck`, `yarn test:code`, and `yarn test:app --watch=false` all pass with exit code 0 (without running `yarn test:update`).

---

## Open questions for HITL

1. **Semi-transparent shapes/frames (`opacity < 100`) and antialiased edge pixels**:
   When a shape has `element.opacity < 100`, belongs to a frame with `frame.opacity < 100`, has a stored colour with alpha $< 1$, or is sampled on an antialiased stroke/glyph edge pixel, `renderElement.ts` composites the colour with the backdrop on the 2D canvas, so `getImageData` returns an alpha-blended pixel `pixelHex !== applyDarkModeFilter(storedColor, true)` (matching light theme, where `getImageData` also returns the composited pixel rather than the unblended `storedColor`). With the current lookup, blended pixels do not match `applyDarkModeFilter(storedColor, true)` and fall back to `inverse(pixelHex, true)`. Is this light-theme-consistent composite behaviour expected for semi-transparent shapes and antialiased edges, or should `EyeDropper` return the hit element's unblended stored colour even when `element.opacity < 100`?
