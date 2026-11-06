# Stack profile: learned from repo scan

Built 2026-11-06 for run `20261106-152507-feature-extend-arrowhead-size`. HEAD `14bb42ede`.

## Language & runtime
TypeScript 5.9.3 throughout, with `strict: true`, `isolatedModules`, `noFallthroughCasesInSwitch`, `module: ESNext` and `moduleResolution: bundler`. Modules are ESM. Node >= 18. Yarn 1 workspaces (`excalidraw-app`, `packages/*`, `examples/*`). Packages are built with esbuild and the app with Vite 5.

## Framework
A React 19 component library (`@excalidraw/excalidraw`) and app, with jotai for some state. The editor is built around a custom in-house **Action** system: `register({...})` sits on top of a big class component (`components/App.tsx`). Element model, geometry and rendering live in the framework-free `@excalidraw/element`, `@excalidraw/math` and `@excalidraw/common` packages.

## Conventions detected

### File naming
- In element and common, logic files are camelCase `.ts`, e.g. `packages/element/src/arrowheads.ts`, `packages/element/src/bounds.ts`, `elbowArrow.ts`.
- Actions are named `action<Name>.ts(x)`, e.g. `packages/excalidraw/actions/actionToggleArrowBinding.tsx`. Tests sit next to them as `action<Name>.test.tsx`.
- React components are PascalCase `.tsx` with a sibling `.scss`. `App.tsx` is split into `App.<concern>.ts` helpers.
- Tests are `*.test.ts(x)`. They live in `packages/excalidraw/tests/`, `packages/element/tests/`, `packages/element/src/__tests__/` and next to source files.

### Imports
Imports come in blank-line-separated groups: external/alias imports first (`@excalidraw/math`, `@excalidraw/common`, `@excalidraw/element`), then `import type` groups, then relative imports. Cross-package code uses the `@excalidraw/<pkg>` aliases, not relative `../../`. Code inside a package uses relative imports.
```ts
import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";
```

### Handler / controller shape (Action)
From `packages/excalidraw/actions/actionToggleGridMode.tsx`:
```ts
export const actionToggleGridMode = register({
  name: "gridMode",
  icon: gridIcon,
  keywords: ["snap"],
  label: "labels.toggleGrid",
  viewMode: true,
  trackEvent: { category: "canvas", predicate: (appState) => appState.gridModeEnabled },
  perform(elements, appState) {
    return {
      appState: { ...appState, gridModeEnabled: !this.checked!(appState), objectsSnapModeEnabled: false },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
```
Property-change actions with a typed value use `register<{...}>({ ... perform: (elements, appState, value, app) => ({ elements: changeProperty(...), ... }) })`. See `actionChangeArrowhead` in `packages/excalidraw/actions/actionProperties.tsx` (around line 1960). That code uses `newElementWith(el, {...})` for immutable element updates and `invariant(value, ...)`.

### Service / domain shape
Pure exported arrow functions, no classes (except `Scene`, `Store`, `ShapeCache`). Exhaustive `switch` on string-union types with a `default`. From `packages/element/src/bounds.ts`:
```ts
export const getArrowheadSize = (arrowhead: Arrowhead): number => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "cardinality_many":
    case "cardinality_one_or_many":
    case "cardinality_zero_or_many":
      return CROWFOOT_ARROWHEAD_SIZE;
    ...
    default:
      return 15;
  }
};
```
Constants are UPPER_SNAKE module-level `const`s, with a comment explaining any geometry choice.

### Types
Element types are `Readonly<{...}>` intersections in `packages/element/src/types.ts`. Arrowheads are string-literal unions: `Arrowhead`, `CardinalityArrowhead`, `ArrowheadLegacy`, `AnyArrowhead`. Legacy names are mapped in `arrowheads.ts#normalizeArrowhead`. Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` (see AGENTS.md).

### Test shape
Vitest with globals (`describe`/`it`/`expect`, no import), jsdom, `vitest-canvas-mock`. Snapshot files live in `__snapshots__/`. Elements are built with `API.createElement({...})` from `packages/excalidraw/tests/helpers/api.ts`. Full-editor tests use `render(<Excalidraw />)` from `tests/test-utils` and the global `window.h`. From `packages/element/tests/bounds.test.ts`:
```ts
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { getArrowheadPoints, getArrowheadSize } from "../src/bounds";

import type { Arrowhead, ExcalidrawLinearElement } from "../src/types";

describe("getArrowheadPoints()", () => {
  ...
  const arrow = API.createElement({ type: "arrow", ... });
```

### Config
Vite env through `import.meta.env.VITE_APP_*`. Values come from committed `.env.development` and `.env.production`. Library constants are in `@excalidraw/common` (`constants.ts`). There is no runtime validator.

### Data layer
No ORM. The scene is an in-memory array of immutable elements. Updates go through `newElementWith` (immutable) or `mutateElement` / `scene.mutateElement` (`packages/element/src/mutateElement.ts`). Persistence is JSON (`packages/excalidraw/data/json.ts`). Loading goes through `packages/excalidraw/data/restore.ts`, which normalises legacy fields, for example by calling `normalizeArrowhead`. A new element property needs restore defaults and maybe a `newElement.ts` default.

### Framework-owned wiring
- A new action is registered by calling `register()` (`actions/register.ts` appends to `actions`). It is re-exported from `packages/excalidraw/actions/index.ts`, and its name is added to the `ActionName` union in `actions/types.ts`.
- UI strings go in `packages/excalidraw/locales/en.json` only. Other locales come from Crowdin, so do not edit them.
- Rendering uses rough.js through `packages/element/src/shape.ts` and `renderElement.ts`. Arrowhead geometry comes from `bounds.ts#getArrowheadPoints`.

## Sample files inspected
- packages/excalidraw/actions/actionToggleArrowBinding.tsx (kind: controller/action)
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: controller/action)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/actions/actionProperties.tsx#actionChangeArrowhead (kind: controller/action, excerpt only; file >500 lines)
- packages/element/src/arrowheads.ts (kind: service/domain)
- packages/element/src/bounds.ts#getArrowheadSize (kind: service/domain, excerpt)
- packages/element/src/types.ts#Arrowhead (kind: types, excerpt)
- packages/excalidraw/actions/actionFlip.test.tsx (kind: test, editor-level)
- packages/element/src/__tests__/flowchart.test.ts (kind: test, unit)
- packages/element/tests/bounds.test.ts (kind: test, unit, header excerpt)
- tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Prettier formatting applies (`@excalidraw/prettier-config`): double quotes, trailing commas, 80 columns. ESLint runs with `--max-warnings=0`, including import ordering with blank lines between groups.
- Prefer pure functions and exhaustive `switch` over string unions. Keep allocation low (copilot-instructions). Use `?.` and `??`, and `const`/`readonly`.
- Never mutate elements in place inside actions. Use `newElementWith` and return `{ elements, appState, captureUpdate }`.
- Any change to element geometry (for example arrowhead size) also affects bounds, hit-testing and snapshots. Expect `__snapshots__` churn, and say so before running `yarn test:update`.
- Use `app.ownerDocument` / `app.ownerWindow` rather than `document` / `window` for new DOM API use (AGENTS.md).
