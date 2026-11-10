# Stack profile — learned from repo scan

Built 2026-11-09 for run `20261109-163637-feature-new-pages` at HEAD `14bb42ede`. Tier 2b ran because the
stack is React + TypeScript and no pre-authored adapter matches it (shipped adapters: generic, nest, python).

## Language & runtime
TypeScript 5.9 with `strict: true`, `isolatedModules`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, ESM
throughout (`"module": "ESNext"`). Node >= 18, yarn 1.22 workspaces. React 19 in the app (the library peer range
is React 17/18/19). Packages are built with esbuild (`scripts/buildPackage.js`, `scripts/buildBase.js`) and the app
with Vite 5. Types are checked by a single root `tsc` (`yarn test:typecheck`) over `packages/` and `excalidraw-app/`.

## Framework
React component library (`@excalidraw/excalidraw`) plus a Vite SPA (`excalidraw-app`). The editor is a big
class component `packages/excalidraw/components/App.tsx`, split into `App.<concern>.ts` helper modules
(`App.pan.ts`, `App.selection.ts` and so on). The editor has its own action system (`register()`), and state lives
in three places: `AppState` (editor state), jotai atoms through wrapper modules, and `Scene` (elements).

## Conventions detected

### File naming
- React components use PascalCase `.tsx` with a sibling `.scss` of the same name: `components/DarkModeToggle.tsx`
  plus `components/ToolIcon.scss`, `components/Sidebar/Sidebar.tsx` plus `Sidebar.scss`. Bigger components get a
  PascalCase folder (`components/Sidebar/`, `components/TTDDialog/`) with sub-components and a `common.ts` or
  `types.ts`.
- Actions are camelCase files prefixed `action`, one per concern: `actions/actionToggleZenMode.tsx`,
  `actions/actionDeselect.ts`. Use `.tsx` only when the file contains JSX (a PanelComponent).
- Non-component modules are camelCase `.ts`: `appState.ts`, `editor-jotai.ts`, `data/localStorage.ts`.
- Tests are `<name>.test.ts(x)`, either next to the file (`actions/actionElementLock.test.tsx`) or in a `tests/`
  folder (`packages/excalidraw/tests/*.test.tsx`, `packages/element/tests/*.test.ts`,
  `excalidraw-app/tests/*.test.tsx`). Snapshots go in `__snapshots__/`.

### Imports (enforced by `.eslintrc.json`)
- Import order: external first, then `@excalidraw/*` (as a separate group placed after other externals), then
  parent and sibling imports, then type imports. Groups are separated by blank lines.
- Type-only imports must use `import type` as separate statements (`@typescript-eslint/consistent-type-imports`,
  `fixStyle: separate-type-imports`).
- Do **not** import `jotai` directly. Use `../editor-jotai` inside `packages/excalidraw` and `./app-jotai` inside
  `excalidraw-app`.
- Inside `packages/excalidraw`, do **not** import from the `@excalidraw/excalidraw` barrel or from `..`/`../index`.
  Use direct relative paths to the module. Type imports are allowed. Tests are exempt.
- Cross-package imports use the aliases: `@excalidraw/common`, `@excalidraw/element`,
  `@excalidraw/element/types`, `@excalidraw/common/utility-types`, `@excalidraw/excalidraw/appState` (from the app).

```ts
import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { t } from "../i18n";

import { IconButton } from "./IconButton";

import "./ToolIcon.scss";
```
(from `packages/excalidraw/components/DarkModeToggle.tsx`)

### Handler / controller shape — Actions
In this repo, actions play the role of handlers. Each one is a `register({...})` call exported as a const. The
`name` must be added to the `ActionName` union in `actions/types.ts`, and the action is re-exported from
`actions/index.ts`. `perform` returns `{ appState?, elements?, captureUpdate }`. The `label` is an i18n key.

