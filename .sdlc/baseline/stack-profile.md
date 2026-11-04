# Stack profile: learned from repo scan

Built 2026-11-04 (run 20261104-120000-feature-extend-lasso-wrap-overlap) at HEAD cf212b2f. Sampling was light and focused on editor/selection code.

## Language & runtime
TypeScript 5.9, `strict: true`, `module`/`target` ESNext, `jsx: react-jsx`. ESM throughout. Node >= 18, Yarn 1 workspaces. Packages are built with esbuild and the app with Vite 5. Tests run on Vitest 3 + jsdom + vitest-canvas-mock, with `setupTests.ts` at the root.

## Framework
React 19 component library (`@excalidraw/excalidraw`) plus app (`excalidraw-app`). The editor core is a large class component, `packages/excalidraw/components/App.tsx` (~13k lines). It owns `this.state: AppState` and `this.scene`, and helper objects such as `lassoTrail`. Pure geometry and selection logic lives in `@excalidraw/element` (`packages/element/src`) and `@excalidraw/math`.

## Conventions detected

### File naming
- Components are PascalCase `.tsx` (`components/main-menu/DefaultItems.tsx`). Actions are `actions/actionXxx.tsx`. Feature folders use an `index.ts` + `utils.ts` pair (`lasso/index.ts`, `lasso/utils.ts`). Element logic files are lowercase camelCase (`element/src/selection.ts`, `bounds.ts`).
- Tests use `*.test.ts(x)`, either under `packages/excalidraw/tests/` (`lasso.test.tsx`, `selection.test.tsx`) or under `packages/element/tests/`. Snapshots go in `__snapshots__/`.

### Imports
Cross-package imports use the bare package aliases `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, with `import type` for types (`@excalidraw/element/types`, `@excalidraw/math/types`). Imports inside a package are relative (`../components/App`). Import groups are separated by blank lines, with type imports last.

### Pure helper shape (element package)
```ts
export const getElementsWithinSelection = <T extends ExcalidrawElement>(
  elements: readonly T[],
  selection: ExcalidrawElement,
  elementsMap: ElementsMap,
  excludeElementsInFrames: boolean = true,
  boxSelectionMode: BoxSelectionMode = "contain",
): T[] => { ... return elementsOverlappingBBox({ elements, bounds, elementsMap, type: boxSelectionMode, ... }); };
```
Arrow-function exports and object-param inputs for larger helpers (`getLassoSelectedElementIds(input: {...})`). New options get defaults so existing callers keep compiling.

### Actions (state toggles)
```ts
export const actionToggleGridMode = register({
  name: "gridMode", icon: gridIcon, label: "labels.toggleGrid", viewMode: true,
  perform(elements, appState) {
    return { appState: { ...appState, gridModeEnabled: !this.checked!(appState) },
             captureUpdate: CaptureUpdateAction.EVENTUALLY };
  },
  checked: (appState) => appState.gridModeEnabled,
});
```

### UI preference items
`DefaultItems.tsx` defines small components that use `useUIAppState()` / `useExcalidrawSetAppState()` / `useI18n()`, e.g. `PreferencesBoxSelectionModeItem` rendering `DropdownMenuItemContentRadio<"contain" | "overlap">`. Labels come from `locales/en.json` (`labels.*`). Only en.json is edited by hand; other locales come through Crowdin.

### AppState fields
A new field takes four touches: the type in `types.ts` (`AppState`), the default in `appState.ts#getDefaultAppState`, the storage flags in `appState.ts` `APP_STATE_STORAGE_CONF` (`{ browser, export, server }`), and restore logic in `data/restore.ts` if needed.

### Test shape
```tsx
describe("box-selection overlap mode", () => {
  beforeEach(async () => {
    await render(<Excalidraw initialData={{ appState: { boxSelectionMode: "overlap" } }} />);
  });
  it("should select an element when the selection box partially overlaps it", () => {
    const rect1 = API.createElement({ type: "rectangle", x: 0, y: 0, width: 50, height: 50 });
    API.setElements([rect1]);
    boxSelect(25, -20, 75, 70);
    assertSelectedElements([rect1.id]);
  });
});
```
Helpers live in `packages/excalidraw/tests/helpers/` (`API`, `UI`, `Keyboard`, `Pointer`/`mouse`, `assertSelectedElements`). `window.h` exposes `h.app`, `h.state`, `h.elements` and `h.scene`. State mutations go inside `act(...)`. Lasso UI tests drive `mouse.downAt/moveTo/up` after `h.app.setActiveTool({ type: "lasso" })`. Lasso unit-style tests call `getLassoSelectedElementIds` directly.

### Config
Vite env vars (`import.meta.env.VITE_APP_*`) live in `.env.development`/`.env.production`/`.env.test`. There is no runtime validator.

### Data layer
None (client-side). Elements are held in `Scene`. Persistence goes through localStorage/IndexedDB (app) and `data/restore.ts`.

### Framework-owned wiring
Actions self-register via `register(...)` and are listed in `actions/index.ts`, `actions/types.ts` (ActionName union) and `App.tsx`. Tools such as lasso are instantiated as fields on `App` (`lassoTrail = new LassoTrail(this)`) and driven from pointer handlers.

## Sample files inspected
- packages/excalidraw/lasso/utils.ts (kind: domain helper)
- packages/excalidraw/lasso/index.ts (kind: tool class)
- packages/element/src/selection.ts (kind: domain helper)
- packages/excalidraw/components/main-menu/DefaultItems.tsx (kind: UI component)
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: action)
- packages/excalidraw/appState.ts (kind: config/defaults)
- packages/excalidraw/tests/selection.test.tsx, packages/excalidraw/tests/lasso.test.tsx (kind: test)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Follow `.github/copilot-instructions.md`: avoid allocation in hot paths (lasso runs per pointer move), prefer `const`/readonly, and use `?.`/`??`.
- Thread new options through as defaulted params or object fields, as `boxSelectionMode = "contain"` already is.
- Prettier (`@excalidraw/prettier-config`) uses trailing commas and double quotes. ESLint runs with `--max-warnings=0`, and import order is enforced.
- Do not hand-edit snapshots. If snapshots change, regenerate them with `yarn test:update` deliberately.
