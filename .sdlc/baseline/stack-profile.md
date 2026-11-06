# Stack profile - learned from repo scan

Built 2026-11-05 for run `20261105-213840-feature-new-rich-text-spans` at HEAD `14bb42ed`. Tier 2b ran because no adapter matches React + TypeScript (generic.md is the fallback).

## Language & runtime
TypeScript 5.9 with `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx`, `noEmit` (tsc is a typecheck only). ESM throughout. Node >= 18. Yarn 1.22 classic workspaces. React 19.

## Framework
A React component library (`@excalidraw/excalidraw`) plus a Vite app (`excalidraw-app`). There's no server framework. State lives in a large class component (`packages/excalidraw/components/App.tsx`, ~11.5k lines) whose behaviour is split into `App.<concern>.ts` helper modules (`App.text.ts`, `App.wrap.ts`, `App.textTool.ts`, ...). jotai handles some UI state. Packages are built with esbuild; the app is built with Vite.

## Conventions detected

### File naming
- Element-logic modules are camelCase `.ts`: `packages/element/src/textElement.ts`, `textWrapping.ts`, `mutateElement.ts`.
- React components are PascalCase `.tsx` with a sibling `.scss` (plain SCSS imported for its side effects, **not** CSS modules, even though copilot-instructions say otherwise): `components/CheckboxItem.tsx` + `CheckboxItem.scss`.
- Actions: `actions/action<Name>.ts(x)`, e.g. `actionToggleWrap.ts`, `actionProperties.tsx`.
- Tests: `<module>.test.ts(x)` either in `packages/<pkg>/tests/` or alongside the source (`packages/excalidraw/actions/actionFlip.test.tsx`, `wysiwyg/textWysiwyg.test.tsx`). Snapshots go in `__snapshots__/`.

### Import shape (eslint `import/order`, enforced)
Groups are builtin, external, then `@excalidraw/**` (placed after external), then parent/sibling, with **type imports last** and blank lines between groups:
```ts
import { getLineHeight } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  computeContainerDimensionForBoundText,
  getContainerCoords,
} from "../src/textElement";

import type { ExcalidrawTextElementWithContainer } from "../src/types";
```
Cross-package imports use the aliases (`@excalidraw/common`, `@excalidraw/element`, `@excalidraw/element/types`, `@excalidraw/common/utility-types`). Imports inside a package are relative.

### Element type shape (data model)
Elements are `Readonly<{...}>` intersections over `_ExcalidrawElementBase`, with JSDoc on each non-obvious field (`packages/element/src/types.ts`):
```ts
export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: "text";
    fontSize: number;
    fontFamily: FontFamilyValues;
    baseFontSize: number | null;
    text: string;
    originalText: string;
    autoResize: boolean;
    lineHeight: number & { _brand: "unitlessLineHeight" };
    labelPosition?: number | null;
  }>;
```
A new persisted field must be wired through: `types.ts`, then `newElement.ts` (`newTextElement` opts plus defaults), then `data/restore.ts` (`case "text"` in `restoreElementWithProperties`, defaulting legacy data), then the renderers (canvas `renderElement.ts`, SVG `renderer/staticSvgScene.ts`). Mutations go through `scene.mutateElement` / `newElementWith` (`mutateElement.ts`), which bump `version`/`versionNonce`. Collaboration reconciles **whole elements** by version (`data/reconcile.ts#shouldDiscardRemoteElement`), so a new field gets synced automatically as long as the change bumps the version.

### Handler / action shape
Actions are objects passed to `register(...)` and re-exported from `actions/index.ts`:
```ts
export const actionToggleWrap = register({
  name: "toggleWrap",
  label: "labels.toggleWrap",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => app.wrap.toggle(elements, appState),
  keyTest: (event, appState, elements, app) =>
    !event[KEYS.CTRL_OR_CMD] && matchKey(event, KEYS.W) && /* ... */,
});
```
Labels are i18n keys in `packages/excalidraw/locales/en.json`. Style actions (stroke/background colour, font size) live in `actions/actionProperties.tsx` and use `PanelComponent` to render the properties panel.

### Component shape
Functional components typed `React.FC<{...}>` with inline prop types and `clsx` for class names:
```tsx
export const CheckboxItem: React.FC<{
  checked: boolean;
  onChange: (checked: boolean, event: React.MouseEvent) => void;
  className?: string;
}> = ({ children, checked, onChange, className }) => (
  <div className={clsx("Checkbox", className, { "is-checked": checked })}> ...
```

