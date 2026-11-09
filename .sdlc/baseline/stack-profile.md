# Stack profile — learned from repo scan

Built 2026-11-09 for run 20261109-120000-feature-new-text-styling (HEAD 14bb42ed). Why it was built: the stack is React + TypeScript, which has no pre-authored adapter (only generic/nest/python ship).

## Language & runtime
TypeScript 5.9, `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `isolatedModules`, `jsx: react-jsx`, `noEmit` (tsc is used only for type checking). ESM everywhere. Node >= 18. React 19. Yarn 1 workspaces (`excalidraw-app`, `packages/*`, `examples/*`). Packages are built with esbuild and the app with Vite 5. Tests use vitest 3 with jsdom, `vitest-canvas-mock` and Testing Library, configured by a single root `vitest.config.mts` and `setupTests.ts`.

## Framework
React component library (`@excalidraw/excalidraw`) plus the excalidraw.com app (`excalidraw-app`). Not an MVC/route framework: there are no controllers or services. The main units are:
- **Element model** (`packages/element/src/*`) — plain immutable-by-convention objects with `Readonly<>` types.
- **Actions** (`packages/excalidraw/actions/*`) — the command pattern, registered through `register()`.
- **`App` class component** (`packages/excalidraw/components/App.tsx`), split into `App.<concern>.ts` helper modules.
- **Renderers** — canvas (`packages/element/src/renderElement.ts`, `packages/excalidraw/renderer/staticScene.ts`) and SVG (`packages/excalidraw/renderer/staticSvgScene.ts`).
- **Data** (`packages/excalidraw/data/*`) — JSON serialise/restore and collab reconcile.

## Conventions detected

### File naming
- Modules use camelCase `.ts`: `textElement.ts`, `mutateElement.ts`, `staticSvgScene.ts`, `restore.ts`.
- React components use PascalCase `.tsx`, with a sibling `.scss` beside them: `Actions.tsx` + `Actions.scss`, `Avatar.tsx`.
- The `App` class is split by concern into `App.text.ts`, `App.textTool.ts`, `App.selection.ts`, `App.clipboard.ts`, and similar modules.
- Actions live in `actions/action<Name>.ts(x)`, with a co-located `action<Name>.test.tsx`.
- Tests are `*.test.ts` / `*.test.tsx`. Some sit beside the source (`wysiwyg/textWysiwyg.test.tsx`, `actions/actionProperties.test.tsx`); others sit in package `tests/` folders (`packages/element/tests/textElement.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`).

### Imports
Workspace path aliases are used rather than deep relative paths across packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/element/types`, `@excalidraw/math`, `@excalidraw/excalidraw/...`. Imports are grouped and separated by blank lines (external packages, then `@excalidraw/*`, then `import type` blocks, then local relative imports). Type-only imports use `import type`. ESLint enforces the import order.

### Element type shape (`packages/element/src/types.ts`)
```ts
export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: "text";
    fontSize: number;
    fontFamily: FontFamilyValues;
    /** JSDoc on every non-obvious field, incl. default + who owns it */
    baseFontSize: number | null;
    text: string;
    ...
    labelPosition?: number | null;
  }>;
