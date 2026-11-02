# Stack profile — learned from repo scan

Built 2026-11-02 at `14bb42ed`. Trigger: React/TypeScript has no pre-authored adapter.

## Language & runtime

TypeScript 5.9 with `strict`, ESM, `moduleResolution: bundler`, `jsx: react-jsx`, target ESNext. React 19. Yarn 1 workspaces. Node `>=18`; CI uses 20.x. esbuild builds packages, Vite builds the app.

## Framework

No application framework. A published React component (`@excalidraw/excalidraw`) over framework-free element logic (`@excalidraw/element`), with a thin host app (`excalidraw-app`). Rendering is imperative canvas and SVG, not React.

Dependency direction: `common` and `math` (which import each other) sit lowest, then `element`, then `excalidraw`, then `excalidraw-app`. A scan of `packages/element/src` found type-only imports from `@excalidraw/excalidraw` and no runtime imports, so keep it that way.

## Conventions detected

### File naming

- camelCase modules: `packages/element/src/listMarker.ts`, `packages/excalidraw/data/reconcile.ts`
- PascalCase components: `packages/excalidraw/components/InlineIcon.tsx`
- `App.<area>.ts` splits of the App class: `packages/excalidraw/components/App.text.ts`
- `action<Name>.ts(x)` for actions: `packages/excalidraw/actions/actionTextAutoResize.ts`
- Named exports, arrow-function consts

### Handler / controller shape

User operations are registered actions. Each returns new elements plus a `captureUpdate` that controls undo history.

```ts
export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown) => { /* ... */ },
  perform: (elements, appState, targetElement, app) => {
    /* ... */
    return {
      appState,
      elements: elements.map((element) =>
        element.id === resized.id ? resized : element,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
```

UI-bearing actions add `PanelComponent` and `keyTest` (`packages/excalidraw/actions/actionLink.tsx`). New names must join the `ActionName` union in `packages/excalidraw/actions/types.ts`.

### Service shape

Domain logic is plain functions taking the element, the scene and `renderEnvironment` as arguments. Text changes go through `scene.mutateElement` and re-measure (`packages/element/src/listMarker.ts`):

```ts
if (container) {
  scene.mutateElement(element, { originalText });
  // re-wraps the label, and grows the container if need be
  redrawTextBoundingBox(element, container, scene, renderEnvironment);
} else {
  scene.mutateElement(element, {
    originalText,
    // re-wraps the text, and keeps it anchored as per its alignment
    ...refreshTextDimensions(
      element,
      null,
      scene.getNonDeletedElementsMap(),
      originalText,
      undefined,
      renderEnvironment,
    ),
  });
}
```

Element types are `Readonly<{ ... }>` intersections, and fields carry a doc comment on anything non-obvious (`packages/element/src/types.ts`). Comments explain why, not what.

### Test shape

Vitest with globals and jsdom, via `setupTests.ts` and `vitest-canvas-mock`. Three locations: `packages/*/tests/`, `packages/element/src/__tests__/`, and beside the source (`packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`).

```ts
describe("Test wrapText", () => {
  // `measureText` width is mocked to return `text.length` by `jest-canvas-mock`
  const font = "10px Cascadia, Segoe UI Emoji" as FontString;

  it("should wrap the text correctly when word length is exactly equal to max width", () => {
    const text = "Hello Excalidraw";
    const res = wrapText(text, font, 100);
    expect(res).toEqual(`Hello\nExcalidraw`);
  });
});
```

UI tests use `API`, `Keyboard`, `Pointer` and `UI` from `packages/excalidraw/tests/helpers/`, `render` from `tests/test-utils`, and the global `h` (`const { h } = window`). Text width in tests comes from the canvas mock, not real fonts (see the comment in `packages/element/tests/textWrapping.test.ts`).

### Config

Env via Vite with `envDir: "../"` (repo root `.env.*`, tracked). Read as `import.meta.env.VITE_*`. No runtime validator. Shared constants live in `packages/common/src/constants.ts`.

### Data layer

No ORM or database schema. Scenes are JSON element arrays. `restoreElements` normalises incoming elements, including on the collab socket path (`excalidraw-app/collab/Collab.tsx`, before `reconcileElements`) and the Firestore path (`excalidraw-app/data/firebase.ts`). Each type lists its fields:

