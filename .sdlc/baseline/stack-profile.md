# Stack profile: learned from repo scan

Built for run `20261109-131655-feature-extend-arrowhead-size` at HEAD `14bb42ed`. Tier 2b triggered because the stack is React + TypeScript and has no pre-authored adapter. Profile age: 0 runs.

## Language & runtime
The whole repo is TypeScript 5.9.3 with `strict: true`, `target`/`module` ESNext, `moduleResolution: bundler` and `jsx: react-jsx`. Packages are ESM (`"type": "module"`). It runs on Node >= 18 and is managed as yarn 1 workspaces. React 19 typings are used. Library packages are built with esbuild and the app with Vite. Tests use vitest 3 with jsdom, `vitest-canvas-mock` and `@testing-library/react`, and are configured in `setupTests.ts` and `vitest.config.mts`.

## Framework
React component library (`@excalidraw/excalidraw`) with an in-house **Action** system: `register({...})` plus an `ActionManager`. State lives in a class component (`App.tsx`) with an `AppState` object, and jotai is used for some editor atoms. Element model and geometry live in the framework-free package `@excalidraw/element`.

## Conventions detected

### File naming
- Element/geometry modules are camelCase `.ts`: `packages/element/src/arrowheads.ts`, `bounds.ts`, `newElement.ts`.
- Actions use the `action<Name>.ts(x)` prefix, with one theme per file and tests next to them: `actions/actionProperties.tsx`, `actions/actionProperties.test.tsx`, `actions/actionFlip.test.tsx`.
- React components are PascalCase `.tsx` with a sibling `.scss`: `components/Range.tsx` + `Range.scss`, `components/RadioSelection.tsx`.
- Element-package tests live in `packages/element/tests/*.test.ts(x)` and `packages/element/src/__tests__/`. Library tests live in `packages/excalidraw/tests/**`.

