# Stack profile: learned from repo scan

Built 2026-11-05 at HEAD `14bb42ed` for run `20261105-feature-extend-arrowhead-size`. Tier 2b triggered because the stack is React + TypeScript, and the plugin ships no adapter for it (only generic, nest, python).

Sampling note: several core files are over 500 lines. These are `actionProperties.tsx` (2322), `restore.ts` (1429), `newElement.ts` (711) and `bounds.ts`. They were **not read whole**. Only targeted excerpts around arrowhead code were taken, because those are the files the upcoming feature touches.

## Language & runtime
- TypeScript 5.9.3 with `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx`, `noEmit`. ESM throughout.
- Node >= 18, yarn 1.22 (classic) workspaces, React 19 types.
- Packages are built with esbuild (`scripts/buildBase.js`, `scripts/buildPackage.js`). The app is built with Vite 5.
- `tsc` from root typechecks `packages` and `excalidraw-app` (`yarn test:typecheck`).

## Framework
- React component library `@excalidraw/excalidraw` (`packages/excalidraw`) on top of framework-free packages:
  - `@excalidraw/element`: element model, geometry, rendering helpers
  - `@excalidraw/common`: constants and utils
  - `@excalidraw/math`
- In-house "action" system: `register({...})` with `perform` and `PanelComponent`. Editor state lives in a large `App` class component plus an `AppState` object.

## Conventions detected

### File naming
- camelCase `.ts` / `.tsx`. Actions are named `actionXxx.tsx`, e.g. `packages/excalidraw/actions/actionProperties.tsx` and `actionFlip.ts`.
- Element logic lives in `packages/element/src/<topic>.ts`, e.g. `arrowheads.ts`, `bounds.ts`, `newElement.ts`.
- Tests sit next to the code as `*.test.ts(x)`, e.g. `actions/actionProperties.test.tsx`, or in `packages/element/tests/*.test.ts` and `packages/element/src/__tests__/`.

### Imports
- Cross-package imports always go through aliases: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`. These resolve to source via `tsconfig.json` paths and `vitest.config.mts`.
- Inside a package, imports are relative.
- Group order: external package aliases first, then `react`, then local relative imports, separated by blank lines.
- `import type` is used for type-only imports.

```ts
import { pointFrom } from "@excalidraw/math";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ARROW_TYPE,
  invariant,
  reduceToCommonValue,
} from "@excalidraw/common";
```

### Element model (data layer)
There is no ORM. Elements are immutable `Readonly<...>` plain objects defined in `packages/element/src/types.ts` and persisted as JSON in `.excalidraw` files and app storage.

```ts
export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "line" | "arrow";
    points: readonly LocalPoint[];
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
  }>;
```

- A new element prop must be added in each of these places:
  1. The type in `types.ts`.
  2. The constructor `newArrowElement` / `newLinearElement` in `packages/element/src/newElement.ts`.
  3. `restoreElement` in `packages/excalidraw/data/restore.ts`, which fills defaults for old files.
- Example from the `restore.ts` "arrow" case:

```ts
case "arrow": {
  const startArrowhead = normalizeArrowhead(element.startArrowhead);
  const endArrowhead =
    element.endArrowhead === undefined
      ? "arrow"
      : normalizeArrowhead(element.endArrowhead);
  ...
  const base = { type: element.type, ..., startArrowhead, endArrowhead, points, ... };
```

- Mutations go through `newElementWith(el, {...})` (immutable, bumps version) or `mutateElement` / `scene.mutateElement`. Never assign to element fields directly.

### Handler / controller shape (actions = properties-panel controls)
From `packages/excalidraw/actions/actionProperties.tsx`, `actionChangeArrowhead`:

```tsx
export const actionChangeArrowhead = register<{
  position: "start" | "end";
  type: Arrowhead;
}>({
  name: "changeArrowhead",
  label: "Change arrowheads",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        isLinearElement(el) ? newElementWith(el, { ... }) : el),
      appState: { ...appState, currentItemEndArrowhead: value.type },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.arrowheads")}</legend>
      ... value={getFormValue(elements, app, (el) => ..., true, (hasSelection) => ...)}
          onChange={(value) => updateData({ ... })}
    </fieldset>
  ),
});
```

- `changeProperty` applies the change to the selected elements. `getFormValue` reads the common value across the selection, or falls back to `appState.currentItem*`.
- Elbow arrows must be re-routed after any change that affects arrowhead geometry: `updateElbowArrowRoute(element, app.scene.getNonDeletedElementsMap())`.
- Every new action name must be added to the `ActionName` union in `packages/excalidraw/actions/types.ts`.

### Framework-owned wiring
- An action registers itself just by calling `register()` (`actions/register.ts`) when its module is imported. It must also be exported from `actions/index.ts`.
- To show it in the panel, call `renderAction("<name>")` in `packages/excalidraw/components/Actions.tsx`. Two places:
  - Desktop: `{predicates.arrowheads && <>{renderAction("changeArrowhead")}</>}`
  - Compact/mobile: inside `actionChangeArrowProperties.PanelComponent`.
- "Current item" defaults:
  - `AppState` type in `packages/excalidraw/types.ts`
  - `getDefaultAppState()` in `packages/excalidraw/appState.ts`
  - The storage config entry in the same file, e.g. `currentItemEndArrowhead: { browser: true, export: false, server: false }`
- New elements are created from `currentItem*` in:
  - `components/App.drawshape.ts`
  - `components/App.tsx` (around line 8626)
  - `element/src/flowchart.ts`
  - `element/src/convertToShape.ts`
  - `components/ConvertElementTypePopup.tsx`
- UI strings are i18n keys in `packages/excalidraw/locales/en.json` (`labels.*`), accessed with `t("labels.xxx")`. Only `en.json` is edited by hand; other locales come from Crowdin.

### Geometry / rendering
- `packages/element/src/bounds.ts` → `getArrowheadSize(arrowhead): number` returns the per-type px size (arrow 25, diamond 12, default 15, cardinality constants).
- `getArrowheadAngle(arrowhead, size)` already supports drawing a **scaled-down** size. Short last segments shrink arrowheads.
- `getArrowheadSize` is also consumed by:
  - `elbowArrow.ts` (route padding, around line 1493)
  - `transform.ts` (around line 662)
  - `bounds.ts` (`getArrowheadSizeBeyondLastSegment`, legibility)
  - tests

### Test shape
Vitest with globals (`describe/it/expect`), jsdom, `@testing-library/react`, and the in-repo helpers `API` (`tests/helpers/api`) and `UI` (`tests/helpers/ui`).

```tsx
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

