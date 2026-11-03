# Stack profile — learned from repo scan

Built 2026-11-02 for run 20261102-144102-feature-new-text-range-styles (Tier 2b trigger: React + TypeScript has no pre-authored adapter).

## Language & runtime
TypeScript 5.9.3 with `strict: true`, `moduleResolution: bundler`, `isolatedModules`, `noEmit`, `jsx: react-jsx`, and ESM throughout. Node >= 18 (CI uses 20.x). React 19 in the app; the library supports React 17/18/19. Yarn 1.22 workspaces. Packages are built with esbuild and the app with Vite 5.

## Framework
React component library (`@excalidraw/excalidraw`) plus a Vite app (`excalidraw-app`). State lives in a class component `App` with `AppState` and the scene, plus jotai atoms for UI. The canvas is rendered imperatively (2D context and roughjs), and export goes through an SVG DOM builder.

## Conventions detected

### File naming
- camelCase modules: `textWrapping.ts`, `textMeasurements.ts`, `renderElement.ts`, `staticSvgScene.ts`, `actionProperties.tsx`.
- Tests sit next to the source as `<name>.test.ts(x)` (`wysiwyg/textWysiwyg.test.tsx`, `actions/actionProperties.test.tsx`), or live in `packages/<pkg>/tests/` (`packages/element/tests/textWrapping.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`). Snapshots are in `__snapshots__/*.snap`.

### Imports
Package aliases come first, then relative imports. `import type` statements are grouped separately and placed last. Within the repo, use `@excalidraw/<pkg>` (and `@excalidraw/<pkg>/<file>` for types); aliases are defined in `tsconfig.json` and `vitest.config.mts`.
```ts
import { arrayToMap, isDevEnv, isTestEnv } from "@excalidraw/common";

import {
  orderByFractionalIndex,
  syncInvalidIndices,
} from "@excalidraw/element";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { MakeBrand } from "@excalidraw/common/utility-types";

import type { AppState } from "../types";
```

### Element types (data model)
Element types are `Readonly<{...}>` intersections with `_ExcalidrawElementBase`, documented with JSDoc. Optional newer fields use `?: T | null` (example: `labelPosition`). From `packages/element/src/types.ts`:
```ts
export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: "text";
    fontSize: number;
    text: string;
    originalText: string;
    autoResize: boolean;
    lineHeight: number & { _brand: "unitlessLineHeight" };
    /** ... normalized arc-length parameter (0–1) ... */
    labelPosition?: number | null;
  }>;
```
Elements are immutable outside `mutateElement` (`packages/element/src/mutateElement.ts` L40) and `newElementWith` (L149). Both bump `version`/`versionNonce`, and collab reconciliation and the render caches rely on that. Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit & ...` (AGENTS.md).

### Action shape (handler equivalent)
Actions are built with `register<TValue>({ name, label, trackEvent, perform, PanelComponent })`. `perform` returns `{ elements, appState, captureUpdate }`. From `packages/excalidraw/actions/actionProperties.tsx`:
```ts
export const actionChangeStrokeColor = register<
  Partial<AppState> & { color?: string }