### Import shapes
Cross-package imports always use the alias (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/element/types`). Imports inside a package are relative (`../components/Range`). Type-only imports use `import type`, grouped after value imports with blank lines between groups (import/order). Example from `actions/actionProperties.tsx`:
```ts
import { pointFrom } from "@excalidraw/math";

import { useEffect, useMemo, useRef, useState } from "react";

import { ARROW_TYPE, STROKE_WIDTH_KEYS, invariant, reduceToCommonValue } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";
import { getArrowheadForPicker } from "@excalidraw/element";

import type { Arrowhead, ExcalidrawLinearElement } from "@excalidraw/element/types";

import { RadioSelection } from "../components/RadioSelection";
import { Range } from "../components/Range";
```

### Handler / controller shape (Action = properties-panel control)
From `packages/excalidraw/actions/actionProperties.tsx`, `actionChangeOpacity`:
```tsx
export const actionChangeOpacity = register<ExcalidrawElement["opacity"]>({
  name: "changeOpacity",
  label: "labels.opacity",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState,
        (el) => newElementWith(el, { opacity: value }), true),
      appState: { ...appState, currentItemOpacity: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, app, updateData }) => {
    const opacity = getFormValue(elements, app, (element) => element.opacity, true,
      (hasSelection) => (hasSelection ? null : appState.currentItemOpacity));
    return (
      <Range label={t("labels.opacity")} value={opacity ?? appState.currentItemOpacity}
        hasCommonValue={opacity !== null} onChange={updateData}
        min={0} max={100} step={10} testId="opacity" />
    );
  },
});
```
`actionChangeStrokeWidth` (around line 716) shows the discrete-choice variant: `<fieldset><legend>` wrapping a `RadioSelection<Key>` whose options carry `value/text/icon/testId`. `actionChangeArrowhead` (around line 1960) shows the per-linear-element update, including the elbow-arrow re-route via `updateElbowArrowRoute`, plus the `currentItemStartArrowhead`/`currentItemEndArrowhead` appState mirroring.

### Service shape (element-package pure functions)
These are plain exported arrow functions with no classes. They have explicit return types and use `switch` over string-literal unions. From `packages/element/src/bounds.ts`:
```ts
/** @returns number in pixels */
export const getArrowheadSize = (arrowhead: Arrowhead): number => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    ...
    default:
      return 15;
  }
};
```
Element updates are immutable. Use `newElementWith(el, partial)` in actions and `scene.mutateElement` / `mutateElement` elsewhere. Element types are `Readonly<{...}>` intersections in `packages/element/src/types.ts`.

### Test shape
Vitest uses globals (`describe/it/expect`) with no import. UI tests render `<Excalidraw />` and drive it through the helpers `API`, `UI`, `Pointer` and `Keyboard` from `packages/excalidraw/tests/helpers/*`, querying by `data-testid`. From `actions/actionProperties.test.tsx`:
```tsx
describe("element locking", () => {
  beforeEach(async () => { await render(<Excalidraw />); });
  it("should show active background top picks", () => {
    UI.clickTool("rectangle");
    API.setAppState({ currentItemBackgroundColor: color });
    const activeColor = queryByTestId(document.body, `color-top-pick-${color}`);
    expect(activeColor).toHaveClass("active");
  });
});
```
Element/geometry tests build elements with `API.createElement({ type: "arrow", points: [...], endArrowhead: "triangle" })` and assert on the outputs of `ShapeCache.generateElementShape`. They use `it.each([...] as const)`; see `packages/element/tests/shape.test.ts`. Snapshot tests (`__snapshots__`) are widespread, so run `yarn test:update` after changing element shape fields.

### Config
Client env comes through Vite `import.meta.env.VITE_APP_*`, set in the committed `.env.development` / `.env.production`. There is no runtime validator, and none of this affects editor features.

### Data layer
No ORM. The scene is an in-memory element array. Persistence is JSON serialization, and loading goes through `packages/excalidraw/data/restore.ts`. Every element field needs a backward-compatible default in `restoreElement`. For example, the arrow branch defaults a missing `endArrowhead` to `"arrow"` and runs `normalizeArrowhead`. Collaboration reconciles on `version`/`versionNonce`, which `newElementWith` bumps automatically.

### Framework-owned wiring
A new properties-panel control needs all of these:
1. A `register({...})` call in `actions/*.tsx`, re-exported from `actions/index.ts`.
2. The name added to the `ActionName` union in `actions/types.ts`.
3. Rendering via `renderAction("<name>")` in `components/Actions.tsx`, gated by a predicate in `components/shapeActionPredicates.ts` (for example `predicates.arrowheads`). For arrows, `actionChangeArrowProperties` groups `changeArrowhead` + `changeArrowType`.
4. Labels in `packages/excalidraw/locales/en.json` only.
5. Any `currentItem*` default in `appState.ts` (with its storage-config entry `{ browser, export, server }`) and its type in `packages/excalidraw/types.ts`.

Also check `actions/actionStyles.ts` (copy/paste styles) and `data/restore.ts` for new element properties.

## Sample files inspected
- `packages/excalidraw/actions/actionProperties.tsx` (kind: controller/action)
- `packages/excalidraw/actions/register.ts` (kind: framework wiring)
- `packages/excalidraw/components/Range.tsx` (kind: component)
- `packages/element/src/bounds.ts` (kind: service/geometry)
- `packages/element/src/arrowheads.ts` (kind: service)
- `packages/element/src/newElement.ts` (kind: factory)
- `packages/element/src/types.ts` (kind: model)
- `packages/excalidraw/data/restore.ts` (kind: data layer)
- `packages/excalidraw/actions/actionProperties.test.tsx`, `actions/actionElementLock.test.tsx`, `packages/element/tests/shape.test.ts` (kind: test)
- `vitest.config.mts`, `tsconfig.json` (kind: config)

## Notes for downstream codegen
- Follow AGENTS.md:
  - Use `app.ownerDocument`/`app.ownerWindow`, never `document`/`window` globals, in new DOM code.
  - Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit<...> & ...`.
- Follow `.github/copilot-instructions.md`: prefer `const`/`readonly`, `?.`/`??`, and allocation-free hot paths. Rendering and geometry code runs per frame.
- New element fields go on the `Readonly<{}>` type. Make them optional or give them defaults in `newElement.ts` factories and `restore.ts` so that old scenes load.
- Use `invariant(value, "...")` from `@excalidraw/common` at the top of `perform` when the value is required.
- `captureUpdate: CaptureUpdateAction.IMMEDIATELY` is the norm for panel changes.
- Prettier 2.6 is the formatter: trailing commas, double quotes, 80 columns. Lint runs with `--max-warnings=0`.
- Expect snapshot churn in `packages/excalidraw/tests/__snapshots__` when element defaults change.