describe("...", () => {
  beforeEach(async () => { await render(<Excalidraw />); });
  it("...", () => {
    UI.clickTool("rectangle");
    API.setAppState({ currentItemFillStyle: "hachure" });
    expect(queryByTestId(document.body, `fill-hachure`)).toHaveClass("active");
  });
});
```

- Element-level geometry tests (`packages/element/tests/bounds.test.ts`) call pure functions directly and use `API.createElement({ type: "arrow", ... })`.
- Snapshot tests exist, so `yarn test:update` is the documented pre-commit step.
- `window.h` exposes the app state in tests (`const { h } = window;`).

### Config
- Vite env through `import.meta.env.VITE_*`. The tracked `.env.development` / `.env.production` hold public config. There is no runtime validator. Not relevant to editor features.

## Sample files inspected
- packages/excalidraw/actions/actionProperties.tsx (kind: controller/action, excerpts)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/actions/types.ts (kind: wiring, excerpt)
- packages/excalidraw/components/Actions.tsx (kind: wiring, excerpt)
- packages/excalidraw/appState.ts (kind: config/defaults, excerpt)
- packages/element/src/types.ts (kind: model, excerpt)
- packages/element/src/arrowheads.ts (kind: service)
- packages/element/src/bounds.ts (kind: service/geometry, excerpt)
- packages/element/src/newElement.ts (kind: model constructor, excerpt)
- packages/excalidraw/data/restore.ts (kind: migration, excerpt)
- packages/excalidraw/actions/actionProperties.test.tsx (kind: test)
- packages/excalidraw/actions/actionFlip.test.tsx (kind: test)
- packages/element/tests/bounds.test.ts (kind: test, excerpt)
- tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Follow AGENTS.md:
  - For new DOM APIs, use `app.ownerDocument` / `app.ownerWindow`.
  - For type overrides, use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`.
- Follow `.github/copilot-instructions.md`: prefer immutable data, `?.` / `??`, and allocation-free implementations.
- A new optional element property must be backward compatible. Old scenes lack it, so `restore.ts` must default it, and rendering must treat a missing value as today's size.
  - Consider whether collaboration reconciliation or versioning needs changes. Element version bumps happen through `newElementWith`.
- Keep the element type `Readonly<...>`. Add the property next to `startArrowhead` / `endArrowhead` in `ExcalidrawLinearElement`, or on `ExcalidrawArrowElement` if it applies to arrows only.
- For the panel control, mirror an existing action that has `currentItem*` state. `actionChangeArrowhead` and the font-size / stroke-width actions in the same file are the closest patterns.
  - Register the new name in the `ActionName` union.
  - Render it in both the desktop and compact paths of `Actions.tsx`.
  - Add the `en.json` label.
- Prettier is 2.6.2 with `@excalidraw/prettier-config` (trailing commas, double quotes). ESLint runs with `--max-warnings=0`.
- Verify with `yarn test:typecheck` and `yarn test:app --watch=false <paths>`.
