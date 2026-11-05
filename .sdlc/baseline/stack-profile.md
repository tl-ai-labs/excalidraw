# Stack profile — learned from repo scan

Built 2026-11-05 for run 20261105-152345-feature-extend-arrowhead-size (Tier 2b, trigger 1: React + TypeScript has no shipped adapter). Scope was narrowed to the kinds that matter for an arrowhead-size property on linear elements.

## Language & runtime
TypeScript 5.9 with `strict: true`, `target`/`module` ESNext, `moduleResolution: "bundler"` and `jsx: "react-jsx"` (root `tsconfig.json`). The code is ESM only. Packages build with esbuild and the app with Vite 5. Tests use Vitest 3 in jsdom, with globals (`describe`, `it`, `expect`, `vi`) turned on and `setupTests.ts` as the setup file. Yarn 1 workspaces. Node >= 18.

## Framework
React 19 component library (`@excalidraw/excalidraw`) with Jotai for some state, built on framework-free packages `@excalidraw/element`, `@excalidraw/common` and `@excalidraw/math`. The editor uses its own **action system**: `register({...})` actions that a `ActionManager` dispatches. There is no router and no server.

## Conventions detected

### File naming
- camelCase `.ts` modules for logic: `packages/element/src/newElement.ts`, `packages/element/src/bounds.ts`, `packages/excalidraw/data/restore.ts`, `packages/excalidraw/components/shapeActionPredicates.ts`.
- `action<Name>.tsx` for action files: `packages/excalidraw/actions/actionProperties.tsx`. Each action is exported as `actionChange<Prop>`.
- PascalCase `.tsx` for components: `components/IconPicker.tsx`, `components/RadioSelection.tsx`.
- Tests are named `<topic>.test.ts(x)` and live in `packages/<pkg>/tests/`. Some also sit next to the code, for example `packages/element/src/__tests__/transform.test.ts` and `packages/excalidraw/data/library.test.ts`.

### Imports (ESLint `import/order`, enforced by `yarn test:code` with `--max-warnings=0`)
Groups go builtin, external, `@excalidraw/**` (placed after external), parent, sibling, then `type` imports last. There is a **blank line between groups and between sub-groups**. Type-only imports use `import type`. Cross-package imports always go through the alias (`@excalidraw/element`, `@excalidraw/common`, `@excalidraw/element/types`), never relative paths across packages. Example from `packages/element/src/newElement.ts`:
```ts
import {
  DEFAULT_ELEMENT_PROPS,
  ...
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import type { MarkOptional, Merge } from "@excalidraw/common/utility-types";

import {
  getElementAbsoluteCoords,
  getResizedElementAbsoluteCoords,
} from "./bounds";
import { newElementWith } from "./mutateElement";
```

### Element types (packages/element/src/types.ts, 496 lines, read in full where relevant)
Elements are `Readonly<{...}>` intersections over `_ExcalidrawElementBase`. Linear-element props are declared once on `ExcalidrawLinearElement`, and arrow, line and elbow types extend it (`Merge<>` is used for elbow). Arrowhead kinds are string-literal unions.
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
Base props such as `strokeWidth: number` and `roundness: null | {...}` sit on `_ExcalidrawElementBase`. Optional extension data uses `customData?`. A new persisted element prop is a schema change: it touches types, creation, restore, and the snapshot files. `ElementConstructorOpts` (newElement.ts:63) is a `MarkOptional<Omit<ExcalidrawGenericElement, ...>, ...>` list of base props that callers may leave out.

### Element creation (packages/element/src/newElement.ts — 711 lines, so only the 615-711 excerpt was read)
Factories spread `_newElementBase<T>(type, opts)` and then set type-specific fields with explicit defaults (`opts.x || null`, `opts.x ?? default`):
```ts
  return {
    ..._newElementBase<ExcalidrawArrowElement>(opts.type, opts),
    points: opts.points || [],
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead || null,
    endArrowhead: opts.endArrowhead || null,
    elbowed: false,
  } as T extends true ? NonDeleted<ExcalidrawElbowArrowElement> : NonDeleted<ExcalidrawArrowElement>;
```
`newLinearElement` (line 623) hard-codes `startArrowhead: null, endArrowhead: null`. `newArrowElement` (line 652) takes optional arrowhead opts, and its elbowed and non-elbowed branches each build the object separately. **Both branches must be updated.**

