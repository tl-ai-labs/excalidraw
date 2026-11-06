# Stack profile: learned from repo scan

Built 2026-11-06 at HEAD `14bb42ede`, run `20261106-152445-feature-new-pages`. Trigger: React + TypeScript monorepo with no shipped adapter.

## Language & runtime
TypeScript 5.9.3 with `strict: true`, `target`/`module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx`, `noEmit` (tsc is used only for type checking). ESM throughout. Node >= 18 (CI uses 20.x). Yarn 1 workspaces. Packages build with esbuild (`build:esm`) and the app with Vite 5. Internal packages import each other as `@excalidraw/<pkg>` and `@excalidraw/<pkg>/<path>`. The aliases resolve to **source** in both `tsconfig.json#paths` and `vitest.config.mts`, so cross-package edits need no rebuild for tests or typecheck.

## Framework
React 19 (function components + hooks), with a large class component at the core (`packages/excalidraw/components/App.tsx`, `class App extends React.Component`, 11.5k lines plus `App.*.ts` helper splits such as `App.viewport.ts`, `App.pan.ts`, `App.clipboard.ts`). State lives in `AppState` (one big typed object in `packages/excalidraw/types.ts`) plus the element `Scene` (`packages/element/src/Scene.ts`). Jotai is scoped per editor via `jotai-scope` (`packages/excalidraw/editor-jotai.ts`). The app shell (`excalidraw-app/`) adds collaboration (socket.io + Firebase) and uses its own jotai store (`excalidraw-app/app-jotai.ts`).

## Conventions detected

### File naming
- Components: `PascalCase.tsx` with a sibling `PascalCase.scss` (`components/ProjectName.tsx` + `ProjectName.scss`). The CSS class name equals the component name (`.ProjectName`, `.ProjectName-label`).
- Actions: `actions/actionCamelCase.ts(x)`, one file per action group (`actionToggleZenMode.tsx`, `actionElementLock.ts`).
- Non-component modules: camelCase (`appState.ts`, `editor-jotai.ts`, `data/restore.ts`, `data/reconcile.ts`).
- Tests: `*.test.ts(x)`, either next to the source (`actions/actionElementLock.test.tsx`) or in `packages/excalidraw/tests/` (`history.test.tsx`, `viewport.test.ts`). Snapshots live in `__snapshots__/`.

### Handler / controller shape (editor actions)
Actions are the "handlers". Each action calls `register()`, which adds it to the global action list. It is then re-exported from `actions/index.ts`, and its name joins the `ActionName` union in `actions/types.ts`.
```ts
// packages/excalidraw/actions/actionToggleZenMode.tsx
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
`perform` returns `{ elements?, appState?, captureUpdate }`. `captureUpdate` is `CaptureUpdateAction.IMMEDIATELY` for undoable changes and `EVENTUALLY` / `NEVER` for UI-only changes. Labels are i18n keys into `packages/excalidraw/locales/en.json`.

### Service shape (UI component)
```tsx
// packages/excalidraw/components/ProjectName.tsx
type Props = { value: string; onChange: (value: string) => void; label: string; ignoreFocus?: boolean };

