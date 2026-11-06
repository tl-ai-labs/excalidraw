# Stack profile: learned from repo scan

Built 2026-11-06 (run 20261106-120000-bugfix-eyedropper-dark-theme), HEAD 4872083c. This is a bounded Tier 2b sample. It was triggered because the stack (node-typescript + React) has no pre-authored adapter.

## Language & runtime
TypeScript 5.9 with `strict: true`, `module: ESNext`, `target: ESNext`, `jsx: react-jsx`. ESM everywhere. Node >= 18. Yarn 1 workspaces. Packages build with esbuild and the app builds with Vite 5.

## Framework
React 19 component library (`@excalidraw/excalidraw`) with a large class component `App` (`packages/excalidraw/components/App.tsx`), plus helper classes split into `App.<feature>.ts` (for example `App.bucketFill.ts`, `App.cursor.ts`) that take `app: App` in the constructor. Editor-level state uses jotai through `../editor-jotai` (`atom`, `editorJotaiStore`, `app.updateEditorAtom`). Canvas rendering uses roughjs.

## Conventions detected

### File naming
- React components: PascalCase `.tsx` with a sibling `.scss` (`components/EyeDropper.tsx` + `EyeDropper.scss`).
- Actions: `actions/actionCamelCase.ts(x)` registered with `register(...)` (`actions/actionDeselect.ts`).
- Shared pure helpers: lower-case modules in `packages/<pkg>/src/` (`packages/common/src/colors.ts`), re-exported from `packages/<pkg>/src/index.ts` (`export * from "./colors"`).
- Tests: `packages/excalidraw/tests/<feature>.test.tsx` for editor behaviour, and colocated `*.test.ts` for pure helpers (`packages/common/src/colors.test.ts`).

### Import shapes
Imports come in this order: cross-package aliases first (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`), then `import type` from `@excalidraw/*/types`, then relative imports, with blank lines between groups (the ESLint import/order rule is enforced with `--max-warnings=0`).
```ts
import { EVENT, KEYS, rgbToHex } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useUIAppState } from "../context/ui-appState";
import { atom } from "../editor-jotai";
```

### Component shape
Function components typed as `React.FC<{...}>`. Effects attach DOM listeners and remove them in cleanup. Latest props are captured with `useStable`. Portals use `createPortal` with `useCreatePortalContainer` (`components/EyeDropper.tsx`).

### Helper-class shape (App split)
```ts
/** Owns bucket-fill interaction and App-bound scene mutations. */
export class AppBucketFill {
  constructor(private app: App) {}
  openTemporaryEyeDropper = () => { ... this.app.updateEditorAtom(activeEyeDropperAtom, eyeDropper); };
}
```
Arrow-function class fields are used for methods, with JSDoc on non-obvious behaviour.

### Test shape
Vitest with globals (`describe`/`it`/`expect`, no imports), jsdom, and `vitest-canvas-mock`. Editor tests render `<Excalidraw />` through `./test-utils` (`render`, `waitFor`, `act`, `fireEvent`, `GlobalTestState`) and drive input with `./helpers/ui` (`Keyboard`, `Pointer`) and `./helpers/api` (`API`). Global handle: `const { h } = window;` (`h.app`, `h.state`).
```ts
describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    Keyboard.keyPress("i");
    ...
  });
});
```
Pure helper tests assert exact hex output (`expect(applyDarkModeFilter("#000000")).toBe("#ededed")`) and use snapshot tests for palettes.

### Config
Vite env through `import.meta.env.VITE_APP_*` (`.env.development`, `.env.production`, `.env.test`). There is no runtime validator.

### Data layer
None (client-side scene model). Elements are changed with `app.scene.mutateElement` / `mutateElement`, and the roughjs drawable cache is evicted with `ShapeCache.delete(element)` after an in-place mutation. Undo capture goes through `scheduleCapture()` / `CaptureUpdateAction.IMMEDIATELY`.

### Theme handling
`appState.theme` is compared against `THEME.DARK` (from `@excalidraw/common`). Canvas colours are converted with `applyDarkModeFilter(color, isDark)`. CSS uses `var(--theme-filter)`.

### Framework-owned wiring
Keyboard shortcuts live in `App.tsx` `onKeyDown`/`onKeyUp`. Actions are registered through `actions/register.ts` and run with `app.actionManager.executeAction(action, source, value)`. Overlay UI is mounted in `components/LayerUI.tsx`, driven by jotai atoms.

## Sample files inspected
- packages/excalidraw/components/EyeDropper.tsx (component)
- packages/excalidraw/components/App.bucketFill.ts (App helper class)
- packages/excalidraw/actions/actionDeselect.ts (action)
- packages/common/src/colors.ts (shared helper)
- packages/excalidraw/tests/eyeDropper.test.tsx, packages/excalidraw/tests/bucketFill.test.tsx (editor tests)
- packages/common/src/colors.test.ts (helper unit test)
- vitest.config.mts, tsconfig.json, setupTests.ts (config)

## Notes for downstream codegen
- Pure colour logic belongs in `packages/common/src/colors.ts` with tests in `colors.test.ts`. Import it in the editor from `@excalidraw/common`, never by relative path across packages.
- Keep import groups separated by blank lines. ESLint runs with `--max-warnings=0`.
- Formatting is Prettier 2.6 (`@excalidraw/prettier-config`): double quotes, trailing commas, 80 columns.
- Prefer `const`, `readonly`, `?.` and `??` (per `.github/copilot-instructions.md`).
- In tests, canvas pixel reads are mocked. Stub `getContext("2d").getImageData` or test a pure helper.