### Arrowhead geometry (packages/element/src/bounds.ts:727)
The size is a fixed pixel value per arrowhead kind. Angles shrink as the size goes down. Any new size or scale property would plug in here:
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
`getArrowheadAngle(arrowhead, size = getArrowheadSize(arrowhead))` already accepts a smaller drawn size. Callers in bounds.ts call `getArrowheadSize(...)` directly, for example the cardinality and crow's-foot helpers around lines 868-885.

### Restore / migration (packages/excalidraw/data/restore.ts — 1429 lines, so only excerpts 450-489 and 620-720 were read)
`restoreElementWithProperties(element, extra)` fills base props with defaults from `DEFAULT_ELEMENT_PROPS`, using `||` for falsy-invalid values and `??` for nullable ones. Per-type `case` blocks pass the type-specific props through `extra`, and the `Pick<T, keyof K>` typing rejects extra properties. Lines go through `case "line": case "draw":` and arrows through `case "arrow":`:
```ts
    case "arrow": {
      const startArrowhead = normalizeArrowhead(element.startArrowhead);
      const endArrowhead =
        element.endArrowhead === undefined
          ? "arrow"
          : normalizeArrowhead(element.endArrowhead);
      ...
      const base = {
        type: element.type,
        startBinding: repairBinding(...),
        endBinding: repairBinding(...),
        startArrowhead,
        endArrowhead,
        points,
        ...
```
A new linear-element prop must be added in **both** the line block (~line 650) and the arrow `base` (~line 690). The elbow branch spreads `base`. Legacy values are mapped by `normalizeArrowhead` (exported from `@excalidraw/element`), and `@deprecated` legacy fields are declared on the generic `T` in `restoreElementWithProperties`.

### Properties-panel actions (packages/excalidraw/actions/actionProperties.tsx — 2322 lines, so only excerpts 194-252, 700-826 and 1958-2075 were read)
Pattern: `register<ValueType>({ name, label, trackEvent: false, perform, PanelComponent })`. `perform` maps the selection through `changeProperty(elements, appState, el => newElementWith(el, {...}))`, sets the matching `currentItem*` appState default, and returns `captureUpdate: CaptureUpdateAction.IMMEDIATELY`. `PanelComponent` renders a `<fieldset><legend>{t("labels.x")}</legend>` around `RadioSelection` or `IconPicker`, whose value comes from `getFormValue(elements, app, getValue, elementPredicate, defaultValue)`.
```ts
export const actionChangeStrokeWidth = register<StrokeWidthKey>({
  name: "changeStrokeWidth",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform: (elements, appState, value) => {
    invariant(value, "actionChangeStrokeWidth: value must be defined");
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: getStrokeWidthForElement(el, value),
        }),
      ),
      appState: { ...appState, currentItemStrokeWidthKey: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <div className="buttonList">
        <RadioSelection<StrokeWidthKey>
          group="stroke-width"
          options={[{ value: "thin", text: t("labels.thin"), icon: StrokeWidthBaseIcon, testId: "strokeWidth-thin" }, ...]}
          value={getFormValue(elements, app, getStrokeWidthKeyForElement,
            (element) => element.hasOwnProperty("strokeWidth"),
            (hasSelection) => hasSelection ? null : appState.currentItemStrokeWidthKey)}
          onChange={(value) => updateData(value)}
        />
```
`actionChangeArrowhead` (line 1960) takes `{ position: "start" | "end"; type: Arrowhead }`. It applies only to `isLinearElement(el)`, re-routes elbow arrows with `updateElbowArrowRoute`, and writes `currentItemStartArrowhead`/`currentItemEndArrowhead`. `actionChangeArrowProperties` (line 2058) is a container that calls `renderAction("changeArrowhead")` and `renderAction("changeArrowType")`. That is where a new arrowhead sub-control would render.

Wiring a new action takes these edits:
1. Add the name to the `ActionName` union in `packages/excalidraw/actions/types.ts` (for example `| "changeArrowhead"` at line 74).
2. Re-export it from `actions/index.ts`.
3. Add an `AppState` field in `packages/excalidraw/types.ts` (for example `currentItemEndArrowhead: Arrowhead | null` at line 465).
4. Add its default in `appState.ts` `getDefaultAppState` (line 39) and its storage config in `APP_STATE_STORAGE_CONF` (line 175: `{ browser: true, export: false, server: false }`).
5. Add i18n strings to `packages/excalidraw/locales/en.json` under `labels` (for example `"arrowheads": "Arrowheads"`). Only `en.json` is edited by hand, since the other locales come from Crowdin.
6. Make the panel layouts show the control through a predicate (next section).

