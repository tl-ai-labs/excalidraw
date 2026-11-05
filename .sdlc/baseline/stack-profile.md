# Stack profile: learned from repo scan

Built 2026-11-05T05:25:55Z (run `20261105-105313-feature-new-text-range-styles`) at HEAD `14bb42ede`. Runs since built: 0.

## Language & runtime
TypeScript 5.9 everywhere, with `strict: true`, `isolatedModules`, `moduleResolution: "bundler"`, `module: ESNext`, `jsx: react-jsx` and `noEmit` (tsc only type-checks). The code is ESM only. Node >= 18, Yarn 1.22 workspaces. Packages build with esbuild (`build:esm`) and the app builds with Vite 5. Tests run on Vitest 3 with jsdom, `vitest-canvas-mock` and the globals `describe/it/expect/vi`.

## Framework
React 19 editor library (`@excalidraw/excalidraw`) with Jotai for UI state. There is also an in-house **action system** (`register({...})` plus `ActionManager`) and an immutable **element model** (`@excalidraw/element`). The app (`excalidraw-app`) adds Firebase and socket.io collaboration. No router or backend framework.

## Conventions detected

### File naming
- Element and domain modules use camelCase `.ts`: `packages/element/src/textElement.ts`, `mutateElement.ts`, `textWrapping.ts`.
- Actions are named `action<Name>.ts(x)`, one feature per file, often several actions per file: `packages/excalidraw/actions/actionToggleWrap.ts`, `actionProperties.tsx`.
- React components use PascalCase `.tsx` with a sibling `.scss`: `components/Island.tsx` and `Island.scss`.
- The `App` class is split into `components/App.<concern>.ts` helper modules: `App.wrap.ts`, `App.text.ts`, `App.textTool.ts`.
- Tests are `*.test.ts(x)`. They sit next to the source (`actions/actionFlip.test.tsx`), or in `packages/excalidraw/tests/` and `packages/element/tests/`.

### Imports
Imports come in blank-line-separated groups: external libraries, then `@excalidraw/common`, `@excalidraw/math` and `@excalidraw/element` values, then `import type` from `@excalidraw/element/types`, then relative imports, with relative `import type` last. Inside `packages/excalidraw`, the sibling packages are imported only through the aliases, never through relative `../../element`. ESLint enforces this order (`eslint-plugin-import`).
```ts
import { getFontString } from "@excalidraw/common";

import { isTextElement, newElementWith, CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";
```

### Handler / controller shape (actions)
```ts
// packages/excalidraw/actions/actionToggleWrap.ts
export const actionToggleWrap = register({
  name: "toggleWrap",
  label: "labels.toggleWrap",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => app.wrap.toggle(elements, appState),
  keyTest: (event, appState, elements, app) =>
    !event[KEYS.CTRL_OR_CMD] && !event.altKey && !event.shiftKey &&
    matchKey(event, KEYS.W) && app.scene.getSelectedElements(appState).length > 0,
});
```
`perform` returns `false` (no-op) or `{ elements, appState, captureUpdate: CaptureUpdateAction.IMMEDIATELY }`. Element updates are immutable: `newElementWith(el, {...})` inside `elements.map(...)`. Property actions use the typed `register<ValueType>({...})` form and add a `PanelComponent` that renders a `<fieldset><legend>{t("labels.x")}</legend>…`. See `actionChangeFontSize` in `actions/actionProperties.tsx`.

### Element model (service-equivalent)
Element types are `Readonly<{...}>` intersections in `packages/element/src/types.ts`, and every field carries JSDoc. Example: `ExcalidrawTextElement` has `text`, `originalText`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign`, `containerId`, `autoResize`, `lineHeight` (a branded number), `baseFontSize` and `labelPosition?`. Constructors live in `newElement.ts` (`newTextElement(opts)` defaults each field, then measures with `measureText`). Updates go through `mutateElement` (scene-aware, bumps the version) or `newElementWith` (immutable copy). A new persisted field also needs:
- normalisation in `packages/excalidraw/data/restore.ts` (`case "text":`), which keeps legacy data loading
- defaults in `newTextElement`
- possibly handling in the renderer (`packages/element/src/renderElement.ts`) and the WYSIWYG editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx`)

Helpers are exported `const` arrow functions, never classes. Example from `heading.ts`: `export const vectorToHeading = (vec: Vector): Heading => {...}`.

### Component shape
```tsx
// packages/excalidraw/components/Island.tsx
import React from "react";
import clsx from "clsx";

import "./Island.scss";

type IslandProps = { children: React.ReactNode; padding?: number; className?: string | boolean };

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding, className }, ref) => (
    <div className={clsx("Island", className)} style={{ "--padding": padding }} ref={ref}>
      {children}
    </div>
  ),
);
```
These are function components with named exports (no default exports), class names built with `clsx`, and per-component SCSS. UI strings go through `t("labels.…")`, and their keys live in `packages/excalidraw/locales/en.json`. Only `en.json` is edited by hand, since the other locales come from Crowdin.

