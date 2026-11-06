# Stack profile — learned from repo scan

## Language & runtime
TypeScript 5.9 with `strict: true`, `module`/`target` ESNext and `jsx: react-jsx` (root tsconfig.json). Node >= 18, yarn 1.22 workspaces. ESM imports throughout. Packages are bundled with esbuild (scripts/buildBase.js, buildPackage.js) and the app with Vite 5. Type check with `yarn test:typecheck` (`tsc`, whole repo).

## Framework
React component library (`@excalidraw/excalidraw`), with jotai for editor atoms, roughjs for hand-drawn shapes and radix-ui for popovers. Editor features are built on an in-house **action system**: `register({...})` in packages/excalidraw/actions/register.ts.

## Conventions detected

### File naming
- camelCase `.ts`/`.tsx`: `actionProperties.tsx`, `newElement.ts`, `elbowArrow.ts`, `shapeActionPredicates.ts`. Components are PascalCase: `Actions.tsx`, `ConvertElementTypePopup.tsx`.
- Tests are `*.test.ts(x)`, either beside the source (`actions/actionProperties.test.tsx`), under `packages/*/tests/`, or under `src/__tests__/`. Snapshots live in `__snapshots__/*.snap`.

### Imports
Cross-package imports use the aliases `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math` (resolved via vitest.config.mts and tsconfig paths). Type imports sit in separate `import type` blocks after the value imports, and groups are separated by blank lines (enforced by eslint import/order).

### Handler / controller shape (actions)
```ts
export const actionChangeStrokeWidth = register<StrokeWidthKey>({
  name: "changeStrokeWidth",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform: (elements, appState, value) => {
    invariant(value, "actionChangeStrokeWidth: value must be defined");
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, { strokeWidth: getStrokeWidthForElement(el, value) }),
      ),
      appState: { ...appState, currentItemStrokeWidthKey: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <div className="buttonList">
        <RadioSelection<StrokeWidthKey> group="stroke-width" options={[{ value: "thin", text: t("labels.thin"), icon: StrokeWidthBaseIcon, testId: "strokeWidth-thin" }, ...]}
          value={getFormValue(elements, app, getKeyForElement, (el) => predicate(el), (hasSelection) => hasSelection ? null : appState.currentItemStrokeWidthKey)}
          onChange={(value) => updateData(value)} />
```
(packages/excalidraw/actions/actionProperties.tsx:716-772)

Wiring a new action takes four steps: add the name to the `ActionName` union (actions/types.ts:65-80), export it from actions/index.ts, render it in components/Actions.tsx through a predicate from components/shapeActionPredicates.ts, and, if it should appear in compact mode, render it inside `actionChangeArrowProperties` (actionProperties.tsx:2058).

### Element model
Elements are immutable `Readonly<{}>` types (packages/element/src/types.ts). Updates go through `newElementWith(el, {...})`, which bumps the version and so invalidates `ShapeCache`. Defaults are set in `new*Element` factories (packages/element/src/newElement.ts). Persisted fields need a restore path in packages/excalidraw/data/restore.ts, where `restoreElementWithProperties` forces every type-specific field to be supplied.

### AppState
A new `currentItem*` key needs four things: its type in packages/excalidraw/types.ts (AppState), a default in `getDefaultAppState` (appState.ts:30+), a storage-config entry `{ browser, export, server }` (appState.ts:165+, exhaustive), and use at the creation sites (App.tsx:8621+, App.drawshape.ts, ConvertElementTypePopup.tsx, convertToShape.ts).

### Test shape
Vitest with jsdom and @testing-library/react. Globals `describe`/`it`/`expect` are available, and `vi` is imported from vitest when needed.
```tsx
describe("element locking", () => {
  beforeEach(async () => { await render(<Excalidraw />); });
  it("should create new elements with stroke width by element type", () => {
    API.setAppState({ currentItemStrokeWidthKey: "bold" });
    const rect = API.createElement({ type: "rectangle" });
    expect(rect.strokeWidth).toBe(STROKE_WIDTH.bold);
  });
});
```
(packages/excalidraw/actions/actionProperties.test.tsx). Helpers are `API` (tests/helpers/api.ts), `UI` (tests/helpers/ui.ts) and `render` (tests/test-utils). Pure geometry tests call functions directly, e.g. element/tests/bounds.test.ts:226+, which uses `API.createElement` plus `ShapeCache.generateElementShape(arrow, null)`.

### Config
Vite env vars (`import.meta.env.VITE_*`) come from the committed `.env.development` and `.env.production`. Editor constants live in packages/common/src/constants.ts (for example `STROKE_WIDTH`, `STROKE_WIDTH_KEYS` and `getStrokeWidthByKey` at 477-512).

### Data layer
There is no ORM. Scene JSON is persisted in `.excalidraw` files and localStorage, and migrated on load by `restoreElements`/`restoreAppState` (packages/excalidraw/data/restore.ts). Legacy values are normalized with small pure functions (e.g. `normalizeArrowhead` in packages/element/src/arrowheads.ts).

### Framework-owned wiring
Actions self-register on module import via `register()`. Locale strings go in packages/excalidraw/locales/en.json under `labels.*` and are read with `t("labels.x")`. Only en.json is edited by hand; the other 58 locales come from Crowdin.

## Sample files inspected
- packages/excalidraw/actions/actionProperties.tsx (kind: controller/action)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/components/Actions.tsx, shapeActionPredicates.ts (kind: UI wiring)
- packages/element/src/newElement.ts (kind: factory/service)
- packages/element/src/bounds.ts, shape.ts (kind: geometry/render service)
- packages/element/src/types.ts (kind: model)
- packages/excalidraw/data/restore.ts (kind: migration)
- packages/excalidraw/appState.ts (kind: config/state)
- packages/excalidraw/actions/actionProperties.test.tsx, element/tests/bounds.test.ts, element/tests/shape.test.ts, tests/data/restore.test.ts (kind: tests)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` rather than `Omit<>&` (AGENTS.md).
- For new DOM APIs use `app.ownerDocument`/`app.ownerWindow` (AGENTS.md).
- Prefer `readonly`/`const`, `?.` and `??`, and avoid allocation on hot paths such as shape generation (copilot-instructions).
- Comments are lowercase, short and explain why, as in the comments in bounds.ts.
- Mutating element props go through `newElementWith`. Never mutate in place except in test helpers.
- Adding an element field or appState key churns many snapshots. Run `yarn test:update` and check the diff.
- Formatting is Prettier (@excalidraw/prettier-config: double quotes, trailing commas). ESLint runs with `--max-warnings=0`.
