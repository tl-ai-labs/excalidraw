# Stack profile — learned from repo scan

Built 2026-11-05 for run 20261105-105249-feature-new-pages at HEAD 14bb42ede. It was triggered because React/TypeScript has no pre-authored adapter. Where this profile and `generic.md` disagree, this profile wins.

## Language & runtime
TypeScript 5.9.3 throughout. `tsconfig.json` is `strict`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `isolatedModules`, `noEmit`. The code is ESM only. Node is >=18 (CI 20.x, local 24.18). React 19. Packages build with esbuild; the app builds with Vite 5. Yarn 1 workspaces. `yarn test:typecheck` runs `tsc` over `packages` and `excalidraw-app` (examples excluded).

## Framework
React (class component for the editor core `App.tsx`, function components elsewhere) and jotai for UI-local state. The editor is a library (`@excalidraw/excalidraw`). The app (`excalidraw-app`) consumes it through `ExcalidrawImperativeAPI` (`updateScene`, `getAppState`, `getSceneElementsIncludingDeleted`, `addFiles`, …). There are no routing or server frameworks. Collab uses socket.io-client plus Firebase (Firestore and Storage).

## Conventions detected

### File naming
- React components are PascalCase `.tsx` with a sibling `.scss`: `components/LaserPointerButton.tsx`, `components/LayerUI.tsx` + `LayerUI.scss`, `components/footer/Footer.tsx` + `FooterCenter.scss`.
- Modules are camelCase `.ts`: `data/json.ts`, `data/restore.ts`, `data/reconcile.ts`, `appState.ts`, `editor-jotai.ts`. Classes get PascalCase files: `element/src/Scene.ts`, `excalidraw-app/data/LocalData.ts`, `collab/Portal.tsx`.
- Actions are `actions/action<Name>.ts(x)`, e.g. `actionToggleGridMode.tsx`.
- Tests are `<name>.test.ts(x)`. Most live in `packages/excalidraw/tests/` (and `tests/data/`, `tests/scene/`); some are colocated (`data/library.test.ts`, `mermaid.test.ts`); `excalidraw-app/tests/`; `packages/element/src/__tests__/`. Snapshots go in `__snapshots__/`.

### Imports (enforced by eslint, `--max-warnings=0`)
- `import/order` groups builtin, external, internal, parent, sibling, index, type, with a **blank line between groups**. `@excalidraw/**` counts as external, placed after third-party.
- Type imports must be separate: `import type { X } from "..."` (`consistent-type-imports`, `fixStyle: separate-type-imports`).
- **Never import from `"jotai"` directly.** Use `packages/excalidraw/editor-jotai.ts` (editor, isolated via `jotai-scope`) or `excalidraw-app/app-jotai.ts` (app, `appJotaiStore`).
- Cross-package imports go through aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/element/types`, `@excalidraw/math`, `@excalidraw/common/utility-types`). Inside `packages/excalidraw`, imports are relative (`../appState`, `./blob`).

```ts
import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";
```

### Component shape (function component, typed props)
`packages/excalidraw/components/LaserPointerButton.tsx`:
```tsx
type LaserPointerButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