### Test shape
Integration tests render the full editor, then drive it through `UI`/`Pointer`/`Keyboard`/`API` helpers and the global `window.h`:
```tsx
// packages/excalidraw/tests/actionStyles.test.tsx
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, fireEvent, render, screen, togglePopover } from "../tests/test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("actionStyles", () => {
  beforeEach(async () => { await render(<Excalidraw handleKeyboardGlobally={true} />); });
  it("should copy & paste styles via keyboard", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10); mouse.up(20, 20);
    ...
  });
});
```
Unit tests (`packages/element/tests/newElement.test.ts`) build elements with `API.createElement({ type })`, use `it.each([...] as const)` and `vi.spyOn(...)` / `vi.restoreAllMocks()`. Snapshot files live in `__snapshots__/` and are refreshed with `yarn test:update`.

### Config
Settings come from Vite build-time env (`import.meta.env.VITE_APP_*`), set in the tracked `.env.development`, `.env.production` and `.env.test` files. No runtime validator (no zod or Joi). Shared constants (defaults such as `DEFAULT_FONT_SIZE`, `DEFAULT_TEXT_ALIGN`, `KEYS`) live in `@excalidraw/common` (`packages/common/src/constants.ts`).

### Data layer
No ORM. The scene is an in-memory array of immutable elements managed by `Scene` (`packages/element/src/Scene.ts`), and history, undo and collaboration are driven by `Store` and `delta.ts` through `captureUpdate`. Saved data is JSON (`packages/excalidraw/data/json.ts`), and loading always goes through `restore.ts`, which keeps backward compatibility.

### Framework-owned wiring
- An action registers itself in the module-level `actions` array when its module is imported and calls `register(...)` (`actions/register.ts`). Each action must also be re-exported from `actions/index.ts`, `App.tsx` then calls `this.actionManager.registerAll(actions)`, and the action name joins the `ActionName` union in `actions/types.ts`.
- Panel UI for style properties renders through `components/Actions.tsx` (`renderAction("changeFontSize")`).
- New `App` behaviour goes in an `App.<concern>.ts` module that `App.tsx` exposes as a member (example: `app.wrap.toggle`).
- Public library API is exported from `packages/excalidraw/index.tsx`. Element utilities are exported from `packages/element/src/index.ts`.

## Sample files inspected
- packages/excalidraw/actions/actionToggleWrap.ts (kind: controller/action)
- packages/excalidraw/actions/actionTextAutoResize.ts (kind: controller/action)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/actions/index.ts, actionProperties.tsx#actionChangeFontSize (kind: wiring / property action)
- packages/element/src/heading.ts (kind: service/domain)
- packages/element/src/types.ts#ExcalidrawTextElement (kind: data model)
- packages/element/src/newElement.ts#newTextElement, mutateElement.ts exports (kind: data layer)
- packages/excalidraw/data/restore.ts#case "text" (kind: persistence/migration)
- packages/excalidraw/components/Island.tsx (kind: component)
- packages/excalidraw/components/App.wrap.ts (kind: App concern module)
- packages/excalidraw/tests/actionStyles.test.tsx (kind: integration test)
- packages/element/tests/newElement.test.ts (kind: unit test)
- tsconfig.json, vitest.config.mts, .lintstagedrc.js (kind: config)

## Notes for downstream codegen
- Use named `export const` arrow functions with no default exports, and `import type` for type-only imports. Keep the import-group order and blank lines shown above.
- Import across packages only through `@excalidraw/<pkg>` aliases. Never add a relative path into another package.
- Element fields are `Readonly`. Never assign to an element directly: use `newElementWith` or `mutateElement`, and return `captureUpdate` from actions.
- Every new persisted element field needs: a type with JSDoc in `element/src/types.ts`, a default in `newElement.ts`, normalisation in `data/restore.ts`, and test coverage, including restore of legacy data with the field missing.
- Use `app.ownerDocument` / `app.ownerWindow` instead of `document` / `window` (AGENTS.md).
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit & …` (AGENTS.md).
- Code style: prefer `?.`/`??`, `const`/`readonly`, and solutions that avoid allocation and run fast (copilot-instructions.md).
- `App.tsx` is about 11.5k lines and `textWysiwyg.tsx` about 1.3k. Edit them surgically, and put new logic in a separate module (an `App.<concern>.ts` or an element helper).
- New UI strings go in `packages/excalidraw/locales/en.json` only.
- Prettier is 2.6 with `@excalidraw/prettier-config` (trailing commas, double quotes). ESLint runs with `--max-warnings=0`.
