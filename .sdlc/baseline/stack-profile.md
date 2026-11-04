# Stack profile: learned from repo scan

Built 2026-11-04T19:17Z at HEAD 4872083c (run 20261105-120000-bugfix-eyedropper-dark-theme). Trigger: React + TypeScript stack, no pre-authored adapter.

## Language & runtime
TypeScript 5.9.3, `strict: true`, `isolatedModules`, ESM (`module: ESNext`, `moduleResolution: bundler`), `jsx: react-jsx`, Node >= 18, yarn 1 workspaces. Internal packages are imported through aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/excalidraw/...`). The aliases resolve to source through `tsconfig.json` paths and `vitest.config.mts`.

## Framework
React 19 library (`packages/excalidraw`) with jotai state (`editor-jotai`), Sass, esbuild package builds. The Vite app (`excalidraw-app`) consumes it. The editor is a large class component (`components/App.tsx`), and functional components reach it through context hooks.

## Conventions detected

### File naming
- React components: PascalCase `.tsx`, sometimes in a same-name folder with a sibling `.scss`: `components/EyeDropper.tsx` + `components/EyeDropper.scss`, `components/ColorPicker/ColorPicker.tsx`.
- Utilities: camelCase `.ts`: `components/ColorPicker/colorPickerUtils.ts`, `common/src/colors.ts`.
- Actions: `actions/action<Name>.ts(x)`, exporting `action<Name>`.

### Import shape (top of file)
Groups are separated by blank lines: external (react) / `@excalidraw/*` values / `@excalidraw/*` type imports / relative values / scss / relative types. ESLint `import/order` enforces this.
```ts
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { EVENT, KEYS, rgbToHex } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useUIAppState } from "../context/ui-appState";
...
import "./EyeDropper.scss";

import type { ColorPickerType } from "./ColorPicker/colorPickerUtils";
```

### Component shape (packages/excalidraw/components/EyeDropper.tsx)
```tsx
export const EyeDropper: React.FC<{
  onCancel: () => void;
  onSelect: EyeDropperProperties["onSelect"];
  ...
}> = ({ onCancel, onChange, onSelect, colorPickerType }) => {
  const appState = useUIAppState();
  const elements = useExcalidrawElements();
  const app = useApp();
  const stableProps = useStable({ app, onCancel, onChange, onSelect, selectedElements });
  useEffect(() => { /* add DOM listeners via EVENT.* constants; return cleanup */ }, [...]);
```
Named `export const` arrow components. No default exports. Constants come from `@excalidraw/common` (`EVENT`, `KEYS`, `THEME`).

### Action shape (packages/excalidraw/actions/actionToggleGridMode.tsx)
```ts
export const actionToggleGridMode = register({
  name: "gridMode",
  label: "labels.toggleGrid",
  perform(elements, appState) {
    return {
      appState: { ...appState, gridModeEnabled: !this.checked!(appState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
```

### Pure utility shape (packages/common/src/colors.ts)
```ts
export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) { return color; }
  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  ...
  const inverted = cssInvert(rgb.r, rgb.g, rgb.b, 93);
  const rotated = cssHueRotate(inverted.r, inverted.g, inverted.b, 180 as Degrees);
  return rgbToHex(rotated.r, rotated.g, rotated.b, alpha);
};
```
Section dividers use `// ----...` comment lines. Exported arrow functions. tinycolor2 is the colour library.

### Test shape
Vitest with globals (`describe`/`it`/`expect`/`vi`), jsdom, `setupTests.ts`. Integration tests render the full editor:
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
```
Editor state is driven through `window.h.app` / `h.state` and the `API`/`UI`/`Keyboard`/`Pointer` helpers in `tests/helpers/`. Unit tests call pure functions directly (`tests/colorPickerHotkeys.test.ts`, `common/src/colors.test.ts`). Test files sit in `packages/<pkg>/tests/` or next to the source as `<Name>.test.tsx`. Canvas is `vitest-canvas-mock`, so `getImageData` pixel values are not real in tests.

### Config
Vite `import.meta.env.VITE_APP_*` variables, loaded from tracked `.env.development` / `.env.production` / `.env.test`. No runtime validator.

### Data layer
None (client-side). Scene elements are immutable objects mutated through `mutateElement` / `scene.mutateElement` in `@excalidraw/element`. Persistence goes through localStorage/IndexedDB/Firebase in `excalidraw-app/data`.

### Framework-owned wiring
- Actions self-register on import via `register()` (`actions/register.ts`) and are re-exported from `actions/index.ts`.
- Shared UI state: jotai atoms from `../editor-jotai` (e.g. `activeEyeDropperAtom`).
- Editor access: `useApp()`, `useExcalidrawElements()`, `useExcalidrawContainer()` from `components/App`; `useUIAppState()` from `context/ui-appState`.

## Sample files inspected
- packages/excalidraw/components/EyeDropper.tsx (kind: component)
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: action/handler)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/common/src/colors.ts (kind: utility, partial)
- packages/excalidraw/tests/eyeDropper.test.tsx (kind: integration test)
- packages/excalidraw/tests/colorPickerHotkeys.test.ts (kind: unit test)
- packages/excalidraw/components/UserList.test.tsx (kind: colocated test)
- tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Use `@excalidraw/<pkg>` aliases across package boundaries. Use relative imports inside a package. Keep `import type` separate and preserve blank-line import grouping, or `yarn test:code` (eslint `--max-warnings=0`) fails.
- Prettier 2.6 with `@excalidraw/prettier-config` (double quotes, trailing commas).
- Add colour helpers to `packages/common/src/colors.ts` and export them through `packages/common/src/index.ts` if they are needed outside.
- Run tests with `--watch=false`. Prefer pure-function unit tests for colour math, because canvas pixels are mocked.
