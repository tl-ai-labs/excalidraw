# Stack profile: learned from repo scan

Built 2026-11-06 for run 20261106-120000-feature-new-drawing-pages at HEAD 14bb42ed. Trigger: the primary stack (React + TypeScript monorepo) has no pre-authored adapter.

## Language & runtime
- TypeScript 5.9 with `strict: true`, `isolatedModules` and `moduleResolution: bundler`. Uses `jsx: react-jsx`, ESM only and `noEmit` (tsc is a typecheck gate only).
- Node >= 18. React 19.
- Yarn 1 workspaces.
- Packages are built with esbuild (`scripts/buildBase.js` / `buildPackage.js`). The app is built with Vite 5.

## Framework
No server framework. The project is a React component library (`@excalidraw/excalidraw`) plus a Vite SPA (`excalidraw-app`).
- State lives in a big class component, `App` (`packages/excalidraw/components/App.tsx`, about 11.5k lines). It holds `this.state: AppState` and `this.scene: Scene`.
- jotai atoms hold side state. In the editor, import them from `packages/excalidraw/editor-jotai`, not from bare jotai.
- Commands are written as **actions** in the action registry.
- Library UI slots are filled through **tunnels** (tunnel-rat).

## Conventions detected

### File naming
- React components use PascalCase `.tsx` with a sibling `.scss`, for example `components/footer/Footer.tsx`, `components/LayerUI.tsx` + `LayerUI.scss` and `components/Sidebar/SidebarTabs.tsx`.
- Non-component modules use camelCase `.ts`: `appState.ts`, `data/restore.ts`, `data/reconcile.ts`, `excalidraw-app/data/tabSync.ts`.
- Actions are `actions/action<Name>.ts(x)`, for example `actionCanvas.tsx` and `actionZindex.tsx`.
- Tests are `*.test.ts(x)`. They sit either beside the source (`actions/actionFlip.test.tsx`, `components/Sidebar/Sidebar.test.tsx`) or under `tests/` (`packages/excalidraw/tests/data/restore.test.ts`).

### Imports
Imports come in groups, in this order:
1. External and `@excalidraw/*` packages.
2. Relative imports.
3. `import type` lines at the end.

eslint enforces this (eslint-plugin-import).

Cross-package code always imports through aliases, for example `@excalidraw/common`, `@excalidraw/element` and `@excalidraw/element/types`. Inside a package, use relative paths.

```ts
import { CaptureUpdateAction } from "@excalidraw/element";
import type { Bounds } from "@excalidraw/common";

import { getDefaultAppState } from "../appState";
import { t } from "../i18n";
import { register } from "./register";

import type { AppState } from "../types";
```

### Component shape (functional, typed inline props)
```tsx
const Footer = ({
  appState,
  actionManager,
  ...
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  ...
}) => {
  const { FooterCenterTunnel, WelcomeScreenHelpHintTunnel } = useTunnels();
  const app = useApp();
  return (
    <footer role="contentinfo" className="layer-ui__wrapper__footer App-menu App-menu_bottom">
      ...
      <FooterCenterTunnel.Out />
```
- `clsx` builds class names.
- CSS classes follow BEM-ish `layer-ui__wrapper__footer-left`.
- `useApp()`, `useExcalidrawAppState()` and `useTunnels()` come from `components/App` and the `context/` folder.
- Set `displayName` on exported components.

### Action shape (the editor's "service" layer)
```ts
export const actionChangeViewBackgroundColor = register<Partial<AppState>>({
  name: "changeViewBackgroundColor",
  label: "labels.canvasBackground",
  trackEvent: false,
  predicate: (elements, appState, props, app) => !appState.viewModeEnabled,
  perform: (_, appState, value) => ({
    appState: { ...appState, ...value },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY, // or EVENTUALLY / NEVER
  }),
  PanelComponent: ...
});
```
- Each action name must be added to the `ActionName` union in `actions/types.ts`.
- Each action is re-exported from `actions/index.ts`.
- `captureUpdate` controls undo/redo (Store/History).

### Data layer
No ORM. The data layer is immutable element arrays plus the `Scene` class.
- `Scene.replaceAllElements(elements)` rebuilds `elementsMap`, `nonDeletedElementsMap` and the frame caches, then calls `triggerUpdate()`.
- Elements are `Readonly` and change only through `newElementWith`, `mutateElement` or `scene.mutateElement`.
- Each change bumps `version`/`versionNonce`. Fractional `index` gives the order (`syncInvalidIndices`, `syncMovedIndices`).
- Persistence:
  - JSON: `serializeAsJSON(elements, appState, files, "local" | "database")`, giving `{type, version, source, elements, appState, files}`.
  - Restore: `restoreElements` / `restoreAppState` in `data/restore.ts`. Every field read from disk goes through restore with a default.
  - App local storage: localStorage keys `excalidraw` (elements) and `excalidraw-state` (appState), plus IndexedDB for files (`LocalData`).
  - Collab: Firebase plus socket.io. Only elements are synced, reconciled by version in `reconcileElements`.