New-element creation reads the `currentItem*` state in `components/App.tsx` (~line 8626, the arrowhead defaults), `ConvertElementTypePopup.tsx` (~900) and `packages/element/src/convertToShape.ts` (~651).

### Panel visibility predicates (packages/excalidraw/components/shapeActionPredicates.ts, 191 lines, read in full)
`getShapeActionPredicates(appState, targetElements, elementsMap, app)` is the single source of truth for which controls show, across the full, compact and mobile layouts. A control is relevant when the predicate holds for the active tool **or** for any selected element:
```ts
  const forToolOrSelection = (
    predicate: (type: ElementOrToolType) => boolean,
  ) =>
    predicate(activeToolType) ||
    targetElements.some((element) => predicate(element.type));
  ...
    arrowType: forToolOrSelection(toolIsArrow),
    arrowheads: forToolOrSelection(canHaveArrowheads),
```
Type predicates live in `@excalidraw/element` or `../scene`. For example, `canHaveArrowheads = (type: ElementOrToolType) => type === "arrow"` is in `packages/element/src/comparisons.ts:68`. Note that this excludes `line`, even though `ExcalidrawLinearElement` carries arrowhead fields. Each flag carries a one-line `//` or `/** */` comment.

### Test shape
Vitest globals with no imports needed for `describe`/`it`/`expect`/`vi`, although some files import `vi` explicitly. Element tests build elements through the **excalidraw test helper**, even inside `packages/element/tests`, and drive them with `it.each`:
```ts
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
...
describe("arrowhead shapes", () => {
  it.each(["triangle", "diamond_outline", "circle"] as const)(
    "fills %s arrowheads along their outline",
    (arrowhead) => {
      const arrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        endArrowhead: arrowhead,
        roughness: 2,
      });
      const [, head] = ShapeCache.generateElementShape(arrow, null);
```
(from `packages/element/tests/shape.test.ts`. `packages/element/tests/newElement.test.ts` uses the same style with `vi.spyOn(common, ...)` and `toMatchObject`.)

Restore tests (`packages/excalidraw/tests/data/restore.test.ts`, 1659 lines, so only excerpts were read) cast raw input with `as any` and assert on the restored value:
```ts
  it("should normalize legacy crowfoot arrowheads on restore", () => {
    const arrowElement = API.createElement({ type: "arrow" });
    const restoredArrow = restore.restoreElements(
      [{ ...arrowElement, startArrowhead: "crowfoot_one", endArrowhead: "crowfoot_one_or_many" } as any],
      null,
    )[0] as ExcalidrawLinearElement;
    expect(restoredArrow.startArrowhead).toBe("cardinality_one");
```
Editor and action tests (`packages/excalidraw/tests/wrap.test.tsx`) render the full component and dispatch actions through the global `h`:
```ts
const { h } = window;
beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});
...
API.setSelectedElements([getElement("note")]);
act(() => {
  h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
});
```
Helpers: `render` and `act` from `./test-utils`, `Keyboard`/`Pointer` from `./helpers/ui`, and `API.setElements`, `API.setSelectedElements`, `API.updateElement`, `API.getSelectedElement` and `API.executeAction(action)` (the last one takes no value) from `./helpers/api`. `API.createElement` (api.ts:167) has typed per-type opts. For arrows it explicitly copies `startBinding`, `endBinding`, `startArrowhead` and `endArrowhead` from `rest` after construction (api.ts:416-421). **A new linear prop needs both a typed opt there and a copy there**, or tests can't set it.

Snapshots: `packages/excalidraw/tests/__snapshots__/*.snap` and `tests/data/__snapshots__/restore.test.ts.snap` serialize whole elements. Adding a persisted element prop changes them, so they must be regenerated on purpose (`yarn test:update`) and the diff reviewed.

### Config
Build-time env goes through `import.meta.env.VITE_APP_*` in the app. The library has no runtime config module. Editor defaults live in `DEFAULT_ELEMENT_PROPS` and other constants in `@excalidraw/common`, and per-session defaults in `getDefaultAppState()` (`packages/excalidraw/appState.ts`).

