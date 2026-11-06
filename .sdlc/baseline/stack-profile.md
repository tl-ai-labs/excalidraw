# Stack profile: learned from a repo scan

Built 2026-11-06 for run `20261106-103201-bugfix-dark-eyedropper`, at HEAD `4872083c0`.

## Language & runtime
The codebase is TypeScript 5.9.3 in `strict` mode (`target`/`module` ESNext, `moduleResolution: bundler`, `jsx: react-jsx`) and uses ESM throughout. Node >= 18. It is a Yarn 1 workspaces monorepo. Packages build with esbuild (`build:esm`) and the app builds with Vite 5. Internal packages import each other through `@excalidraw/<pkg>` aliases, which `tsconfig.json` and `vitest.config.mts` resolve to `packages/<pkg>/src`.

## Framework
React 19 function components, jotai for editor-scoped state (`editorJotaiStore`, atoms such as `activeEyeDropperAtom`), and roughjs for rendering. There is no routing framework. The editor follows its own "action" pattern (`register({...})`). `App.tsx` is one large class component that hands concerns off to helper classes in `App.<concern>.ts` files.

## Conventions detected

### File naming
- React components use PascalCase `.tsx` with a sibling `.scss`, for example `components/EyeDropper.tsx` and `components/EyeDropper.scss`.
- Concerns split out of App.tsx live in `App.<concern>.ts`, for example `components/App.cursor.ts` (`AppCursor`) and `components/App.bucketFill.ts` (`AppBucketFill`).
- Actions are named `actions/action<Name>.tsx`, for example `actions/actionProperties.tsx` and `actions/actionCanvas.tsx`.
- Non-component modules are camelCase `.ts`, for example `packages/common/src/colors.ts` and `packages/element/src/bucketFill.ts`.

### Import shape
Imports come in groups separated by blank lines: `@excalidraw/*` packages first, then relative imports, then `import type` lines last. ESLint `import/order` enforces this.
```ts
import { CURSOR_TYPE, getBucketFillBackgroundColor, MIME_TYPES, THEME } from "@excalidraw/common";

import { isHandToolActive, isEraserActive } from "../appState";

import { bucketFillIconSvgPaths } from "./icons";

import type { AppState, DataURL } from "../types";
import type App from "./App";
```

### App helper-class shape (`App.<concern>.ts`)
```ts
/** Owns bucket-fill interaction and App-bound scene mutations. */
export class AppBucketFill {
  constructor(private app: App) {}
```
How these are wired in `components/App.tsx` (around lines 685-687):
```ts
public bucketFill: AppBucketFill = new AppBucketFill(this);
public cursor: AppCursor = new AppCursor(this);
```

### Action shape (`actions/*.tsx`)
```ts
export const actionChangeBucketFillBackgroundColor = register<
  Pick<AppState, "currentItemBackgroundColor">
>({
  name: "changeBucketFillBackgroundColor",
  label: "labels.changeBackground",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      appState: { ...appState, ...value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => { ... },
});
```
Actions are re-exported from `actions/index.ts`.

### Utility shape (`packages/common/src/colors.ts`)
Utilities are exported arrow functions with typed parameters and defaults, and constants are ALL_CAPS:
```ts
export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }
  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  ...
```
All of these are re-exported from `@excalidraw/common` (`packages/common/src/index.ts`).

### Component shape (`EyeDropper.tsx`)
`React.FC<{...}>` with a jotai atom exported next to it (`activeEyeDropperAtom = atom<null | EyeDropperProperties>(null)`). Canvas pixel sampling:
```ts
const pixel = ctx.getImageData(
  (clientX - appState.offsetLeft) * window.devicePixelRatio,
  (clientY - appState.offsetTop) * window.devicePixelRatio,
  1,
  1,
).data;
return rgbToHex(pixel[0], pixel[1], pixel[2]);
```

### Test shape
Vitest uses `globals: true` (bare `describe`/`it`/`expect`) and jsdom, with `setupTests.ts` and `vitest-canvas-mock`. Unit tests sit next to the source (`packages/common/src/colors.test.ts`) or in a `tests/` folder (`packages/element/tests/*.test.ts`). Editor integration tests live in `packages/excalidraw/tests/*.test.tsx` and render `<Excalidraw/>`, then drive it through helpers:
```tsx
import { Excalidraw } from "../index";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    Keyboard.keyPress("i");
    ...
```
Helpers are `tests/helpers/api.ts` (`API`, which creates elements), `tests/helpers/ui.ts` (`Keyboard`, `Pointer`, `UI`) and `tests/test-utils.ts` (`render`, `act`, `fireEvent`, `GlobalTestState`, `togglePopover`). Tests can reach jotai state through `editorJotaiStore` (see `tests/bucketFill.test.tsx`). Unit tests often use `toMatchSnapshot()`, with snapshots in `__snapshots__/`.

### Config
Configuration comes from Vite `import.meta.env.VITE_APP_*` values in `.env.development`, `.env.production` and `.env.test`. There is no runtime validator. Code reads `process.env` only for test and build flags.

### Data layer
No ORM. Scene state is plain immutable element objects (`@excalidraw/element`) plus `AppState`. Changes go through actions, which return `{ elements?, appState?, captureUpdate: CaptureUpdateAction.* }`.

### Framework-owned wiring
- A new action means calling `register({...})` in an `actions/action*.tsx` file and exporting it from `actions/index.ts`.
- A new App concern means a class in `App.<concern>.ts` that is instantiated as a public field on `App`.
- New shared helpers go in `packages/<pkg>/src/*.ts` and are exported from that package's `src/index.ts`.

## Sample files inspected
- packages/excalidraw/components/App.cursor.ts (kind: App helper class)
- packages/excalidraw/components/App.bucketFill.ts (kind: App helper class)
- packages/excalidraw/components/EyeDropper.tsx (kind: component)
- packages/excalidraw/actions/actionProperties.tsx (kind: action, excerpt only; the file has more than 500 lines)
- packages/excalidraw/actions/actionCanvas.tsx (kind: action)
- packages/common/src/colors.ts (kind: utility)
- packages/common/src/colors.test.ts (kind: unit test)
- packages/excalidraw/tests/eyeDropper.test.tsx (kind: integration test)
- packages/excalidraw/tests/bucketFill.test.tsx (kind: integration test, header only)
- packages/element/tests/bucketFill.test.ts (kind: unit test, header only)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Import shared helpers from `@excalidraw/common`, `@excalidraw/element` and `@excalidraw/math`. Never use deep relative paths across packages.
- Keep the blank-line import groups and put `import type` last. `yarn test:code` runs ESLint with `--max-warnings=0`.
- Write prettier-compatible code: double quotes, trailing commas, 80 columns.
- Put tests in the existing `describe` blocks. Integration tests should use `render(<Excalidraw .../>)` together with `Keyboard`, `Pointer` and `API`. Avoid bare `vitest` in automation and pass `--watch=false`.
- Do not hand-edit snapshot files. Regenerate them with `yarn test:update`.
- Theme comes from `appState.theme`, compared against `THEME.DARK` / `THEME.LIGHT` from `@excalidraw/common`. The dark-mode colour transform is `applyDarkModeFilter` in `colors.ts`.