export const LaserPointerButton = (props: LaserPointerButtonProps) => {
  return (
    <IconButton
      className={clsx("ToolIcon__LaserPointer", { "is-mobile": props.isMobile })}
      type="toggle"
      size="small"
      icon={laserPointerToolIcon}
      checked={props.checked}
      data-testid="toolbar-LaserPointer"
      onSelect={() => props.onChange?.()}
    />
  );
};
```
Components reach editor context through hooks such as `useApp()` (from `../App`), `useTunnels()` (`context/tunnels`), and `t()` from `../i18n` for strings. Footer layout: `components/footer/Footer.tsx` takes `appState: UIAppState` and `actionManager`.

### Action shape (the editor's command pattern)
`packages/excalidraw/actions/actionToggleGridMode.tsx`:
```ts
export const actionToggleGridMode = register({
  name: "gridMode",
  icon: gridIcon,
  label: "labels.toggleGrid",
  viewMode: true,
  trackEvent: { category: "canvas", predicate: (appState) => appState.gridModeEnabled },
  perform(elements, appState) {
    return {
      appState: { ...appState, gridModeEnabled: !this.checked!(appState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
```
`register()` (`actions/register.ts`) adds the action to a global list. Actions are re-exported from `actions/index.ts`, their names are typed in `actions/types.ts`, and they are dispatched through `ActionManager` (`actions/manager.tsx`). `perform` returns `{elements?, appState?, captureUpdate}`. `CaptureUpdateAction.IMMEDIATELY | EVENTUALLY | NEVER` controls undo-history capture (`packages/element/src/store.ts`).

### State / service shape
- Elements are immutable and versioned: you never mutate them in place without `mutateElement`/`newElementWith`, and each change bumps `version`/`versionNonce`. Ordering uses fractional indices (`@excalidraw/fractional-indexing`, `syncInvalidIndices`).
- `Scene` (`packages/element/src/Scene.ts`) holds the elements: `replaceAllElements`, `getElementsIncludingDeleted`, `getNonDeletedElements`, `getNonDeletedElementsMap`. Deletion is soft (`isDeleted`).
- `AppState` (`packages/excalidraw/types.ts:330`) holds the viewport (`scrollX`, `scrollY`, `zoom`) and UI state. **Every new AppState key must be added to `APP_STATE_STORAGE_CONF`** in `packages/excalidraw/appState.ts` with `{ browser, export, server }` flags, and to `getDefaultAppState()`. `restoreAppState` in `data/restore.ts` normalizes keys on load.
- App-level singletons are static classes (`LocalData.save/flushSave/pauseSave`) or class components holding a helper (`Collab` has `portal: Portal`, `fileManager: FileManager`) and exposing a typed API through a jotai atom (`collabAPIAtom = atom<CollabAPI | null>(null)`).

### Serialization / persistence shape
`packages/excalidraw/data/json.ts`:
```ts
export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  type: "local" | "database",
): string => {
  const data: ExportedDataState = {
    type: EXPORT_DATA_TYPES.excalidraw,
    version: VERSIONS.excalidraw,
    source: getExportSource(),
    elements,
    appState: type === "local" ? cleanAppStateForExport(appState) : clearAppStateForDatabase(appState),
    files: type === "local" ? filterOutDeletedFiles(elements, files) : undefined,
  };
  return JSON.stringify(data, null, 2);
};
```
`ExportedDataState` and `ImportedDataState` (`data/types.ts`) define the file shape. Loading runs through `loadFromBlob`, then `restore*` (`data/restore.ts`), which handles legacy fields; see the `LegacyAppState` map pattern for deprecations. The app's localStorage uses `STORAGE_KEYS` in `excalidraw-app/app_constants.ts`, written by `saveDataStateToLocalStorage` in `excalidraw-app/data/LocalData.ts` and read by `importFromLocalStorage` in `excalidraw-app/data/localStorage.ts`, with cross-tab freshness from `tabSync.ts`.

### Collab shape
`excalidraw-app/collab/Portal.tsx` `broadcastScene(updateType, elements, syncAll)` sends only the elements whose `version` is newer than `broadcastedElementVersions`, filtered by `isSyncableElement`, as `{ type: WS_SUBTYPES.INIT|UPDATE, payload: { elements } }`, encrypted in `_broadcastSocketData`. The receiving side, `Collab._reconcileElements`:
```ts
remoteElements = restoreElements(remoteElements, existingElements);
let reconciledElements = reconcileElements(existingElements, remoteElements, appState);
reconciledElements = bumpElementVersions(reconciledElements, existingElements);
this.setLastBroadcastedOrReceivedSceneVersion(getSceneVersion(reconciledElements));
```
then `excalidrawAPI.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })`. Firestore stores one encrypted doc per room at `scenes/<roomId>` (`excalidraw-app/data/firebase.ts#saveToFirebase`).

### Test shape
Vitest with globals (`describe`/`it`/`expect`), jsdom, and `vi` imported explicitly. UI tests render the real component and drive it through helpers. From `packages/excalidraw/tests/viewMode.test.tsx`:
```tsx
import { Excalidraw } from "../index";
import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, GlobalTestState, waitFor } from "./test-utils";

const { h } = window;            // test handle to the App instance / state

describe("view mode", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });
  it("…", async () => {
    API.setAppState({ viewModeEnabled: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(CURSOR_TYPE.GRAB);
  });
});
```
- `API` (`tests/helpers/api.ts`) provides `setAppState`, `updateScene`, `setElements`, `createElement`, and more. `h.elements` / `h.state` read the live scene.
- Data tests import modules directly: `tests/data/restore.test.ts` uses `import * as restore from "../../data/restore"`, `getDefaultAppState`, and `serializeAsJSON`.
- App tests render `ExcalidrawApp` from `../App` and `vi.mock("../../excalidraw-app/data/firebase.ts", …)`. See `excalidraw-app/tests/collab.test.tsx`, which also stubs `window.crypto`.
- Snapshot tests are common. Run `yarn test:update` after intended changes.

### Config
Config is Vite env through `import.meta.env.VITE_APP_*`, coming from the tracked `.env.development`/`.env.production`. There is no runtime validator. Constants live in `packages/common/src/constants.ts` (exported from `@excalidraw/common`) and `excalidraw-app/app_constants.ts`.

### Data layer
There is no ORM. Data is a plain JSON element array plus AppState. Firestore docs and Storage blobs are encrypted client-side (`packages/excalidraw/data/encryption.ts`). Files go to IndexedDB through `idb-keyval` in the app.

### Framework-owned wiring
- Actions: `register({...})` in `actions/action*.ts`, re-exported from `actions/index.ts`, with names in `actions/types.ts#ActionName`. `App.tsx` registers them with `ActionManager`.
- i18n: keys go in `packages/excalidraw/locales/en.json` (e.g. `"labels": { "toggleGrid": "Toggle grid" }`), are used as `t("labels.toggleGrid")`, and other locales are synced by Crowdin.
- Public API: anything the app or hosts need is exported from `packages/excalidraw/index.tsx`, with its type in `types.ts` (`ExcalidrawProps`, `ExcalidrawImperativeAPI`).
- UI injection uses tunnels (`context/tunnels`) and `LayerUI.tsx` composition. The footer is `components/footer/Footer.tsx`.

## Sample files inspected
- packages/excalidraw/components/LaserPointerButton.tsx (kind: component)
- packages/excalidraw/components/footer/Footer.tsx (kind: component)
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: handler/action)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/editor-jotai.ts, excalidraw-app/app-jotai.ts (kind: state wiring)
- packages/excalidraw/data/json.ts, data/types.ts (kind: serialization)
- packages/excalidraw/appState.ts (kind: config/state)
- excalidraw-app/data/index.ts, data/LocalData.ts, data/tabSync.ts, data/firebase.ts (kind: persistence)
- excalidraw-app/collab/Collab.tsx, collab/Portal.tsx (kind: service/sync)
- packages/excalidraw/tests/viewMode.test.tsx, tests/data/restore.test.ts, excalidraw-app/tests/collab.test.tsx (kind: test)
- .eslintrc.json, tsconfig.json, vitest.config.mts (kind: config)

## Notes for downstream codegen
- Follow AGENTS.md: use `app.ownerDocument`/`app.ownerWindow` (never the bare `document`/`window`) for new DOM APIs. Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<…> & …`.
- Follow copilot-instructions: readonly/immutable data, `?.`/`??`, allocation-light and performance-minded code.
- Keep the import group blank lines and separate `import type` lines, or `yarn test:code` fails (max-warnings=0).
- Never import `jotai` directly.
- New AppState fields need `APP_STATE_STORAGE_CONF`, `getDefaultAppState`, and handling in `restoreAppState`. Expect snapshot churn in `packages/excalidraw/tests/__snapshots__`.
- New persisted file fields need `ExportedDataState`/`ImportedDataState` (`data/types.ts`), `serializeAsJSON`, and the restore path with backward compatibility for files that lack them. Keep the JSON schema doc (`dev-docs/docs/codebase/json-schema.mdx`) in mind.
- Element changes must go through `newElementWith`/`mutateElement` and keep `version` monotonic. Collab relies on version and versionNonce for reconcile.
- Scene changes from remote/load paths use `CaptureUpdateAction.NEVER`. User actions use `IMMEDIATELY` or `EVENTUALLY`.
- User-visible strings go only in `locales/en.json`.
- `App.tsx` is 11.5k lines. Make targeted edits and put new logic in new modules.
