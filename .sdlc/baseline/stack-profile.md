# Stack profile — learned from repo scan

Built 2026-11-02 for run 20261102-160801-feature-new-pages at commit 14bb42ed. No pre-authored adapter matches this stack, so this profile is the architect's only stack baseline.

## Language & runtime

TypeScript 5.9.3 with `strict`, target and module ESNext, `moduleResolution: bundler`, `isolatedModules`, `noEmit`. Source is ESM. The app runs React 19.0.0; `@excalidraw/excalidraw` declares a peer range of React 17, 18 and 19, so library code must not depend on React-19-only APIs. `engines` says Node >= 18, CI uses 20.x, and yarn is classic 1.22.22. `tsc` covers `packages` and `excalidraw-app` only: `examples` and `tests` directories are excluded.

## Framework

React with no application framework, no router and no server. The editor is a custom canvas app centred on one class component, `packages/excalidraw/components/App.tsx` (11,493 lines). In-house systems matter more than any library here: the action registry, the `Scene`, the `Store` and history in `@excalidraw/element`, and `AppState`. Vite 5 builds the app, esbuild builds the packages, and vitest 3 with jsdom runs the tests.

Package layering: `common` and `math` sit lowest, then `element`, then `excalidraw`, and `excalidraw-app` consumes the library. The app adds what the library does not own: collaboration (socket.io), share links, Firebase, and browser persistence.

## Conventions detected

### File naming
- Components are PascalCase `.tsx` with a same-named `.scss` beside them: `excalidraw-app/components/AppSidebar.tsx` and `AppSidebar.scss`.
- Multi-file components get a folder: `packages/excalidraw/components/Sidebar/` holds `Sidebar.tsx`, `SidebarTabs.tsx`, `SidebarTabTrigger.tsx`, `common.ts` and `Sidebar.test.tsx`.
- Actions are `actions/action<Name>.tsx`: `actionDistribute.tsx`.
- Data modules are mixed: PascalCase when a module is class-like or a named concept (`LocalData.ts`, `FileManager.ts`, `Locker.ts`), camelCase otherwise (`tabSync.ts`, `fileStatusStore.ts`, `restore.ts`).
- Tests are `*.test.ts` or `*.test.tsx`, either in `packages/*/tests/` or beside the code.

### Handler / controller shape

User-triggered behaviour is an action, not a controller. From `packages/excalidraw/actions/actionDistribute.tsx`:

```tsx
export const distributeHorizontally = register({
  name: "distributeHorizontally",
  label: "labels.distributeHorizontally",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: distributeSelectedElements(elements, appState, app, {
        space: "between",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.H,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <IconButton /* ... */ onClick={() => updateData(null)} />
  ),
});
```

`perform` returns new elements and appState plus a `captureUpdate` value that decides history behaviour (`CaptureUpdateAction` in `packages/element/src/store.ts`).

### Component shape

Function components written as `export const Name = (...) =>`, with props typed inline or as a local `type`. From `packages/excalidraw/components/ErrorDialog.tsx`:

```tsx
export const ErrorDialog = ({
  children,
  onClose,
}: {
  children?: React.ReactNode;
  onClose?: () => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(!!children);
  const { container: excalidrawContainer } = useExcalidrawContainer();
```

Inside the library, components reach the editor through hooks and context: `useUIAppState()` from `context/ui-appState`, and `useExcalidrawSetAppState()`, `useEditorInterface()` and `useExcalidrawContainer()` from `components/App`. Tabs already use Radix (`import { Tabs as RadixTabs } from "radix-ui"` in `Sidebar/SidebarTabs.tsx`). `clsx` builds class names.

Styles are global SCSS nested under `.excalidraw`, using shared mixins. `.github/copilot-instructions.md` says CSS modules, but only one of 84 stylesheets is a module. Follow the code. From `Sidebar/SidebarTrigger.scss`:

```scss
@use "../../css/variables.module" as *;

.excalidraw {
  .sidebar-trigger {
    @include outlineButtonStyles;
    @include filledButtonOnCanvas;
```

### Service shape

No DI and no service classes in the usual sense. Logic is exported functions; stateful app-side modules are classes or plain objects. `excalidraw-app/data/LocalData.ts` uses a class with static members for browser persistence and subclasses `FileManager`. `excalidraw-app/collab/Portal.tsx` is a class wrapping the socket:

```ts
class Portal {
  collab: TCollabClass;
  socket: Socket | null = null;
  socketInitialized: boolean = false;
  roomId: string | null = null;
  roomKey: string | null = null;
  broadcastedElementVersions: Map<string, number> = new Map();
```

Global UI state uses Jotai through two isolated wrappers. Importing `jotai` directly is an ESLint error: library code imports from `packages/excalidraw/editor-jotai.ts`, app code from `excalidraw-app/app-jotai.ts`.

```ts
import { atom, useAtom } from "../app-jotai";

export const appLangCodeAtom = atom(getPreferredLanguage());
```

### Test shape

Vitest with `globals: true`, so `describe`, `it` and `expect` are not imported; `vi` is. Editor tests render the real component and drive it through helpers in `packages/excalidraw/tests/` (`helpers/api.ts`, `helpers/ui.ts`, `test-utils.ts`) and the `window.h` test hook. From `packages/excalidraw/actions/actionDuplicateSelection.test.tsx`:

```tsx
const { h } = window;

describe("actionDuplicateSelection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("frame selected only", async () => {
    const frame = API.createElement({ type: "frame" });
    API.setElements([frame, rectangle]);
    API.setSelectedElements([frame]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [{ id: frame.id }, /* ... */]);
  });
```