```
New fields come with JSDoc, use `null` (not `undefined`) as the "unset" value, and are written into `newTextElement`, then defaulted and sanitised in `restore.ts`.

### Constructor shape (`packages/element/src/newElement.ts`)
```ts
export const newTextElement = (
  opts: {
    text: string;
    ...
    labelPosition?: ExcalidrawTextElement["labelPosition"];
    baseFontSize?: ExcalidrawTextElement["baseFontSize"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> => {
  ...
  const textElementProps: NonDeleted<ExcalidrawTextElement> = {
    ..._newElementBase<ExcalidrawTextElement>("text", opts),
    text,
    fontSize,
    baseFontSize: opts.baseFontSize ?? null,
```

### Mutation / versioning
Never assign to element fields directly. Use `newElementWith(el, updates)` (returns a new object) or `scene.mutateElement` / `mutateElement` (`packages/element/src/mutateElement.ts`). Both bump `version` and `versionNonce`. Collab reconcile depends on this.

### Action shape (`packages/excalidraw/actions/actionProperties.tsx`)
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
        hasStrokeColor(el.type) ? newElementWith(el, {...}) : el),
      appState: {...},
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (...),
});
```
Actions return `{ elements, appState, captureUpdate }`. `captureUpdate` (`IMMEDIATELY` / `EVENTUALLY` / `NEVER`) controls undo history. Labels are i18n keys (`packages/excalidraw/locales/en.json`).

### Restore / validation (`packages/excalidraw/data/restore.ts`)
```ts
case "text":
  ...
  element = restoreElementWithProperties(element, {
    fontSize, fontFamily, text,
    textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
    ...
    labelPosition: isFiniteNumber(element.labelPosition)
      ? clamp(element.labelPosition, 0, 1)
      : null,
  });
```
Every persisted field gets a defensive default or clamp here. Untrusted input (files, collab payloads, links) passes through this function.

### Collab reconcile (`packages/excalidraw/data/reconcile.ts`)
Whole-element last-writer-wins: a remote element is discarded if the local one is being edited, has a higher `version`, or has the same `version` and a `versionNonce` that is lower or equal. There is no per-field merge, so the styling of a text element travels and conflicts as part of the whole element.

### Renderers
- Canvas (`renderElement.ts` ~L660-715): splits `element.text` on `\n`, then calls `context.fillText(line, horizontalOffset, index * lineHeightPx + verticalOffset)` with `applyDarkModeFilter(element.strokeColor, theme === DARK)`.
- SVG (`staticSvgScene.ts` ~L779-845): one `<text>` per line, with `fill=applyDarkModeFilter(strokeColor)`, `text-anchor` from `textAlign`/RTL, and `style="white-space: pre;"`. DOM nodes are created through `svgRoot.ownerDocument.createElementNS(SVG_NS, ...)`, never the global `document` (see AGENTS.md).
- Both renderers must stay visually equivalent, and both must respect dark mode through `applyDarkModeFilter`.

### Test shape
```ts
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
describe("Test measureText", () => {
  it("should compute coords correctly when rectangle", () => {
    const element = API.createElement({ type: "rectangle", ...params });
    expect(getContainerCoords(element)).toEqual({ x: 15, y: 25 });
  });
});
```
Tests use vitest globals (`describe/it/expect`, `vi`). Helpers are `API` (`tests/helpers/api.ts`), `Keyboard`, `Pointer`, `UI` (`tests/helpers/ui.ts`), `render`, `GlobalTestState`, `act` (`tests/test-utils.ts`) and `getTextEditor` / `updateTextEditor` (`tests/queries/dom.ts`). Full-editor tests call `render(<Excalidraw />)`. Snapshot testing is used heavily (`__snapshots__/*.snap`).

### Config
Vite `import.meta.env.VITE_APP_*`, from committed `.env.development` / `.env.production`. Defaults and constants live in `@excalidraw/common` (`DEFAULT_TEXT_ALIGN`, `DEFAULT_FONT_SIZE`, `FONT_FAMILY`, `THEME`, `COLOR_PALETTE`, ...).

### Data layer
No ORM. Scenes are JSON (`data/json.ts` `serializeAsJSON`), restored with `data/restore.ts`. The app stores them in localStorage/IndexedDB (`excalidraw-app/data/LocalData.ts`), Firebase (`excalidraw-app/data/firebase.ts`), and encrypted socket.io broadcasts (`excalidraw-app/collab/Portal.tsx`).

### Framework-owned wiring
- Actions: `register({...})` in `actions/action*.ts(x)`, re-exported from `actions/index.ts`. UI panels come from `PanelComponent`, and shortcuts from `keyTest` and `actions/shortcuts.ts`.
- Element types: the union in `packages/element/src/types.ts`, guards in `typeChecks.ts`, and the public API through `packages/element/src/index.ts`.
- The text editor is created imperatively by `textWysiwyg({...})` from `App.text.ts`. It is a DOM `<textarea>` positioned over the canvas.

## Sample files inspected
- packages/element/src/types.ts (kind: model)
- packages/element/src/newElement.ts (kind: constructor)
- packages/element/src/mutateElement.ts (kind: mutation/versioning)
- packages/element/src/renderElement.ts (kind: canvas renderer)
- packages/excalidraw/renderer/staticSvgScene.ts (kind: svg renderer)
- packages/excalidraw/actions/actionProperties.tsx, actions/register.ts (kind: action/command)
- packages/excalidraw/data/restore.ts, data/reconcile.ts (kind: data/validation)
- packages/excalidraw/wysiwyg/textWysiwyg.tsx (kind: editor UI; > 500 lines, read only partially)
- packages/element/src/delta.ts (kind: history; partial)
- packages/element/tests/textElement.test.ts, packages/excalidraw/wysiwyg/textWysiwyg.test.tsx, packages/excalidraw/tests/data/restore.test.ts (kind: tests)
- vitest.config.mts, tsconfig.json (kind: config)

## Notes for downstream codegen
- Add new persisted fields in four places at minimum: the type in `types.ts`, `newTextElement`, the `restore.ts` text case (default + sanitise), and both renderers. Expect snapshot churn.
- Express "unset" as `null`. Keep fields JSON-serialisable (no Maps or class instances), because elements travel through JSON, Firebase and socket broadcasts.
- Change elements only through `newElementWith` / `mutateElement`, so `version` and `versionNonce` bump for collab.
- Nested arrays in element props compare by reference in `delta.ts`. Replace arrays immutably, never in place.
- Any character offsets must say whether they index `text` (wrapped) or `originalText` (unwrapped). Wrapping in `textWrapping.ts` rewrites `text` from `originalText`.
- The text editor is a plain `<textarea>`. Selection offsets come from `selectionStart` / `selectionEnd`, and in-editor styled preview is not possible without replacing the editor.
- Use `applyDarkModeFilter` for every colour you paint. Create SVG nodes through `svgRoot.ownerDocument`.
- Use `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` for type overrides (AGENTS.md).
- i18n: add new UI labels to `packages/excalidraw/locales/en.json` only.
- Add a Features entry under "Unreleased" at the top of `packages/excalidraw/CHANGELOG.md`.
- Commit style is Conventional Commits with a scope: `feat(editor): ...`, `fix(packages/excalidraw): ...`.