export const ProjectName = (props: Props) => {
  const { id } = useExcalidrawContainer();
  const [fileName, setFileName] = useState<string>(props.value);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === KEYS.ENTER) { event.preventDefault(); /* IME guard */ event.currentTarget.blur(); }
  };
  return (<div className="ProjectName"> … <input className="TextInput" onBlur={handleBlur} … /></div>);
};
```
Components are named exports declared as `export const X = (props: Props) => …`, never default exports. Imports come in groups separated by blank lines: react, then `@excalidraw/*` packages, then type-only imports, then relative imports, then `.scss`. eslint's `import/order` enforces this.

### Test shape
vitest with `globals: true` (`describe`/`it`/`expect` are not imported), jsdom, and @testing-library/react. The whole editor is rendered and inspected through the `window.h` test hook.
```tsx
// packages/excalidraw/actions/actionElementLock.test.tsx
import { queryByTestId, fireEvent } from "@testing-library/react";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("element locking", () => {
  it("should unlock all elements …", async () => {
    await render(<Excalidraw initialData={{ elements: [API.createElement({ x: 100, y: 100, locked: true })] }} />);
    mouse.rightClickAt(0, 0);
    expect(h.elements.map((el) => el.locked)).toEqual([true]);
  });
});
```
Helpers live in `packages/excalidraw/tests/helpers/` (`api.ts`, `ui.ts`, `mocks.ts`) and `tests/test-utils.ts`. App-level tests are in `excalidraw-app/tests/`. Pure logic tests (for example `packages/element/tests/*.test.ts`) call functions directly.

### Config
Vite env vars (`import.meta.env.VITE_APP_*`) come from the committed `.env.development` / `.env.production` / `.env.test`. No runtime validator. Shared constants live in `packages/common/src/constants.ts` (`EXPORT_DATA_TYPES`, `VERSIONS`, `MIME_TYPES`) and app constants in `excalidraw-app/app_constants.ts` (`WS_EVENTS`, `WS_SUBTYPES`, `FIREBASE_STORAGE_PREFIXES`).

### Data layer
There is no ORM. Elements are immutable, versioned plain objects. Saving and loading is JSON:
```ts
// packages/excalidraw/data/json.ts
export const serializeAsJSON = (elements, appState: Partial<AppState>, files: BinaryFiles, type: "local" | "database"): string => {
  const data: ExportedDataState = {
    type: EXPORT_DATA_TYPES.excalidraw, version: VERSIONS.excalidraw, source: getExportSource(), elements,
    appState: type === "local" ? cleanAppStateForExport(appState) : clearAppStateForDatabase(appState),
    files: type === "local" ? filterOutDeletedFiles(elements, files) : undefined,
  };
  return JSON.stringify(data, null, 2);
};
```
- `ExportedDataState` (`data/types.ts`) has `{ type, version, source, elements, appState, files }`. Loading goes through `data/restore.ts` (`restoreElements`, `restoreAppState`), which is the backward-compat migration point.
- Each `AppState` key is persisted per storage target by `APP_STATE_STORAGE_CONF` in `packages/excalidraw/appState.ts`, as `{ browser, export, server }` booleans. The typing is exhaustive, so **every new AppState key must be added there** or tsc fails.
- Element ordering uses fractional indices (`@excalidraw/fractional-indexing`, `packages/element/src/fractionalIndex.ts`). The `Scene` class keeps elements (`replaceAllElements`, `mapElements`, `insertElementsAtIndex`, `getNonDeletedElements`).
- Collaboration: `excalidraw-app/collab/Collab.tsx` (class component) and `Portal.tsx` (socket wrapper, encrypted broadcast through `encryptData`). Messages carry a `WS_SUBTYPES` enum (`SCENE_INIT`, `SCENE_UPDATE`, `MOUSE_LOCATION`, `IDLE_STATUS`, `USER_VISIBLE_SCENE_BOUNDS`). Incoming elements merge through `reconcileElements` (`packages/excalidraw/data/reconcile.ts`), which works by version. Firebase stores the scene (`excalidraw-app/data/firebase.ts`).
- App local persistence: `excalidraw-app/data/LocalData.ts`, `localStorage.ts`, `tabSync.ts` (cross-tab version sync), `idb-keyval` for files.

### Framework-owned wiring
- A new action means: `register({...})` in `actions/actionX.ts`, then `export { actionX } from "./actionX"` in `actions/index.ts`, then add `"x"` to the `ActionName` union in `actions/types.ts`. UI calls it through `actionManager.executeAction(actionX)` / `renderAction("x")`.
- New UI goes into the layer components (`components/LayerUI.tsx`, `MobileMenu.tsx`, footer/toolbars). Host apps customize through children/render props on `<Excalidraw>` (for example `excalidraw-app/components/AppFooter.tsx`, `AppMainMenu.tsx`).
- A new public prop or API means `ExcalidrawProps` / `ExcalidrawImperativeAPI` in `packages/excalidraw/types.ts`, re-exported from `packages/excalidraw/index.tsx`.
- New strings go in `packages/excalidraw/locales/en.json` only.

## Sample files inspected
- packages/excalidraw/actions/actionToggleZenMode.tsx (kind: handler/action)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/actions/actionElementLock.test.tsx (kind: test)
- packages/excalidraw/components/ProjectName.tsx and ProjectName.scss (kind: component)
- packages/excalidraw/data/json.ts (kind: data/serialization)
- packages/excalidraw/data/types.ts (ExportedDataState, partial)
- packages/excalidraw/appState.ts (APP_STATE_STORAGE_CONF, partial)
- packages/excalidraw/editor-jotai.ts (kind: state)
- packages/element/src/Scene.ts (method outline only)
- excalidraw-app/collab/Portal.tsx (head) and excalidraw-app/app_constants.ts (WS_SUBTYPES)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Use named `export const` arrow functions. No default exports, no new class components. Prop types are `type Props = {...}`.
- Keep the blank-line-separated import groups and put `import type` on its own line. Use `@excalidraw/<pkg>` aliases across packages and relative paths within a package.
- Pair each component with a `.scss` file whose class name matches the component. No CSS modules in practice, despite what copilot-instructions.md says.
- AGENTS.md: use `app.ownerDocument` / `app.ownerWindow` instead of `document`/`window` for new DOM API usage. Use `Merge<>` from `@excalidraw/common/utility-types` for type overrides.
- Any new `AppState` field needs: its type in `types.ts`, a default in `getDefaultAppState()` (`appState.ts`), an entry in `APP_STATE_STORAGE_CONF`, and restore handling in `data/restore.ts#restoreAppState`.
- File-format changes go through `ExportedDataState` / `ImportedDataState` (`data/types.ts`), `serializeAsJSON`, and `restore*`. Old files without the new field must still load.
- Collaboration changes go through `WS_SUBTYPES` plus `Portal` broadcast helpers and `Collab` handlers. Remote element merges always pass through `reconcileElements`.
- State changes that should be undoable return `captureUpdate: CaptureUpdateAction.IMMEDIATELY`.
- Tests: render `<Excalidraw />` with `tests/test-utils#render`, drive it with `API`/`UI`/`Pointer` helpers, and assert on `window.h.state` / `h.elements`. Don't import `describe`/`it`.
- Avoid file or dir names `build`, `dist`, `html`, `firebase`, `coverage`, `logs`: the root `.gitignore` ignores them at any depth.