### Rendering
- Canvas (`packages/element/src/renderElement.ts`): text is drawn line by line with `context.fillText(lines[i], horizontalOffset, i * lineHeightPx + verticalOffset)`, with the fill taken from `element.strokeColor`, onto a per-element cached canvas (`elementWithCanvasCache` WeakMap, so a cache key change is needed when render-affecting fields change).
- SVG (`packages/excalidraw/renderer/staticSvgScene.ts`): one `<text>` per line, created via `svgRoot.ownerDocument.createElementNS(SVG_NS, "text")`, with `fill` set by `applyDarkModeFilter(element.strokeColor, theme === DARK)`, `text-anchor` from align/RTL, and `white-space: pre`. Mixed-style spans would mean `<tspan>` children.
- DOM access must use `ownerDocument`/`ownerWindow` (AGENTS.md), never global `document`/`window`.

### Editing
`packages/excalidraw/wysiwyg/textWysiwyg.tsx` is a **plain `<textarea>`** overlay. It can't represent per-range styling, so range selection has to come from `textarea.selectionStart/End`.

### Test shape
Vitest with globals (`describe`/`it`/`expect`), jsdom, `vitest-canvas-mock` (where `measureText` width equals `text.length`). Unit tests build elements with `API.createElement({ type, ... })` from `@excalidraw/excalidraw/tests/helpers/api`. Integration tests render `<Excalidraw handleKeyboardGlobally />` and drive it through `UI`, `Keyboard` and `Pointer` helpers (`tests/helpers/ui`), reading state from `window.h`:
```tsx
const { h } = window;
const mouse = new Pointer("mouse");
describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });
  it("should copy & paste styles via keyboard", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);
```
SVG export tests live in `packages/excalidraw/tests/export.test.tsx` and `tests/scene/`. Snapshot updates come from `yarn test:update`.

### Config
Vite env via `import.meta.env.VITE_APP_*` (`.env.development` / `.env.production`, tracked). There's no runtime config validator. Path aliases are duplicated in `tsconfig.json#paths` and `vitest.config.mts#resolve.alias`.

### Data layer
There's no ORM. Scenes are JSON (`data/json.ts`, `data/restore.ts`); the app persists to localStorage/IndexedDB and Firebase, and collaboration runs over socket.io with encrypted element payloads (`excalidraw-app/collab/`). Backward compatibility comes from `restore.ts` defaulting missing fields.

### Framework-owned wiring
- New action: `register({...})` in `actions/action*.ts(x)`, re-exported in `actions/index.ts`, with its name added to the `ActionName` union in `actions/types.ts`.
- New element field: see "Element type shape" above. Also check `packages/element/src/duplicate.ts`, clipboard (`clipboard.ts`) and `actionStyles.ts` (copy/paste styles) for field lists.
- New UI strings go only in `locales/en.json`.

## Sample files inspected
- packages/element/src/types.ts (kind: model)
- packages/element/src/newElement.ts (kind: factory)
- packages/excalidraw/data/restore.ts (kind: migration/restore)
- packages/excalidraw/data/reconcile.ts (kind: collab)
- packages/element/src/renderElement.ts (kind: canvas renderer)
- packages/excalidraw/renderer/staticSvgScene.ts (kind: SVG export)
- packages/excalidraw/actions/actionToggleWrap.ts, actionProperties.tsx, register.ts (kind: action)
- packages/excalidraw/components/CheckboxItem.tsx, ButtonSeparator.tsx, App.text.ts (kind: component)
- packages/element/tests/textElement.test.ts, textWrapping.test.ts (kind: unit test)
- packages/excalidraw/tests/actionStyles.test.tsx (kind: integration test)
- tsconfig.json, vitest.config.mts, .eslintrc.json (kind: config)

## Notes for downstream codegen
- Keep element types `Readonly`; never mutate elements directly. Use `scene.mutateElement` / `newElementWith`.
- Every new persisted field needs a `restore.ts` default so older scenes and older collaborators still load.
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` rather than `Omit & ...` (AGENTS.md).
- Follow the import-order groups, with `import type` last. Prettier config is `@excalidraw/prettier-config` (trailing commas, double quotes).
- Wrapped text is stored in `text` (with inserted newlines) while `originalText` holds the user's text. Any per-character range model has to say which string its offsets index into and survive re-wrapping.
- Render cache: the canvas text render is cached per element, so make sure the new styling invalidates it (version bump does).
- Expect snapshot churn in `__snapshots__` when element shape changes. Run `yarn test:update`, then `yarn test:typecheck`.