### Data layer
No ORM or database. The scene is an in-memory array of immutable element objects. Updates use `newElementWith(el, partial)` (returns a copy and bumps the version) or `mutateElement(el, elementsMap, partial)`. Persistence is JSON through `serializeAsJSON` / `restoreElements` (`packages/excalidraw/data/json.ts`, `data/restore.ts`). In the app, collaboration goes over a Firebase/socket backend.

### Framework-owned wiring
Actions are registered by `register()` in `actions/register.ts` and appear in the `ActionName` union in `actions/types.ts`. Panels call `renderAction("<name>")`. Visibility comes from `getShapeActionPredicates` flags. There is no routing.

## AGENTS.md rules (repo-mandated)
1. For new DOM or browser API use, use `app.ownerDocument` and `app.ownerWindow` instead of globals. Without `app`, take them from the mounted node's `ownerDocument` and its `defaultView`.
2. When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

## Sample files inspected
- packages/element/src/types.ts (kind: model/types; read lines 1-90 and 335-404)
- packages/element/src/newElement.ts (kind: factory; 711 lines, over the bound, excerpts 1-30, 63-87 and 615-711)
- packages/element/src/bounds.ts (kind: geometry; excerpt 720-776)
- packages/excalidraw/data/restore.ts (kind: migration; 1429 lines, over the bound, excerpts 450-489 and 620-720)
- packages/excalidraw/actions/actionProperties.tsx (kind: action/handler; 2322 lines, over the bound, excerpts 194-252, 700-826 and 1958-2077)
- packages/excalidraw/components/shapeActionPredicates.ts (kind: predicate; full)
- packages/element/tests/shape.test.ts (kind: test; full)
- packages/element/tests/newElement.test.ts (kind: test; full)
- packages/excalidraw/tests/data/restore.test.ts (kind: test; 1659 lines, over the bound, imports plus arrowhead excerpts)
- packages/excalidraw/tests/wrap.test.tsx (kind: test; 569 lines, over the bound, imports, setup and one action excerpt)
- packages/excalidraw/tests/helpers/api.ts (kind: test helper; 580 lines, over the bound, excerpts 400-432 and 570-580 plus a signature grep)
- Greps only: appState.ts, types.ts, actions/types.ts, locales/en.json, comparisons.ts, tsconfig.json, .eslintrc.json

## Notes for downstream codegen
- A new persisted linear-element prop touches these places:
  1. The `ExcalidrawLinearElement` type.
  2. `newLinearElement`, and **both** branches of `newArrowElement`.
  3. The `line`/`draw` **and** `arrow` blocks in `restore.ts`, with a default for old files where the field is missing (follow the `endArrowhead === undefined ? "arrow" : ...` pattern).
  4. `API.createElement` opts and the copy after construction.
  5. Snapshot regeneration.
  6. Any place that clones or converts linear elements (`ConvertElementTypePopup.tsx`, `convertToShape.ts`, `App.tsx`, which reads `currentItem*Arrowhead`).
- If the size only needs to be a scale on top of the current per-kind pixel sizes, `getArrowheadSize` in `packages/element/src/bounds.ts` is the single place to multiply. `getArrowheadAngle` already handles smaller sizes. Bounds, hit-testing and export all go through bounds.ts. Grep for other `getArrowheadSize(` callers (for example `src/__tests__/transform.test.ts:1554`).
- New panel controls follow the `actionChangeStrokeWidth` shape (`RadioSelection` with `testId`s) and get rendered inside `actionChangeArrowProperties` next to `changeArrowhead`. Gate them with a `shapeActionPredicates` flag built from `forToolOrSelection(canHaveArrowheads)`, or a similar predicate in `packages/element/src/comparisons.ts`.
- Each new `currentItem*` appState key needs a `types.ts` field, a `getDefaultAppState` default and an `APP_STATE_STORAGE_CONF` entry.
- New label strings go in `locales/en.json` only.
- Use `invariant(value, "<actionName>: value must be defined")` in `perform`. Use `newElementWith` (not mutation) inside `changeProperty`.
- Follow the `import/order` grouping with blank lines and `import type`. Lint fails on any warning.
- Verify with `yarn test:app --watch=false packages/element packages/excalidraw`, then `yarn test:typecheck` and `yarn test:code`. Use `yarn test:update` only to regenerate snapshots on purpose.
