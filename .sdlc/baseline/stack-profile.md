# Stack profile: learned from repo scan

Built 2026-11-06 at HEAD 14bb42ed (run 20261106-feature-new-drawing-pages). Triggered because React/TypeScript has no pre-authored adapter.

## Language & runtime
TypeScript 5.9 with `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx`, `noEmit` (root `tsconfig.json` covers `packages` + `excalidraw-app`). ESM only. React 19. Node >= 18. Yarn 1 workspaces.

## Framework
React component library (`@excalidraw/excalidraw`) plus a Vite app (`excalidraw-app`). State lives in the class component `App` (`packages/excalidraw/components/App.tsx`, holding React state as `AppState`) together with the `Scene` (elements) and `Store`/`History` (undo). Supporting state uses jotai through an isolated store (`packages/excalidraw/editor-jotai.ts`; do not import `jotai` directly, an eslint rule blocks it). UI primitives come from radix-ui. Commands are an action registry.

## Conventions detected

### File naming
- Components are PascalCase `.tsx` with a sibling `.scss`: `components/footer/FooterCenter.tsx` + `FooterCenter.scss`, `components/Sidebar/SidebarTabTrigger.tsx`.
- Modules are camelCase `.ts`: `data/restore.ts`, `data/reconcile.ts`, `appState.ts`, `history.ts`. Classes are PascalCase: `element/src/Scene.ts`, `app/data/LocalData.ts`.
- Actions: `actions/actionXxx.ts(x)`. Tests: `*.test.ts(x)`, either beside the code or under `packages/excalidraw/tests/`, with snapshots in `__snapshots__/`.

