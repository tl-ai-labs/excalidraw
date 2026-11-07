# Stack profile — learned from repo scan

## Language & runtime
TypeScript 5.9 throughout. Root `tsconfig.json` uses `strict: true`, `target`/`module` ESNext, and `jsx: react-jsx`. It's ESM only, and imports omit extensions. Node >=18 (CI uses 20). React 19. Package manager is Yarn 1.22 workspaces. The app is built with Vite 5 and the packages with esbuild (`build:esm`). Styling is SCSS, with one `.scss` file next to each component and BEM-ish class names.

## Framework
React 19 component library (`@excalidraw/excalidraw`) plus a Vite SPA (`excalidraw-app`). There's no routing framework. The editor's own **action system** (`register()` + `ActionManager`) and **jotai** atoms (scoped via `jotai-scope`) are the framework-owned extension points.

## Conventions detected

### File naming
- Actions: `packages/excalidraw/actions/actionCamelCase.ts(x)`, e.g. `actionToggleZenMode.tsx`, `actionDeselect.ts`. Tests sit beside them (`actionFlip.test.tsx`).
- Components: `PascalCase.tsx` + `PascalCase.scss` in `components/`, or a folder for bigger ones (`components/ViewportStatusFrame/ViewportStatusFrame.tsx` + `.scss`).
- The `App` class is split into feature helpers `components/App.<feature>.ts` (`App.bucketFill.ts`, `App.cursor.ts`, `App.viewport.ts`).
- Tests: `packages/excalidraw/tests/camelCase.test.tsx` (e.g. `eyeDropper.test.tsx`), `packages/<pkg>/src/*.test.ts` or `packages/<pkg>/tests/*.test.tsx`.

### Handler / controller shape (actions)
```ts
import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { coffeeIcon } from "../components/icons";

import { register } from "./register";

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
(`packages/excalidraw/actions/actionToggleZenMode.tsx`.) `perform` returns `{ appState, elements?, captureUpdate }` immutably. `captureUpdate` is `IMMEDIATELY` for undoable changes and `EVENTUALLY` for UI state.

### Component shape
Arrow-function components with inline prop types, `clsx` for conditional classes, `t()` from `../../i18n` for strings, and side-effect SCSS imports. From `components/ViewportStatusFrame/ViewportStatusFrame.tsx`:
```tsx
import { useId } from "react";

import clsx from "clsx";

import { t } from "../../i18n";
import { CloseIcon } from "../icons";

import "./ViewportStatusFrame.scss";

import type { CSSProperties } from "react";

export const ViewportStatusBorder = ({ border, style }: { border: string; style?: CSSProperties }) => (
  <div className="viewport-status-frame__border" style={{ borderColor: border, ...style }} />
);
```
These are named exports, with no default exports. Icons are JSX constants in `components/icons.tsx`.

### Service / state shape
Editor-scoped state uses jotai via `packages/excalidraw/editor-jotai.ts`. Import `atom`, `useAtom`, `useAtomValue` and `useSetAtom` from there, not straight from `"jotai"`, because eslint restricts direct imports. Core element logic lives as pure functions in `@excalidraw/element` (e.g. `getElementsInGroup`, `makeNextSelectedElementIds`), and shared constants/utilities are in `@excalidraw/common` (`KEYS`, `CODES`, `THEME`, colors).

### Test shape
Vitest with globals (`describe/it/expect`, no imports needed), jsdom, `vitest-canvas-mock`, and `@testing-library/jest-dom` (set up in `setupTests.ts`). Integration tests render `<Excalidraw />` and drive it through helpers. From `tests/eyeDropper.test.tsx`:
```tsx
import React from "react";
import { KEYS, THEME } from "@excalidraw/common";
import { Excalidraw } from "../index";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;   // h.state / h.elements / h.app test handle

describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    Keyboard.keyPress("i");
    ...
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });
    expect(preview.style.left).toBe("325px");
  });
});
```
Unit tests import from the package alias (`import { rgbToHex } from "@excalidraw/common"`). Snapshot tests use `toMatchSnapshot()` with `__snapshots__/`. Helpers live in `packages/excalidraw/tests/helpers/` (`ui.ts` provides Keyboard/Pointer/UI, plus `api.ts` and `mocks.ts`).

### Config
Env comes from Vite `import.meta.env.VITE_APP_*` (`.env.development` / `.env.production` / `.env.test`), with no validator. Example: `JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG)` in `excalidraw-app/data/firebase.ts`. Library behaviour is configured through `<Excalidraw>` props (`types.ts` → `ExcalidrawProps`) and `AppState` defaults (`appState.ts`).

### Data layer
There's no ORM. Scene state is in memory (`scene/`, `AppState`, `ExcalidrawElement`). The app persists to localStorage/IndexedDB (`idb-keyval`, `excalidraw-app/data/localStorage.ts`, `LocalData.ts`) and syncs over Firebase and socket.io collab (`excalidraw-app/collab/Collab.tsx`).

### Framework-owned wiring
A new action needs all of these:
1. `actions/actionX.ts(x)` calling `register({...})`
2. Its `name` added to the `ActionName` union in `packages/excalidraw/actions/types.ts`
3. A re-export from `packages/excalidraw/actions/index.ts`
4. Label/i18n keys in `packages/excalidraw/locales/en.json` (other locales are Crowdin-managed, so don't edit them)
5. Optionally, a shortcut in `actions/shortcuts.ts` and an entry in the HelpDialog/command palette

New AppState fields go in `types.ts` (`AppState`), `appState.ts` (defaults + storage config), and often in snapshot updates. New public props go in `ExcalidrawProps` in `types.ts` and get threaded through `index.tsx`. Internal packages resolve via the aliases in `vitest.config.mts` and `tsconfig.json` paths.

## Sample files inspected
- packages/excalidraw/actions/actionToggleZenMode.tsx (kind: handler/action)
- packages/excalidraw/actions/actionDeselect.ts (kind: handler/action)
- packages/excalidraw/actions/register.ts (kind: framework wiring)
- packages/excalidraw/actions/index.ts (kind: framework wiring)
- packages/excalidraw/components/ViewportStatusFrame/ViewportStatusFrame.tsx (kind: component)
- packages/excalidraw/editor-jotai.ts (kind: state/service)
- packages/excalidraw/tests/eyeDropper.test.tsx (kind: test, integration)
- packages/common/src/colors.test.ts (kind: test, unit)
- vitest.config.mts, setupTests.ts, tsconfig.json, .eslintrc.json (kind: config)
- excalidraw-app/data/firebase.ts (kind: config/data, grep only)

## Notes for downstream codegen
- Import order is enforced (eslint `import/order`, `newlines-between: always-and-inside-groups`): builtin, external, `@excalidraw/**`, parent, sibling, then `import type` last, with blank lines between groups. Use `import type` for type-only imports.
- Use `@excalidraw/<pkg>` aliases across packages and never cross-package relative paths. Inside a package, use relative paths.
- Use named exports, arrow functions, immutable updates (`{...appState, x}`), and `?.`/`??`. Follow `.github/copilot-instructions.md`.
- User-visible strings go through `t("key")` with keys added to `locales/en.json` only.
- Don't append to `components/App.tsx` (about 13.9k lines) if a sibling `App.<feature>.ts` helper fits, following the recent `App.bucketFill.ts` / `App.cursor.ts` pattern.
- Run tests non-interactively with `yarn test:app --watch=false <file>`. Expect snapshot churn when AppState changes, and review it before running `yarn test:update`.
- Prettier 2.6 via `@excalidraw/prettier-config` (double quotes, trailing commas). `yarn fix` auto-formats.