```ts
export const actionToggleZenMode = register({
  name: "zenMode",
  label: "buttons.zenMode",
  icon: coffeeIcon,
  viewMode: true,
  trackEvent: { category: "canvas", predicate: (appState) => !appState.zenModeEnabled },
  perform(elements, appState) {
    return {
      appState: { ...appState, zenModeEnabled: !this.checked!(appState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.zenModeEnabled,
  keyTest: (event) => !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z,
});
```
(from `packages/excalidraw/actions/actionToggleZenMode.tsx`)

Use `CaptureUpdateAction.IMMEDIATELY` for undoable scene changes and `EVENTUALLY` for UI-only toggles.

### Component shape
Function components, with props typed inline or through an exported `XProps` type. Strings come from `t("...")`.
`data-testid` attributes are used for tests. CSS class names are composed with `clsx`. Shared editor state is read
through `useUIAppState()` and hooks exported from `components/App` (`useExcalidrawSetAppState`,
`useEditorInterface`, `useApp`). Local UI atoms are declared at module scope with `atom(...)` from
`../editor-jotai`:

```ts
import { atom, useSetAtom } from "../../editor-jotai";
import { useEditorInterface, useExcalidrawSetAppState } from "../App";
...
export const isSidebarDockedAtom = atom(false);
```
(from `packages/excalidraw/components/Sidebar/Sidebar.tsx`)

### Service shape — pure domain modules
`packages/element/src/*.ts` and `packages/common/src/*.ts` export plain functions (no classes) that take elements
or appState and return new values. Scene mutation goes through `Scene` (`packages/element/src/Scene.ts`) or
`mutateElement` / `newElementWith`. Data persistence in the app lives in `excalidraw-app/data/*.ts` as exported
functions wrapped in try/catch around `localStorage` / `idb-keyval`, and keys are centralised in
`excalidraw-app/app_constants.ts#STORAGE_KEYS`.

### AppState wiring (adding a new editor state field)
1. Add the field to `AppState` in `packages/excalidraw/types.ts` (and to `UIAppState` / `ExcalidrawProps` if the
   host or UI needs it).
2. Set a default in `getDefaultAppState()` in `packages/excalidraw/appState.ts`.
3. Add an entry to `APP_STATE_STORAGE_CONF` in the same file: `{ browser, export, server }`. TypeScript enforces
   that every key is present.
4. If the field persists, check `packages/excalidraw/data/restore.ts` (restoreAppState) for migration and defaults.

### Test shape
Vitest globals (`describe`/`it`/`expect`, plus `vi`) with `@testing-library/react`. Integration tests render the
real editor `<Excalidraw />` through `render` from `tests/test-utils`. They drive it with `Pointer`/`UI`/`Keyboard`
from `tests/helpers/ui` and build fixtures with `API` from `tests/helpers/api`. Assertions go through the
`window.h` test hook (`h.state`, `h.elements`, `h.app`).

```tsx
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("element locking", () => {
  it("should not show unlockAllElements action in contextMenu if no elements locked", async () => {
    await render(<Excalidraw />);
    mouse.rightClickAt(0, 0);
    const item = queryByTestId(UI.queryContextMenu()!, "unlockAllElements");
    expect(item).toBe(null);
  });
});
```
(from `packages/excalidraw/actions/actionElementLock.test.tsx`)

Pure-function tests in `packages/element/tests/` import from `../src/<module>` and use plain describe/it
(see `packages/element/tests/selection.test.ts`). Snapshot tests are common, and CLAUDE.md asks you to run
`yarn test:update` before committing so snapshots get regenerated.

### Config
Config is environment driven through Vite `import.meta.env.VITE_APP_*`, defined in the committed
`.env.development`, `.env.production` and `.env.test` files. Types live in `excalidraw-app/vite-env.d.ts` /
`packages/excalidraw/vite-env.d.ts`. There is no runtime validator. Feature-level constants live in
`packages/common/src/constants.ts` and `excalidraw-app/app_constants.ts`.

