# Stack profile: learned from repo scan

Built 2026-11-06 for run 20261106-152440-feature-new-text-range-styling (trigger: React/TypeScript stack, no matching pre-authored adapter).

## Language & runtime
TypeScript 5.9 with `strict: true`, `moduleResolution: "bundler"`, `isolatedModules`, `jsx: "react-jsx"`, ESM only (no CJS in src). Node >= 18, Yarn 1 workspaces. `tsc` is used only for type checks (`noEmit`). Packages are built with esbuild and the app with Vite 5.

## Framework
React 19 component library (`@excalidraw/excalidraw`) on top of framework-free TS packages (`@excalidraw/element`, `common`, `math`, `utils`). Jotai handles some UI state. The core editor is the class component `packages/excalidraw/components/App.tsx`, split into `App.*.ts` helpers such as `App.text.ts` and `App.clipboard.ts`. The excalidraw.com app (`excalidraw-app/`) adds collab over socket.io, with Firebase for storage.

## Conventions detected

### File naming
- camelCase `.ts` modules for logic: `packages/element/src/textElement.ts`, `newElement.ts`, `mutateElement.ts`, `data/restore.ts`.
- PascalCase `.tsx` for React components: `components/ImageExportDialog.tsx`, `collab/Collab.tsx`. Each has a sibling `.scss`.
- Tests: `*.test.ts(x)`, either next to the source (`wysiwyg/textWysiwyg.test.tsx`) or under `packages/<pkg>/tests/` (`packages/element/tests/textElement.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`).

### Imports (enforced by eslint `import/order`, newlines between groups)
Order: externals, then `@excalidraw/*` aliases (each package in its own block), then `import type` blocks, then relative imports. Cross-package imports always use the alias (`@excalidraw/element`, `@excalidraw/common`, `@excalidraw/element/types`) and never a relative path across packages.
```ts
import { pointFrom } from "@excalidraw/math";
import { getLineHeightInPx, isTextElement, newElementWith } from "@excalidraw/element";

import { FONT_FAMILY, TEXT_ALIGN, THEME } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
```

### Element model (central)
Elements are immutable `Readonly<{…}>` types in `packages/element/src/types.ts` (e.g. `ExcalidrawTextElement` at :253, built as `_ExcalidrawElementBase & Readonly<{ type: "text"; … }>`). Documented fields carry JSDoc. Changes go through `newElementWith(el, updates)` (immutable, bumps version) or `mutateElement` (in place, bumps version/versionNonce). Version bumps are what make collab reconcile pick up an edit.

### Action shape (the "handler" kind)
User-facing operations are `register({...})` actions in `packages/excalidraw/actions/*.tsx`, with `perform` returning `{ elements, appState, captureUpdate }` and an optional `PanelComponent`:
```ts
export const actionChangeStrokeColor = register<
  Partial<AppState> & { color?: string }
>({
  name: "changeStrokeColor",
  label: "labels.stroke",
  trackEvent: false,
  perform: (elements, appState, value) => {
    ...
    return {
      elements: changeProperty(elements, appState, (el) =>
        hasStrokeColor(el.type) ? newElementWith(el, getColorUpdate(el, "strokeColor", color, elementsMap)) : el, true),
      appState: { ...appState, ...appStateUpdates },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => { ... },
});
```
Labels are i18n keys (`t("labels.textColor")`) in `packages/excalidraw/locales/en.json`.

### Factory / service shape
Exported arrow functions taking an options object, no classes:
```ts
export const newTextElement = (
  opts: {
    text: string;
    fontSize?: number;
    ...
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> => {
  const fontFamily = opts.fontFamily || DEFAULT_FONT_FAMILY;
  ...
```

### Restore / backward compatibility
Every persisted field gets a default in `packages/excalidraw/data/restore.ts`, inside the per-type `switch` that calls `restoreElementWithProperties(element, { field: element.field ?? default, ... })`, with validation helpers such as `isFiniteNumber` and `clamp`.