App-level tests render `ExcalidrawApp` and mock Firebase with `vi.mock("../../excalidraw-app/data/firebase.ts", ...)`; see `excalidraw-app/tests/collab.test.tsx`. Pure logic tests are table-driven `testCases.forEach` loops (`packages/element/tests/embeddable.test.ts`). The repo tracks 23 snapshot files, and a change to `AppState` or to rendered UI commonly changes them.

### Config

Vite env files at the repo root (`.env.development`, `.env.production`, `.env.test`), all committed, read through `import.meta.env.VITE_*`. There is no runtime validator. Shared constants live in `packages/common/src/constants.ts`; app constants live in `excalidraw-app/app_constants.ts`.

### Data layer

No ORM. The document is an array of elements plus `AppState` plus a `BinaryFiles` map.

- File format: `serializeAsJSON` in `packages/excalidraw/data/json.ts` writes `{ type, version, source, elements, appState, files }`, with `VERSIONS.excalidraw` currently 2. `packages/excalidraw/data/restore.ts` normalises anything loaded (`restoreElements`, `restoreAppState`), and old-file compatibility is handled there.
- AppState persistence is declared per key in `APP_STATE_STORAGE_CONF` (`packages/excalidraw/appState.ts`), which requires an entry for every `AppState` key:

```ts
showWelcomeScreen: { browser: true, export: false, server: false },
```

- Browser: `excalidraw-app/data/LocalData.ts` keeps elements and appState in localStorage under `STORAGE_KEYS` (`excalidraw`, `excalidraw-state`) and files in IndexedDB via `idb-keyval`.
- Remote: Firebase (`excalidraw-app/data/firebase.ts`, rules in `firebase-project/`). Share links and collaboration payloads are end-to-end encrypted (`packages/excalidraw/data/encryption.ts`).
- Collaboration: socket messages are typed by `WS_SUBTYPES` (`SCENE_INIT`, `SCENE_UPDATE`, `MOUSE_LOCATION`, `IDLE_STATUS`, `USER_VISIBLE_SCENE_BOUNDS`) in `excalidraw-app/app_constants.ts`, sent by `Portal.broadcastScene`, and merged through `packages/excalidraw/data/reconcile.ts`.

### Framework-owned wiring

- A new action needs `register({...})` in its file, an export from `packages/excalidraw/actions/index.ts`, and its name in the `ActionName` union in `actions/types.ts`. `App.tsx` line 912 calls `this.actionManager.registerAll(actions)`.
- A new `AppState` key needs the type in `packages/excalidraw/types.ts`, a default in `getDefaultAppState` and an entry in `APP_STATE_STORAGE_CONF` in `appState.ts`.
- Editor chrome is composed in `packages/excalidraw/components/LayerUI.tsx`, including `Footer`. Host apps inject UI through props such as `renderTopRightUI`, and `excalidraw-app/App.tsx` renders `<Excalidraw>` and its children.
- The imperative API is `ExcalidrawImperativeAPI` in `packages/excalidraw/types.ts` (`updateScene`, `resetScene`, and others).

## Sample files inspected

- packages/excalidraw/actions/actionDistribute.tsx (kind: action)
- packages/excalidraw/actions/manager.tsx, packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/components/Sidebar/Sidebar.tsx, packages/excalidraw/components/Sidebar/SidebarTabs.tsx (kind: component)
- packages/excalidraw/components/ErrorDialog.tsx (kind: component)
- excalidraw-app/components/AppSidebar.tsx (kind: component)
- packages/excalidraw/components/Sidebar/SidebarTrigger.scss (kind: style)
- packages/excalidraw/actions/actionDuplicateSelection.test.tsx (kind: test)
- excalidraw-app/tests/collab.test.tsx (kind: test)
- packages/element/tests/embeddable.test.ts (kind: test)
- excalidraw-app/data/LocalData.ts (kind: persistence)
- packages/excalidraw/data/json.ts (kind: file format)
- excalidraw-app/collab/Portal.tsx (kind: collaboration, first 40 lines)
- packages/excalidraw/editor-jotai.ts, excalidraw-app/app-jotai.ts, excalidraw-app/app-language/language-state.ts (kind: state)
- packages/excalidraw/appState.ts (kind: config, excerpts)
- .eslintrc.json, tsconfig.json, vitest.config.mts (kind: tooling)

`App.tsx`, `restore.ts`, `Collab.tsx` and `types.ts` exceed the 500-line sampling bound, so they were grepped, not read. `App.tsx` and `Collab.tsx` need direct reading before any design that touches them.

## Notes for downstream codegen

- Inside `packages/excalidraw`, import by relative path to the specific module. ESLint rejects imports from the barrel (`@excalidraw/excalidraw`, `..`, `../index`) except type imports. `excalidraw-app` does import from `@excalidraw/excalidraw`.
- Type imports are separate statements (`import type { ... }`) and come last. `@excalidraw/**` imports sort after other externals, per `import/order`.
- Lint runs with `--max-warnings=0`, so an import-order warning fails `yarn test:code`.
- For new DOM or browser API use, take `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node (AGENTS.md).
- To override properties of an existing type, use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`, not `Omit<...> & Overrides` (AGENTS.md).
- User-facing strings go through `t("labels.x")` and only into `packages/excalidraw/locales/en.json`. The other locale files come from Crowdin (`crowdin.yml`), and `TranslationKeys` is derived from `en.json`.
- Icons are exported from `packages/excalidraw/components/icons.tsx`.
- Library code is published to npm, so a new public prop or API is a compatibility commitment and belongs in the `dev-docs` API pages.
- PR titles follow `type(scope): summary`, for example `feat(editor): ...`, and `semantic-pr-title.yml` enforces this.
- `.github/copilot-instructions.md` also asks for performance-minded, low-allocation TypeScript and immutable data.
