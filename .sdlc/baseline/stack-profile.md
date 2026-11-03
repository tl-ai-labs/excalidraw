# Stack profile — learned from repo scan

Built 2026-11-03 (run 20261103-104806-feature-extend-lasso-wrap-overlap) at HEAD cf212b2f. It was triggered because no pre-authored adapter exists for React/TypeScript.

## Language & runtime
The code is TypeScript 5.9.3 with `strict: true`, `target`/`module` ESNext and `jsx: react-jsx`. It runs on Node >= 18 and uses yarn 1 workspaces. Everything is ESM `import`. Packages import each other through `@excalidraw/<pkg>` path aliases, which `vitest.config.mts` and the tsconfig paths resolve to the sources.

## Framework
The editor library is React 19, a large class component `App` (`packages/excalidraw/components/App.tsx`) plus functional UI components. State is AppState through `this.setState` / `useExcalidrawSetAppState`, with Jotai for editor-local atoms. Vite builds the app, esbuild builds the packages. Tests use Vitest with jsdom and vitest-canvas-mock.

## Conventions detected

### File naming
- Feature folders use lowercase names with an `index.ts` plus `utils.ts`, for example `packages/excalidraw/lasso/index.ts` and `packages/excalidraw/lasso/utils.ts`.
- Actions are camelCase files with an `action` prefix, for example `packages/excalidraw/actions/actionZindex.tsx`.
- Components are PascalCase `.tsx` files, for example `components/main-menu/DefaultItems.tsx`.
- Tests are `<feature>.test.tsx` under `packages/<pkg>/tests/`, for example `packages/excalidraw/tests/lasso.test.tsx`.

### Import shape
Imports are grouped with blank lines in this order: third-party, then `@excalidraw/*` value imports, then `import type` from `@excalidraw/*/types`, then relative imports, then relative `import type`. ESLint import ordering enforces this.
```ts
import { simplify } from "points-on-curve";

import { polygonFromPoints, lineSegment, polygonIncludesPointNonZero } from "@excalidraw/math";
import { type Bounds } from "@excalidraw/common";
import { doBoundsIntersect, getElementBounds, intersectElementWithLineSegment } from "@excalidraw/element";

import type { ElementsSegmentsMap, GlobalPoint } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";
```

### Pure-helper shape (lasso/utils.ts)
Helpers are arrow-function exports that take a single object input with an explicit return type. Optional params come last as `?:`.
```ts
export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
}): {
  selectedElementIds: string[];
} => {
```
Private helpers are non-exported `const enclosureTest = (...) : boolean => {}` in the same file.

### Class shape (lasso/index.ts)
```ts
export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
  private keepPreviousSelection: boolean = false;
  constructor(app: App) { super(app, { animateTrail: true, ... }); }
```
The class reads `this.app.state` (AppState) and calls `this.app.setState(...)`.

### Action shape
```ts
export const actionSendBackward = register({
  name: "sendBackward",
  label: "labels.sendBackward",
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => ({
    elements: ..., appState, captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  }),
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && !event.shiftKey && event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (<button ... />),
});
```

### Preference toggle shape (the closest analogue for a mode setting)
From `components/main-menu/DefaultItems.tsx`:
```tsx
const PreferencesBoxSelectionModeItem = () => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  return (
    <DropdownMenuItemContentRadio<"contain" | "overlap">
      name="boxSelectionMode"
      icon={emptyIcon}
      value={appState.boxSelectionMode}
      onChange={(value) => { setAppState({ boxSelectionMode: value }); }}
      choices={[
        { value: "contain", label: t("labels.boxSelectionContain"), ariaLabel: t("labels.boxSelectionContain") },
        { value: "overlap", label: t("labels.boxSelectionOverlap"), ariaLabel: t("labels.boxSelectionOverlap") },
      ]}
    >
      {t("labels.boxSelectionMode")}
    </DropdownMenuItemContentRadio>
  );
};
```
Adding an AppState field touches the following places:
1. The type: `packages/excalidraw/types.ts` (`export type BoxSelectionMode = "contain" | "overlap";` plus the AppState field).
2. The default in `getDefaultAppState()` in `packages/excalidraw/appState.ts`.
3. The storage config `{ browser: true, export: false, server: false }` in `APP_STATE_STORAGE_CONF` in the same file.
4. The i18n labels in `packages/excalidraw/locales/en.json`, which is the only locale to edit. The others come from Crowdin.
5. The snapshots, which serialize AppState and need regenerating with `yarn test:update`.

### Test shape
Tests use Vitest globals (`describe`/`it`/`expect`/`beforeEach`, no imports). They render the full editor and drive it through `window.h`:
```tsx
import { Excalidraw } from "../index";
import { act, render } from "./test-utils";
const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;
});

const updatePath = (startPoint: GlobalPoint, points: LocalPoint[]) => {
  act(() => {
    h.app.lassoTrail.startPath(startPoint[0], startPoint[1]);
    ...
```
- Test helpers live in `packages/excalidraw/tests/helpers/` (`api.ts`, `ui.ts`, `mocks.ts`). Use `API.createElement`, `API.setElements`, and `h.setState`.
- The lasso tests also call `getLassoSelectedElementIds` directly, with precomputed `elementsSegments` from `getElementLineSegments`.

### Config
Configuration comes from env values read through `import.meta.env.VITE_APP_*`, with tracked `.env.development`, `.env.production` and `.env.test` files. Editor options are AppState fields and component props, not config files.

### Data layer
There is no ORM. Scene elements are immutable records (`ExcalidrawElement`), accessed through `app.scene` / `elementsMap`. Geometry comes from `@excalidraw/math` and `@excalidraw/element` (`doBoundsIntersect`, `getElementBounds`, `intersectElementWithLineSegment`, `elementsOverlappingBBox` in `packages/element/src/bounds.ts`).

### Framework-owned wiring
- Actions register by calling `register({...})` (`actions/register.ts`) and are re-exported from `actions/index.ts`.
- Tools are dispatched inside `App.tsx` pointer handlers, for example `if (this.state.activeTool.type === "lasso") { ... this.lassoTrail.startPath(...) }`.
- Box selection passes `this.state.boxSelectionMode` into `getElementsWithinSelection(...)` (App.tsx about line 11311).

## Sample files inspected
- packages/excalidraw/lasso/utils.ts (kind: domain helper)
- packages/excalidraw/lasso/index.ts (kind: service/class)
- packages/excalidraw/actions/actionZindex.tsx (kind: action/handler)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/components/main-menu/DefaultItems.tsx, lines 440-475 (kind: UI component)
- packages/element/src/selection.ts, lines 70-100 (kind: domain helper)
- packages/excalidraw/tests/lasso.test.tsx, first 50 lines (kind: test; the file is over 500 lines, so only the head was sampled for its shape)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Reuse the existing `"contain" | "overlap"` vocabulary and the `BoxSelectionMode` pattern, rather than inventing new terms, unless the spec says otherwise.
- Follow the performance guidance in `.github/copilot-instructions.md`: avoid allocations in hot loops (lasso runs on every pointer move), prefer `const`/`readonly`, and use `?.`/`??`.
- Keep the import-group ordering, because `yarn test:code` uses `--max-warnings=0`.
- For type-only imports, use `import type { ... } from "@excalidraw/element/types"`.
- Edit only `locales/en.json` for new strings.
- Expect AppState snapshot churn. Run `yarn test:update` and then `yarn test:typecheck`.
