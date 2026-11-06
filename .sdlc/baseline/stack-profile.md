# Stack profile: learned from a repo scan

Built 2026-11-06 for run `20261106-103142-feature-extend-lasso-selection-mode` (plugin mmo 0.10.1). Trigger: the primary stack is a React/TypeScript library monorepo with no matching shipped adapter (only generic, nest, python ship). This profile wins over `generic.md` where they conflict.

## Language & runtime
TypeScript 5.9.3, `strict: true`, `target`/`module` ESNext, `moduleResolution: "bundler"`, `isolatedModules`, `jsx: react-jsx`, `noEmit` (tsc is a typecheck only, run with `yarn test:typecheck`). Node >= 18, Yarn 1.22 workspaces. ESM everywhere. Packages build with esbuild and the app builds with Vite 5.

## Framework
React 19 component library (`@excalidraw/excalidraw`) plus the app shell (`excalidraw-app`). State is a monolithic class component, `packages/excalidraw/components/App.tsx` (~11k lines, split into `App.*.ts` helpers), which holds `this.state: AppState`. Jotai is used through wrapper modules only: ESLint bans importing `jotai` directly, so use `editor-jotai` / `app-jotai`. There is no backend framework.

## Conventions detected

### File naming
- React components: PascalCase `.tsx` (`components/App.tsx`, `components/main-menu/DefaultItems.tsx`), with a sibling `.scss` where needed.
- Non-component modules: camelCase `.ts` (`appState.ts`, `animatedTrail.ts`) or feature folders with `index.ts` + `utils.ts` (`lasso/index.ts`, `lasso/utils.ts`).
- Actions: `actions/actionXxx.tsx`. Tests: `*.test.ts(x)` under `packages/excalidraw/tests/` (feature-named, e.g. `lasso.test.tsx`, `selection.test.tsx`) and `packages/element/tests/`.

### Import shape (enforced by ESLint, `yarn test:code` runs with `--max-warnings=0`)
- `import/order` groups builtin, then external, then `@excalidraw/**`, then parent, sibling, type, **with a blank line between every import statement** (`newlines-between: always-and-inside-groups`).
- `@typescript-eslint/consistent-type-imports` with `separate-type-imports`: type-only imports go in their own `import type {...}` statements, placed after the value imports.
- Inside `packages/excalidraw/**` (non-test files), importing from the `@excalidraw/excalidraw` barrel or `../index` is banned; use relative module paths. Cross-package imports go through aliases: `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/common`, `@excalidraw/element/types`, `@excalidraw/math/types`.

Real example (`packages/excalidraw/lasso/utils.ts`):
```ts
import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  computeBoundTextPosition,
  doBoundsIntersect,
  getElementBounds,
  intersectElementWithLineSegment,
} from "@excalidraw/element";

import type { ElementsSegmentsMap, GlobalPoint } from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";
```

### Handler / controller shape (the editor's interaction classes)
Tools are classes that extend `AnimatedTrail` and receive `app: App`. They read `this.app.state` and write through `this.app.setState(prev => ...)` (`packages/excalidraw/lasso/index.ts`):
```ts
export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
  ...
  private updateSelection = () => {
    ...
      const { selectedElementIds } = getLassoSelectedElementIds({
        lassoPath,
        elements: this.app.visibleElements,
        elementsMap: this.app.scene.getNonDeletedElementsMap(),
        elementsSegments: this.elementsSegments,
        intersectedElements: this.intersectedElements,
        enclosedElements: this.enclosedElements,
        simplifyDistance: 5 / this.app.state.zoom.value,
      });
```

### Service shape (pure helpers)
Arrow-function exports that take **one object argument** with an inline-typed shape and return an inline-typed result. Optional knobs use `?:` (`simplifyDistance?: number`). Positional defaults also appear, e.g. `boxSelectionMode: BoxSelectionMode = "contain"` in `packages/element/src/selection.ts#getElementsWithinSelection`. The bounding-box helper uses a string union literal for the mode (`packages/element/src/bounds.ts`):
```ts
export const elementsOverlappingBBox = <T extends ExcalidrawElement>({
  elements, elementsMap, bounds, type, excludeElementsInFrames, shouldIgnoreElementFromSelection,
}: {
  elements: readonly T[];
  elementsMap?: ElementsMap;
  bounds: Bounds | ExcalidrawElement;
  /**
   * - overlap: elements overlapping or inside bounds
   * - contain: elements inside bounds
   **/
  type: "contain" | "overlap";
  ...
```
The preferred style (from `.github/copilot-instructions.md`) is performance-first: avoid allocation, use `const`/`readonly`, `?.`/`??`, and do a cheap AABB pre-check (`doBoundsIntersect`) before exact geometry.