### Render shape
Canvas uses `withSavedContext(context, () => { context.font = getFontString(element); context.fillStyle = applyDarkModeFilter(color, theme === THEME.DARK); ... fillText per line })` in `packages/element/src/renderElement.ts`. SVG uses `svgRoot.ownerDocument.createElementNS(SVG_NS, "text")` plus `setAttribute` calls in `packages/excalidraw/renderer/staticSvgScene.ts`. Colours always go through `applyDarkModeFilter`.

### Test shape
Vitest with globals (`describe`/`it`/`expect`, `vi` from "vitest"), jsdom plus vitest-canvas-mock. Helpers: `API.createElement({ type, ... })` (`packages/excalidraw/tests/helpers/api`), `Keyboard`/`Pointer`/`UI` (`tests/helpers/ui`), `render`, `act`, `GlobalTestState` (`tests/test-utils`), and fixtures in `tests/fixtures/elementFixture.ts`. Snapshot tests (`__snapshots__/*.snap`) are used heavily, so new element fields change snapshots.
```ts
describe("Test measureText", () => {
  it("should compute coords correctly when rectangle", () => {
    const element = API.createElement({ type: "rectangle", ...params });
    expect(getContainerCoords(element)).toEqual({ x: 15, y: 25 });
  });
});
```

### Config
Vite env (`import.meta.env.VITE_APP_*`) from the tracked `.env.development`, `.env.production` and `.env.test`. No runtime validator. Path aliases are duplicated in `tsconfig.json#paths` and `vitest.config.mts`.

### Data layer
No ORM. Scene JSON is handled by `data/json.ts` (`serializeAsJSON`/`loadFromJSON`), `data/restore.ts` and `data/reconcile.ts`. The collab payload is encrypted (`data/encryption.ts`) and sent over socket.io (`excalidraw-app/collab/Portal.tsx`), with Firebase persistence (`excalidraw-app/data/firebase.ts`).

### Framework-owned wiring
- New actions: `register(...)` in `actions/*.tsx`, re-exported from `actions/index.ts`, and shown in the properties panel through `components/Actions.tsx` and `PanelComponent`.
- New element fields: type in `element/src/types.ts`, then the factory in `newElement.ts`, then the default in `restore.ts`, then the renderers (canvas and SVG). Collab and history pick the field up through version bumps and deltas (`element/src/delta.ts`).

## Sample files inspected
- packages/excalidraw/actions/actionProperties.tsx (kind: action/handler)
- packages/element/src/newElement.ts (kind: factory/service)
- packages/element/src/types.ts (kind: model)
- packages/excalidraw/data/restore.ts (kind: data/restore)
- packages/excalidraw/data/reconcile.ts (kind: data/collab)
- packages/element/src/renderElement.ts (kind: canvas render)
- packages/excalidraw/renderer/staticSvgScene.ts (kind: svg render)
- packages/excalidraw/wysiwyg/textWysiwyg.tsx (kind: editor; signature + textarea creation only)
- packages/element/tests/textElement.test.ts, packages/excalidraw/wysiwyg/textWysiwyg.test.tsx, packages/excalidraw/tests/scene/export.test.ts (kind: test)
- vitest.config.mts, tsconfig.json, .eslintrc.json (kind: config)
Note: most core files are over 500 lines (renderElement 1416, restore 1429, textWysiwyg 1333, staticSvgScene 936). Only targeted ranges were read.

## Notes for downstream codegen
- Use `app.ownerDocument`/`app.ownerWindow`, never bare `document`/`window`, for new DOM work (AGENTS.md).
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` instead of `Omit<…> & …` (AGENTS.md).
- Prefer readonly/immutable data, `?.`/`??` and allocation-free hot paths (copilot-instructions), especially in render loops.
- New element fields must be optional-safe: default them in `restore.ts` and in `newTextElement`, and keep them JSON-serialisable.
- Every colour reaching canvas or SVG goes through `applyDarkModeFilter`.
- Respect the `import/order` grouping. Lint runs with `--max-warnings=0`.
- Expect snapshot churn. Run `yarn test:update` on purpose and review the diffs.