- AppState keys need an entry in the `APP_STATE_STORAGE_CONF` table in `appState.ts` (`{browser, export, server}`). That table decides what is saved to localStorage, file export and the backend.

### Config
- Vite `import.meta.env.VITE_APP_*` variables come from the tracked `.env.development` / `.env.production`. These files are off-limits.
- `vitest.config.mts` maps the `@excalidraw/*` aliases.

### Test shape
- Vitest with globals: `describe` / `it` / `expect`, plus `vi` from "vitest".
- The environment is jsdom. Use `render`, `act` and `waitFor` from `packages/excalidraw/tests/test-utils`, and `API` from `tests/helpers/api`. `Keyboard`, `Pointer` and `UI` come from `tests/helpers/ui`.
- Editor state is reached through the global `window.h` (`h.elements`, `h.state`, `h.app`).

```ts
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";
import ExcalidrawApp from "../App";
const { h } = window;
vi.mock("../../excalidraw-app/data/firebase.ts", () => ({ loadFromFirebase: async () => null, ... }));
vi.mock("socket.io-client", () => ({ default: () => ({ on(){}, emit(){}, ... }) }));
```

For pure functions, write plain data-in/data-out tests, as in `tests/viewport.test.ts`:
```ts
describe("scrollBoundsIntoView", () => {
  it("should leave bounds that are in view already", () => {
    expect(scrollBoundsIntoView({ bounds: [100,100,200,200], appState: appState() })).toBe(null);
  });
});
```

Snapshot tests (`toMatchSnapshot`) are common in `packages/excalidraw/tests/__snapshots__`. AppState changes show up there.

### Framework-owned wiring
- **New UI in the editor chrome:** mount it in `components/LayerUI.tsx` (for example next to `<Footer .../>` around line 657), or add a tunnel in `context/tunnels.ts` (`useInitializeTunnels`) and render `<XTunnel.Out/>` in a slot.
- **Host-app content:** inject it with `<Footer>` children. The app does this in `excalidraw-app/components/AppFooter.tsx`.
- **New command:** create `register({...})` in `actions/`, add it to the `ActionName` union and export it from `actions/index.ts`.
- **New AppState field:**
  1. Add it to `interface AppState` (types.ts).
  2. Add it to `getDefaultAppState`.
  3. Add it to `APP_STATE_STORAGE_CONF`.
  4. Add it to `restoreAppState` if it needs validation.
  5. If the UI reads it, add it to the `UIAppState` omit list.
- **New user-facing strings:** add them to `packages/excalidraw/locales/en.json` and read them with `t("group.key")`.
- **Public API:** export from `packages/excalidraw/index.tsx`. Imperative API methods live in `ExcalidrawImperativeAPI` (types.ts) and are wired in `App.tsx`.

## Sample files inspected
- packages/excalidraw/components/footer/Footer.tsx (kind: component)
- packages/excalidraw/components/LayerUI.tsx (kind: layout, grep only)
- excalidraw-app/components/AppFooter.tsx (kind: host component)
- packages/excalidraw/actions/actionCanvas.tsx (kind: action/service)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/context/tunnels.ts (kind: wiring)
- packages/element/src/Scene.ts (kind: data layer)
- packages/excalidraw/data/json.ts, data/types.ts (kind: serialization)
- excalidraw-app/data/LocalData.ts, localStorage.ts, tabSync.ts (kind: persistence)
- excalidraw-app/collab/Collab.tsx, Portal.tsx, app_constants.ts (kind: collab, grep only)
- excalidraw-app/tests/collab.test.tsx, packages/excalidraw/tests/data/restore.test.ts, packages/excalidraw/tests/viewport.test.ts (kind: test)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Follow AGENTS.md:
  - Use `app.ownerDocument` / `app.ownerWindow`, not `document` / `window`.
  - Use `Merge<>` from `@excalidraw/common/utility-types` instead of `Omit & {...}`.
- Never mutate elements or appState in place. Return new objects. Element edits go through `newElementWith` / `mutateElement` so versions bump. Without the bump, collab reconcile drops the edit.
- `packages/excalidraw` must not import from `excalidraw-app`. The dependency direction is app -> library -> element -> common/math.
- New file-format fields must be optional on import. Restore them with defaults in `data/restore.ts` so old `.excalidraw` files still load. Update `dev-docs/docs/codebase/json-schema.mdx`.
- Collab `getSyncableElements` and `reconcileElements` work on a flat element list. Any per-page split must keep fractional `index` order valid (`syncInvalidIndices`).
- Edit only `locales/en.json`. Other locales come from Crowdin.
- The code must pass `yarn test:typecheck`, `yarn test:code` (eslint, 0 warnings) and prettier.