```ts
element = restoreElementWithProperties(element, {
  fontSize,
  fontFamily,
  text,
  textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
  containerId: element.containerId ?? null,
  originalText: element.originalText || text,
  autoResize: element.autoResize ?? true,
  lineHeight,
});
```

`restoreElementWithProperties` spreads `...element` first ("to not lose unknown ones"), so an unlisted field survives restore but is never validated or defaulted. Malformed data from files or peers reaches the renderer unless `restore.ts` normalises it.

Persistence is encrypted Firestore (`excalidraw-app/data/firebase.ts`) and collab is socket.io. Sync is whole-element: `reconcile.ts` keeps the higher `version`, then the lower `versionNonce`, and discards remote updates to the element being edited locally.

### Framework-owned wiring

- Actions: `register(...)` runs when the module is imported, and the name joins `ActionName`. Most actions export through `packages/excalidraw/actions/index.ts`; some are imported directly (`actionTextAutoResize` in `packages/excalidraw/components/App.text.ts`).
- Public exports: `packages/element/src/index.ts` is a barrel of `export *`.
- Aliases: `@excalidraw/*` maps to source in `vitest.config.mts` and `excalidraw-app/vite.config.mts`.
- Strings: `t("...")` keyed from `packages/excalidraw/locales/en.json`.

## Sample files inspected

- `packages/excalidraw/actions/actionTextAutoResize.ts` (kind: action)
- `packages/excalidraw/actions/actionBoundText.tsx` (kind: action)
- `packages/excalidraw/actions/actionLink.tsx` (kind: action)
- `packages/element/src/listMarker.ts` (kind: service)
- `packages/element/src/containerCache.ts` (kind: service)
- `packages/excalidraw/data/reconcile.ts` (kind: service)
- `packages/excalidraw/components/InlineIcon.tsx` (kind: component)
- `packages/element/tests/textWrapping.test.ts` (kind: test)
- `excalidraw-app/tests/collab.test.tsx` (kind: test)
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (kind: test, header only)
- `packages/excalidraw/tests/data/restore.test.ts` (kind: test, header only)
- `excalidraw-app/data/firebase.ts` (kind: data layer, excerpt)
- `excalidraw-app/index.tsx` (kind: entry point)
- `excalidraw-app/vite.config.mts`, `tsconfig.json`, `.eslintrc.json`, `vitest.config.mts` (kind: config, grep or full)

Excerpts of `packages/element/src/renderElement.ts`, `packages/excalidraw/renderer/staticSvgScene.ts`, `packages/excalidraw/data/restore.ts` and `packages/element/src/types.ts` were read as seed surfaces. They exceed the 500-line sampling bound, so they are not convention samples.

## Notes for downstream codegen

- `AGENTS.md`: use `app.ownerDocument` and `app.ownerWindow` for new DOM usage, not globals. Prefer `Merge<Base, Overrides>` over `Omit<...> & Overrides`.
- `.github/copilot-instructions.md`: prefer `const`, `readonly`, `?.`, `??`, and low-allocation code in hot paths such as rendering.
- `import/order` is a warning, but `test:code` uses `--max-warnings=0`, so it fails lint. Observed order: external packages, `@excalidraw/*` (values and types), parent, sibling, then relative type imports. Run `yarn fix` rather than ordering by hand.
- Text has two forms. `originalText` is the unwrapped source, and `text` is derived from it with wrap newlines. The editor edits `originalText`; canvas and SVG both draw `text`, line by line. Offsets into one do not map directly onto the other.
- The editor is a plain `<textarea>`, which cannot show mixed colours within its value.
- Canvas and SVG each draw a line with a single `strokeColor` fill through `applyDarkModeFilter`, including RTL handling. Both paths must change together.
- Any element change must go through `mutateElement`, `newElementWith` or `bumpVersion`, or collab will not propagate it.
- Add new text fields to `newTextElement` and normalise them in `restore.ts` (restore keeps unknown fields but does not validate them), and check `delta.ts` for undo and redo.
- Commit style: `feat(editor): ...`, `fix(packages/excalidraw): ...`.
