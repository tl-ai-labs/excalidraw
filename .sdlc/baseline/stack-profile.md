# Stack profile — learned from repo scan

Built 2026-11-09 at HEAD 4872083c (run 20261109-bugfix-eyedropper-dark-theme). Reason: the stack is React/TypeScript, which no shipped adapter covers (generic, nest, python).

## Language & runtime
TypeScript 5.9.3 with `strict: true`, `target`/`module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx` and `noEmit`, so `tsc` only type-checks. Node >= 18, Yarn 1.22.22 workspaces. Packages are built with esbuild and the app with Vite 5. Formatting is Prettier 2.6 (`@excalidraw/prettier-config`) with trailing commas and double quotes. Lint is eslint (`react-app` config plus import ordering) with `--max-warnings=0`.

## Framework
React (the library peers on 17, 18 or 19; the app uses 19). Editor-scoped state lives in Jotai through an isolated store (`packages/excalidraw/editor-jotai.ts`). The class-based `App` component (`packages/excalidraw/components/App.tsx`) holds `appState`. User operations are "actions" registered through `register()`.

## Conventions detected

### File naming
- React components use PascalCase `.tsx`, with a co-located `.scss` of the same name: `components/EyeDropper.tsx` with `components/EyeDropper.scss`, and `components/ColorPicker/ColorPicker.tsx`.
- Big `App` features are split into `App.<feature>.ts`, e.g. `components/App.bucketFill.ts`.
- Actions are camelCase `action<Name>.tsx`, e.g. `actions/actionCanvas.tsx`.
- Tests are camelCase `<feature>.test.tsx` under `packages/excalidraw/tests/` (`eyeDropper.test.tsx`, `bucketFill.test.tsx`). Shared helpers live in `tests/helpers/{ui,api}.ts` and `tests/test-utils.ts`.
- Core packages keep their source in `packages/<pkg>/src/*.ts` (`packages/common/src/colors.ts`).

### Imports
They are ordered in groups separated by blank lines: react and other externals, then `@excalidraw/*` value imports, then `import type` from `@excalidraw/*`, then relative imports (parent before sibling), then the scss side-effect import, then relative `import type`. `@excalidraw/*` resolves to source through tsconfig `paths` and vitest aliases.
```ts
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { EVENT, KEYS, rgbToHex } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useUIAppState } from "../context/ui-appState";
import { atom } from "../editor-jotai";
...
import "./EyeDropper.scss";

import type { ColorPickerType } from "./ColorPicker/colorPickerUtils";
```
Jotai must be imported from `../editor-jotai`, never from `jotai` directly. That file is the only one with the eslint-disable for `no-restricted-imports`.

### Component shape (handler equivalent)
Function components are typed `React.FC<{...}>` with inline prop types. DOM listeners are wired imperatively inside `useEffect` with `EVENT.*` constants and cleaned up on return. Callbacks are stabilised with `useStable`.
```tsx
export const activeEyeDropperAtom = atom<null | EyeDropperProperties>(null);

export const EyeDropper: React.FC<{
  onCancel: () => void;
  onSelect: EyeDropperProperties["onSelect"];
  ...
}> = ({ onCancel, onChange, onSelect, colorPickerType }) => {
  const appState = useUIAppState();
  const elements = useExcalidrawElements();
  const app = useApp();
  ...
  useEffect(() => {
    const ctx = app.canvas.getContext("2d")!;
    const getCurrentColor = ({ clientX, clientY }) => {
      const pixel = ctx.getImageData(/* ... */ 1, 1).data;
      return rgbToHex(pixel[0], pixel[1], pixel[2]);
    };
    ...
  }, [/* deps */]);
```

### Service / utility shape
Logic lives in pure exported arrow functions in `packages/<pkg>/src/*.ts`, often with module-level caches. Classes are rare.
```ts
export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }
  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  if (cached) {
    return cached;
  }
  const tc = tinycolor(color);
  ...
```
(`packages/common/src/colors.ts`. `DARK_THEME_FILTER = "invert(93%) hue-rotate(180deg)"` is in `packages/common/src/constants.ts`.)

### Framework-owned wiring (actions)
```ts
export const actionToggleTheme = register<AppState["theme"]>({
  name: "toggleTheme",
  label: (_, appState) => ...,
  keywords: ["toggle", "dark", "light", "mode", "theme"],
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_, appState, value, app) => { ... },
```
`register()` (in `actions/register.ts`) appends the action to the module-level `actions` list. New UI state goes in either a Jotai atom (`atom(...)` from `editor-jotai`) or `appState` (`appState.ts`).

### Test shape
Vitest with `globals: true` and jsdom, using `vitest-canvas-mock` (so canvas pixel reads in tests are mocked) and `setupTests.ts`. Tests use `describe`/`it`, render the full `<Excalidraw />`, and drive it through `Keyboard`/`Pointer` helpers and `fireEvent`. Assertions go against the DOM or `window.h` (app state, elements). `API` builds elements.
```tsx
import { Excalidraw } from "../index";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    Keyboard.keyPress("i");
    ...
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });
    expect(preview.style.left).toBe("312px");
  });
});
```
`bucketFill.test.tsx` also imports `activeEyeDropperAtom` and `editorJotaiStore` to drive or inspect the eyedropper directly, and uses `const { h } = window;`.

### Config
The app reads Vite env through `import.meta.env.VITE_APP_*`, set in the tracked `.env.development`, `.env.production` and `.env.test` files. There is no runtime validator. The library itself mostly uses props and `appState`.

### Data layer
No ORM. Scene elements are immutable records (`ExcalidrawElement` types in `packages/element/src/types.ts`) mutated through scene and element helpers. Persistence lives in the app (`excalidraw-app/data`, Firebase, localStorage).

## Sample files inspected
- packages/excalidraw/components/EyeDropper.tsx (kind: component)
- packages/excalidraw/editor-jotai.ts (kind: state wiring)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/actions/actionCanvas.tsx, actionToggleTheme only (kind: action)
- packages/common/src/colors.ts, partial (kind: utility)
- packages/excalidraw/tests/eyeDropper.test.tsx (kind: test)
- packages/excalidraw/tests/bucketFill.test.tsx, header only (kind: test)
- tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Keep the import-group ordering shown above. eslint enforces it with `--max-warnings=0`.
- Use `EVENT.*` and `KEYS.*` from `@excalidraw/common` instead of raw strings, and `THEME.DARK`/`THEME.LIGHT` for theme checks.
- Put colour maths in `packages/common/src/colors.ts`, next to `applyDarkModeFilter`, and export it through `@excalidraw/common`.
- Write tests in `packages/excalidraw/tests/*.test.tsx` that render `<Excalidraw />`. Because the canvas is mocked, pixel-reading code may need `getImageData` to be stubbed.
- Prefer allocation-free, performant code, as `.github/copilot-instructions.md` asks. Use `const`/`readonly`, `?.` and `??`.
- Snapshot files (`__snapshots__/`) change only through `yarn test:update`.