### Imports
Groups separated by blank lines, in this order: external libs, then `@excalidraw/common`, then `@excalidraw/element`, then relative imports, then `import type` groups last (eslint import/order). Packages import each other through aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/excalidraw/...`), never through relative paths that cross packages.

### Action (command) shape
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
A new action name must be added to the `ActionName` union in `packages/excalidraw/actions/types.ts` and exported from `actions/index.ts`. `captureUpdate` (`IMMEDIATELY` | `EVENTUALLY` | `NEVER`) decides whether the change enters undo history.

### Component shape
```tsx
const FooterCenter = ({ children }: { children?: React.ReactNode }) => {
  const { FooterCenterTunnel } = useTunnels();
  const appState = useUIAppState();
  return (
    <FooterCenterTunnel.In>
      <div className={clsx("footer-center zen-mode-transition", {
        "layer-ui__wrapper__footer-left--transition-bottom": appState.zenModeEnabled })}>
        {children}
      </div>
    </FooterCenterTunnel.In>
  );
};
export default FooterCenter;
FooterCenter.displayName = "FooterCenter";
```
Function components set `displayName`, use `clsx` for classes, `useUIAppState()` / `useApp()` / `useExcalidrawSetAppState()` from context, `t("labels.x")` from `../i18n` for strings (keys in `packages/excalidraw/locales/en.json`; only en.json is edited by hand, Crowdin owns the rest), and radix `Tabs` for tab UIs (see `components/Sidebar/SidebarTabTrigger.tsx`). Styles are plain SCSS with BEM-like class names (not CSS modules, despite what copilot-instructions says), using CSS variables such as `var(--ui-pointerEvents)`.

### Data / state layer
- Elements: one flat ordered array in `Scene`, with fractional `index`, `version`/`versionNonce`, and soft delete through `isDeleted`. Mutate with `newElementWith` / `mutateElement` / `scene.mutateElement`, never by assignment.
- AppState persistence is driven by `APP_STATE_STORAGE_CONF` in `appState.ts`. Each key declares `{ browser, export, server }`, and every new AppState key must get an entry (the type requires it) plus a default in `getDefaultAppState`.
- File format: `serializeAsJSON` writes `{ type: "excalidraw", version: VERSIONS.excalidraw (2), source, elements, appState, files }`. `restore.ts` (`restoreElements`, `restoreAppState`) must accept old files: missing fields fall back to defaults, and legacy keys migrate through `LegacyAppStateMigrations`.
- Collab: `Portal.broadcastScene(WS_SUBTYPES.INIT|UPDATE, elements, syncAll)` sends only the elements whose version increased. Message payload types live in `SocketUpdateDataSource` (`excalidraw-app/data/index.ts`). Incoming data goes through `reconcileElements` (version/versionNonce wins). Firebase stores only encrypted elements.

### Test shape
```tsx
const { h } = window;
describe("view mode", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
  });
  it("...", async () => {
    API.setAppState({ viewModeEnabled: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(CURSOR_TYPE.GRAB);
  });
});
```
Vitest globals (`describe/it/expect`, `vi` imported from "vitest"), jsdom, `vitest-canvas-mock`. Helpers: `tests/helpers/api.ts` (`API.createElement`, `API.setElements`, `API.setAppState`), `tests/helpers/ui.ts` (`Pointer`, `Keyboard`, `UI`), `tests/test-utils.ts` (`render`, `act`, `waitFor`, `GlobalTestState`). `window.h` exposes `h.elements`, `h.state`, `h.app`, `h.history`. App-level tests (`excalidraw-app/tests/collab.test.tsx`) mock `../../excalidraw-app/data/firebase.ts` with `vi.mock`.

### Config
Env through `import.meta.env.VITE_APP_*` (`.env.development` / `.env.production`, both tracked). No runtime validator.

### Framework-owned wiring
- Actions register through `register()` in `actions/register.ts`, which appends to a global list. `ActionManager` renders and dispatches them.
- UI slots go through tunnels (`context/tunnels.ts`, tunnel-rat): `Footer`, `FooterCenter`, `MainMenu`, `WelcomeScreen` and `DefaultSidebar` children are teleported into `LayerUI`. Hosts (excalidraw-app) pass children such as `<AppFooter>` / `<AppMainMenu>`.
- Public API: `packages/excalidraw/index.tsx` re-exports components and helpers. `ExcalidrawImperativeAPI` (types.ts) is built in `App.tsx`.

## Sample files inspected
- packages/excalidraw/actions/actionToggleGridMode.tsx (kind: action/handler)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/excalidraw/components/footer/Footer.tsx, FooterCenter.tsx, FooterCenter.scss (kind: component)
- packages/excalidraw/components/Sidebar/SidebarTabTrigger.tsx (kind: component, tabs)
- packages/element/src/Scene.ts (kind: domain class)
- packages/excalidraw/data/json.ts, restore.ts, reconcile.ts, types.ts; packages/excalidraw/appState.ts (kind: data layer)
- excalidraw-app/collab/Portal.tsx, excalidraw-app/data/index.ts, excalidraw-app/data/LocalData.ts (kind: sync/persistence)
- packages/excalidraw/tests/viewMode.test.tsx, packages/excalidraw/tests/data/restore.test.ts, excalidraw-app/tests/collab.test.tsx (kind: test)
- packages/excalidraw/editor-jotai.ts (kind: state)

## Notes for downstream codegen
- Follow AGENTS.md: use `app.ownerDocument`/`app.ownerWindow` instead of `document`/`window`, and `Merge<>` instead of `Omit<> & {}`.
- Keep all new persisted fields backward compatible in `restore.ts`: an old file without pages must load as a single page.
- `excalidraw-app` code must not be imported from `packages/*`. The library stays host-agnostic, and collab/localStorage live only in the app.
- Every new AppState key needs an `APP_STATE_STORAGE_CONF` entry, or `tsc` fails.
- Element changes must bump `version` (use the mutate helpers) or collab reconciliation and history will miss them.
- `App.tsx` is 11.5k lines. Make focused, minimal edits there.
- Snapshot tests (`__snapshots__`) are sensitive to AppState shape. Adding default AppState keys will change many snapshots (`yarn test:update`).
