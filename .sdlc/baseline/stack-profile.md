# Stack profile: learned from a scan of this repo

Built 2026-11-05 for run `20261105-000000-feature-new-rich-text-spans`. This is a Tier 2b profile: React/TS has no pre-authored adapter.

## Language & runtime
- TypeScript 5.9 with `"strict": true`, `"target"`/`"module": "ESNext"` and `"jsx": "react-jsx"` (root `tsconfig.json`). Node >=18, yarn 1.22.22 workspaces.
- ESM only.
- Imports between packages use aliases: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/excalidraw/...` and `@excalidraw/element/types`. vitest resolves them through `vitest.config.mts` and the build through tsconfig paths. Within a package, imports are relative.

## Framework
- React 19 component library (`packages/excalidraw`) on top of framework-free model packages:
  - `packages/element`: the element model, mutation, rendering and text measurement
  - `packages/common`: constants, colours, utils
  - `packages/math`
- The app is `excalidraw-app` (Vite, Firebase plus socket.io collaboration).
- The editor core is one big class component, `packages/excalidraw/components/App.tsx`, split into helper modules `App.<concern>.ts` (`App.text.ts`, `App.clipboard.ts`, ...). These are reached as `this.text.*` and similar.

## Conventions detected

### File naming
- camelCase for modules: `textElement.ts`, `renderElement.ts`, `staticSvgScene.ts`, `textWysiwyg.tsx`.
- PascalCase for React components: `Stats/FontSize.tsx`.
- Actions are named `actionXxx.ts(x)`: `actions/actionTextAutoResize.ts`.
- Tests:
  - next to the code (`wysiwyg/textWysiwyg.test.tsx`), or
  - under `packages/<pkg>/tests/` (`packages/element/tests/textElement.test.ts`), or
  - under `packages/excalidraw/tests/**` (`tests/data/restore.test.ts`).

### Import layout
- Imports come in groups separated by blank lines: `@excalidraw/common`, then `@excalidraw/element` (often several separate import statements), then `import type`, then local relative imports, then local `import type`.
- `import type` is always separate from value imports.

### Handler / controller shape (actions)
```ts
import { register } from "./register";

export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown) => { ... },
  perform: (elements, appState, targetElement, app) => { ... },
});
```
`register()` adds the action to a module-level list (`actions/register.ts`), and `actions/index.ts` re-exports it.

### Element model / mutation shape
- Elements are immutable `Readonly<…>` types in `packages/element/src/types.ts`. Updates go through these functions, all of which bump `version`, `versionNonce` and `updated` (the collaboration reconciler relies on this):
  - `newElementWith(el, updates)`: returns a copy
  - `mutateElement(el, elementsMap, updates)`: mutates in place
  - `scene.mutateElement(...)`: mutates and triggers a re-render
- Optional or new element fields are typed `T | null` and get defaults in `data/restore.ts` (see `baseFontSize`).
```ts
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  elementsMap: ElementsMap,
  updates: ElementUpdate<TElement>,
  options?: { isDragging?: boolean; ... },
) => {
```

### Test shape
- vitest with globals (`describe`/`it`/`expect`, `vi` from "vitest"), jsdom and vitest-canvas-mock.
- Elements are built with the `API.createElement({ type: "text", ... })` helper (`packages/excalidraw/tests/helpers/api`).
- UI is driven with `Keyboard`, `Pointer` and `UI` from `tests/helpers/ui`, `render(<Excalidraw/>)` from `tests/test-utils`, and the `getTextEditor` / `updateTextEditor` DOM queries.
- Snapshot tests are used widely (`__snapshots__/*.snap`).
```ts
describe("resolveColorTarget", () => {
  const label = API.createElement({ type: "text", id: "label", containerId: "note" });
  it("follows the active tool when nothing is targeted", () => {
    const regular = resolveColorTarget(appState(), elements, "strokeColor");
    expect(regular.kind).toBe("regular");
```

### Config
- Vite env vars `VITE_APP_*` in tracked `.env.development`, `.env.production` and `.env.test`, read through `import.meta.env`. No runtime validator.
- Editor defaults live in `packages/common/src/constants.ts` and `colors.ts`.

### Data layer
- No ORM. The scene is an in-memory element array:
  - `Scene`, with `Store` and `Delta` (`packages/element/src/store.ts`, `delta.ts`) for history.
  - Persistence is JSON (`packages/excalidraw/data/json.ts` / `restore.ts`), plus Firebase and localStorage in `excalidraw-app/data`.
- Collaboration reconciles whole elements by `version`/`versionNonce` (`packages/excalidraw/data/reconcile.ts`).

### Framework-owned wiring
- Actions: `register()` plus a re-export in `actions/index.ts`, rendered through `actionManager.renderAction("name")`.
- Text editing: `App.text.ts#handleTextWysiwyg` → `wysiwyg/textWysiwyg.tsx`.
- Rendering:
  - canvas: `packages/element/src/renderElement.ts`, with an offscreen element-canvas cache
  - SVG: `packages/excalidraw/renderer/staticSvgScene.ts#renderElementToSvg`, called from `scene/export.ts`

## Sample files inspected
- packages/excalidraw/actions/actionTextAutoResize.ts (kind: action/handler)
- packages/excalidraw/actions/register.ts (kind: wiring)
- packages/element/src/mutateElement.ts (kind: service/model)
- packages/element/src/types.ts (kind: model types)
- packages/excalidraw/data/restore.ts (kind: data migration)
- packages/excalidraw/components/Stats/FontSize.tsx (kind: component)
- packages/excalidraw/tests/colorTargets.test.ts, packages/excalidraw/wysiwyg/textWysiwyg.test.tsx, packages/element/tests/textElement.test.ts (kind: test)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Every new element field needs all of these:
  - its type in `types.ts`
  - a default in `newElement.ts` and a normalising branch in `restore.ts`
  - handling in duplicate, clipboard and transform where relevant
  - SVG and canvas rendering
- Expect snapshot churn (`yarn test:update`).
- Follow AGENTS.md:
  - Use `app.ownerDocument` / `app.ownerWindow`, never the global `document` / `window`.
  - Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` for type overrides.
- Avoid allocations in render hot paths. `renderElement` runs per frame and caches per-element canvases keyed on the element's version.
- Prettier 2.6 (`@excalidraw/prettier-config`) and eslint with `--max-warnings=0`. Trailing commas, double quotes.