### Test shape
Vitest with globals (`describe/it/expect/beforeEach`, `vi` imported from `"vitest"`), jsdom, `setupTests.ts`. Integration-style: render `<Excalidraw/>` with `render` from `./test-utils`, drive the scene through the `window.h` harness, the `API` helpers (`tests/helpers/api.ts`) and `Pointer`/`Keyboard`/`UI` (`tests/helpers/ui.ts`), and assert with `assertSelectedElements(...)`.
```tsx
describe("box-selection overlap mode", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{ appState: { boxSelectionMode: "overlap" } }}
      />,
    );
  });

  it("should select an element when the selection box partially overlaps it", () => {
    const rect1 = API.createElement({ type: "rectangle", x: 0, y: 0, width: 50, height: 50, ... });
    API.setElements([rect1]);
    boxSelect(25, -20, 75, 70);
    assertSelectedElements([rect1.id]);
  });
```
`lasso.test.tsx` uses a local `updatePath(startPoint, points)` helper. It drives `h.app.lassoTrail.startPath/addPointToPath`, calls `getLassoSelectedElementIds({...})` directly with `intersectedElements: new Set(), enclosedElements: new Set()`, then `selectElementsFromIds`, and asserts on `getSelectedElements(h.elements, h.state)`. Its fixtures are large inline `ExcalidrawElement` literals. Snapshots live in `tests/__snapshots__/*.snap`; update them with `yarn test:update`.

### Config
AppState defaults are in `packages/excalidraw/appState.ts#getDefaultAppState` (`boxSelectionMode: "contain"`), with a storage map in the same file (`boxSelectionMode: { browser: true, export: false, server: false }`). Types are in `packages/excalidraw/types.ts` (`export type BoxSelectionMode = "contain" | "overlap";`). Build-time env comes from Vite `import.meta.env.VITE_APP_*`, set in the tracked `.env.development` / `.env.production`.

### Data layer
No ORM. The scene graph lives in memory: `this.app.scene` (`getNonDeletedElements()`, `getNonDeletedElementsMap()`), with immutable `ExcalidrawElement` records keyed by id. `ElementsMap` is a `Map<id, element>`, built with `arrayToMap` from `@excalidraw/common`.

### Framework-owned wiring
- Actions register with `register({...})` from `actions/register` (e.g. `actions/actionToggleGridMode.tsx`: `name`, `label`, `perform(elements, appState) => ({ appState, captureUpdate: CaptureUpdateAction.EVENTUALLY })`, `checked`).
- Preferences menu items live in `components/main-menu/DefaultItems.tsx` (e.g. `PreferencesBoxSelectionModeItem`, a `DropdownMenuItemContentRadio<"contain" | "overlap">` that calls `setAppState({ boxSelectionMode })`), attached as `Preferences.BoxSelectionMode`.
- Pointer handling and tool dispatch happen in `components/App.tsx`. Box select calls `getElementsWithinSelection(..., false, this.state.boxSelectionMode)` (~line 11311). The lasso is driven through `this.lassoTrail.startPath/addPointToPath/endPath`.
- UI strings go in `packages/excalidraw/locales/en.json` (other locales are Crowdin-managed; do not hand-edit them).

## Sample files inspected
- packages/excalidraw/lasso/index.ts (kind: tool/handler)
- packages/excalidraw/lasso/utils.ts (kind: service/pure helper)
- packages/element/src/selection.ts (kind: service)
- packages/element/src/bounds.ts (kind: service)
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: wiring/action)
- packages/excalidraw/components/main-menu/DefaultItems.tsx (kind: UI component)
- packages/excalidraw/components/App.tsx (kind: entry/wiring, excerpts only; file > 500 lines)
- packages/excalidraw/appState.ts, packages/excalidraw/types.ts (kind: config/types)
- packages/excalidraw/tests/lasso.test.tsx, packages/excalidraw/tests/selection.test.tsx, packages/excalidraw/tests/test-utils.ts, packages/element/tests/bounds.test.ts (kind: test; the large test files were read only in sections)
- .eslintrc.json, tsconfig.json, vitest.config.mts (kind: tooling)

## Notes for downstream codegen
- Keep the import blank-line and separate `import type` discipline exactly, or `yarn test:code` fails (zero warnings allowed).
- Never import `@excalidraw/excalidraw` or `../index` from non-test files under `packages/excalidraw/`.
- Reuse the existing `BoxSelectionMode` type (`"contain" | "overlap"`). Do not invent a `"wrap"` literal. Thread new options through the object-arg helper with a backward-compatible default (`"contain"`-like behaviour, or current behaviour if that differs), so existing call sites and `lasso.test.tsx` calls that omit the field still compile.
- Prefer allocation-free loops, and keep the AABB fast path in front of exact geometry.
- Tests: add `describe` blocks that render `<Excalidraw initialData={{ appState: { ... } }} />` and assert with `assertSelectedElements`. Run with `yarn test:app --watch=false <files>`. Expect `yarn test:update` to rewrite `.snap` files.
- Run prettier (`yarn fix`) to match `@excalidraw/prettier-config` (trailing commas, 80 columns, double quotes).