### Data layer
There is no ORM. Scene data is kept in memory (`Scene`), and the app persists it to `localStorage` (elements +
appState, under `STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS` / `LOCAL_STORAGE_APP_STATE`) and to IndexedDB through
`idb-keyval` (files, library, TTD chats). Firebase is used for share links and collab. Loading goes through
`restore()` / `restoreElements()` / `restoreAppState()` in `packages/excalidraw/data/restore.ts`, and saving
through `clearAppStateForLocalStorage()`.

```ts
export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB, JSON.stringify({ username }));
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};
```
(from `excalidraw-app/data/localStorage.ts`)

### Framework-owned wiring
- **New action:** create `actions/actionX.ts(x)` with `register({...})`, add the name to the `ActionName` union in
  `actions/types.ts`, and re-export it from `actions/index.ts`. `App.tsx` registers all of them through
  `actionManager.registerAll(actions)`. Keyboard shortcuts go through `keyTest`, and labels shown in the shortcut
  help go in `actions/shortcuts.ts`.
- **New UI string:** add it **only** to `packages/excalidraw/locales/en.json`. The other locales are synced by
  Crowdin (`crowdin.yml`).
- **New host prop:** add it to `ExcalidrawProps` in `packages/excalidraw/types.ts` and pass it through
  `packages/excalidraw/index.tsx`, then into `App.tsx`.
- **App-only features:** mount them in `excalidraw-app/App.tsx` through `<Excalidraw ...>` props,
  `renderTopRightUI`, children components (`MainMenu`, `WelcomeScreen`, `Sidebar`), or app-level atoms in
  `app-jotai`.

## Sample files inspected
- packages/excalidraw/actions/actionToggleZenMode.tsx (kind: handler/action)
- packages/excalidraw/actions/actionToggleStats.tsx (kind: handler/action)
- packages/excalidraw/actions/actionDeselect.ts (kind: handler/action)
- packages/excalidraw/actions/register.ts, actions/index.ts, actions/types.ts (kind: framework wiring)
- packages/excalidraw/components/DarkModeToggle.tsx (kind: component)
- packages/excalidraw/components/Sidebar/Sidebar.tsx (kind: component + atom)
- packages/excalidraw/editor-jotai.ts, excalidraw-app/app-jotai.ts (kind: state wiring)
- packages/excalidraw/appState.ts (kind: config/state defaults)
- excalidraw-app/data/localStorage.ts, excalidraw-app/app_constants.ts (kind: data layer)
- packages/excalidraw/actions/actionElementLock.test.tsx (kind: integration test)
- packages/element/tests/selection.test.ts (kind: unit test)
- packages/excalidraw/tests/test-utils.ts (kind: test harness)
- excalidraw-app/App.tsx (lines 940-1010) (kind: entry/app mount)
- tsconfig.json, .eslintrc.json, vitest.config.mts (kind: tooling)

## Notes for downstream codegen
- Use `app.ownerDocument` / `app.ownerWindow` (or the node's `ownerDocument` / `defaultView`), not the
  `document` / `window` globals, when you add DOM or browser API usage (AGENTS.md).
- Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<...> & ...` (AGENTS.md).
- Prefer no allocation and the less CPU-hungry option, `const`/`readonly`, and `?.`/`??`
  (.github/copilot-instructions.md).
- Spread immutably when you update appState (`{ ...appState, field }`). Never mutate elements directly; use
  `mutateElement` / `newElementWith` / scene APIs.
- Whenever you add an `AppState` key, also add it to `APP_STATE_STORAGE_CONF`, or typecheck fails.
- Keep new `.scss` next to its component, and import it as a side effect at the bottom of the import list.
- Run `yarn test:typecheck` and `yarn test:app --watch=false <paths>`. Expect snapshot churn in
  `packages/excalidraw/tests/__snapshots__/*` when you add AppState fields; regenerate it with `yarn test:update`
  rather than hand-editing.
- The ESLint run uses `--max-warnings=0`, so import-order warnings count as failures.