>({
  name: "changeStrokeColor",
  label: "labels.stroke",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const target = resolveColorTarget(appState, elements, "strokeColor");
    return {
      elements: changeProperty(elements, appState, (el) =>
        hasStrokeColor(el.type)
          ? newElementWith(el, getColorUpdate(el, "strokeColor", color, elementsMap))
          : el, true),
      appState: { ...appState, ...getColorTargetAppStateUpdates(target, color) },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
```
UI strings are looked up with `t("labels.x")` and keys are added to `packages/excalidraw/locales/en.json` only.

### Rendering shape
Canvas (`packages/element/src/renderElement.ts`, text branch):
```ts
withSavedContext(context, () => {
  context.font = getFontString(element);
  context.fillStyle = applyDarkModeFilter(element.strokeColor, renderConfig.theme === THEME.DARK);
  context.textAlign = element.textAlign as CanvasTextAlign;
  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    context.fillText(lines[index], horizontalOffset, index * lineHeightPx + verticalOffset);
  }
});
```
SVG (`packages/excalidraw/renderer/staticSvgScene.ts`) builds nodes with `svgRoot.ownerDocument.createElementNS(SVG_NS, "text")`, one per line, and sets `fill` through `applyDarkModeFilter`. Use `ownerDocument`/`ownerWindow` instead of globals (AGENTS.md). Colours always go through `applyDarkModeFilter` for dark theme.

### Data restore
`packages/excalidraw/data/restore.ts` handles each type with `switch (element.type) { case "text": ... restoreElementWithProperties(element, {...defaults}) }`. Each field is validated with helpers such as `isFiniteNumber` and `clamp`, and falls back to a default.

### Test shape
Vitest globals (`describe/it/expect`, `vi` from "vitest"), jsdom, and `vitest-canvas-mock` (`measureText` width = text.length, so a 10px font gives 10 per char). UI tests render `<Excalidraw />` and drive it through the `API` and `UI`/`Keyboard`/`Pointer` helpers in `packages/excalidraw/tests/helpers/`.
```ts
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

describe("...", () => {
  beforeEach(async () => { await render(<Excalidraw />); });
  it("...", () => {
    const text = API.createElement({ type: "text", text: "hello" });
    API.setElements([text]);
    API.setAppState({ currentItemStrokeColor: "#e03131" });
    ...
  });
});
```
Pure unit tests import directly from `../src/<module>`, for example `packages/element/tests/textWrapping.test.ts`.

### Config
`import.meta.env.VITE_APP_*` is read in the app. Test setup is `setupTests.ts` at the root. There is no runtime validator library.

### Data layer
No ORM. The scene is an in-memory array of elements. Persistence goes through localStorage/IndexedDB (`excalidraw-app/data/LocalData.ts`), Firebase (`excalidraw-app/data/firebase.ts`), and socket.io collab (`excalidraw-app/collab/Collab.tsx`) using `reconcileElements` (`packages/excalidraw/data/reconcile.ts`, whole-element LWW by `version`/`versionNonce`).

### Framework-owned wiring
New actions are exported from `packages/excalidraw/actions/index.ts` and registered through `register()`. Panels render via `PanelComponent` in the shape-actions UI. New element fields need: the type in `packages/element/src/types.ts`, the default in `newElement.ts`, and the restore path in `restore.ts`. The export/serialize paths (`data/json.ts`, clipboard) handle the field through element spreading.

## Sample files inspected
- packages/element/src/types.ts (kind: model)
- packages/element/src/renderElement.ts (kind: renderer)
- packages/excalidraw/renderer/staticSvgScene.ts (kind: renderer/export)
- packages/excalidraw/actions/actionProperties.tsx (kind: action/handler)
- packages/excalidraw/data/restore.ts (kind: data/migration)
- packages/excalidraw/data/reconcile.ts (kind: service)
- packages/excalidraw/actions/actionProperties.test.tsx (kind: test, integration)
- packages/excalidraw/wysiwyg/textWysiwyg.test.tsx (kind: test, integration)
- packages/excalidraw/tests/data/restore.test.ts (kind: test)
- packages/element/tests/textWrapping.test.ts (kind: test, unit)
- tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Prettier is v2 with `@excalidraw/prettier-config` (trailing commas, double quotes, 2 spaces, nested ternaries indented). Run `yarn fix`. ESLint enforces import order and max-warnings=0.
- Keep new element fields optional and omitted or null when unused. Otherwise dozens of `__snapshots__` churn.
- Never mutate elements directly. Use `mutateElement`, `scene.mutateElement` or `newElementWith`.
- `text` is the wrapped form of `originalText`. Range data must be anchored to `originalText` and survive re-wrapping (`wrapText` inserts `\n`, and trailing whitespace can change).
- `elementWithCanvasCache` (renderElement.ts) is keyed by element identity/version. Version bumps through `mutateElement` invalidate it.
- Respect RTL (`isRTL`) and `textAlign` center/right when computing per-segment x offsets. With `context.textAlign` center/right, segment-by-segment `fillText` needs explicit offset maths (or switch to left alignment and compute the line start).
- The canvas mock measures width as text.length × (fontSize/10)-ish. Write measurement assertions with that in mind.
