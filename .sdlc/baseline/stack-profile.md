# Stack profile — learned from repo scan

Built from HEAD `14bb42ed` for run `20261102-103113-feature-new-text-range-styling`. Sampling followed the
kinds this repo actually has rather than controllers and services, as the caller directed. Most of the named
files exceed the usual 500-line bound, so they were read by focused range, and the step ran past its nominal
20-second timebox. Findings below come from reading the code; nothing was executed.

## Language & runtime

TypeScript 5.9 with `strict`, `noFallthroughCasesInSwitch`, `isolatedModules`, ESM, `moduleResolution: bundler`,
and `jsx: react-jsx`. React 19 in the app, with `^17 || ^18 || ^19` as the library peer range. Yarn 1.22
workspaces; `engines.node >=18`; CI runs Node 20. Internal packages resolve through path aliases in both
`tsconfig.json` and `vitest.config.mts`, so a new package would need both updated.

## Framework

React component library plus a canvas editor engine, not a route-based app. Layers run
`common` and `math` -> `element` -> `excalidraw` -> `excalidraw-app`. State lives in the `App` class component,
split into helper classes such as `App.text.ts`, with jotai through app-specific modules. Packages build with
esbuild, the app with Vite. Text and shapes render to canvas with roughjs; SVG export is a separate renderer.

## Conventions detected

### File naming
- Element logic is camelCase `.ts`: `textElement.ts`, `mutateElement.ts`, `stickyNote.ts`.
- Actions are `actionXxx.ts(x)` with a co-located `actionXxx.test.tsx`.
- Components are PascalCase; `App.text.ts` and `App.clipboard.ts` split `App` by concern.
- Tests live in three places: co-located `*.test.tsx`, `packages/*/tests/`, and `packages/element/src/__tests__/`.

### Repo rules that bind generated code
- `AGENTS.md`: new DOM/browser API use goes through `app.ownerDocument` / `app.ownerWindow`; without `app`, derive
  them from the mounted node. Override types with `Merge<Base, Overrides>` from `@excalidraw/common/utility-types`.
- ESLint: `consistent-type-imports` with separate type imports, `import/order`, `--max-warnings=0`, no direct
  `jotai` imports, and no barrel imports inside `packages/excalidraw`.
- `.github/copilot-instructions.md`: prefer immutable data and allocation-free code; use the `Point` type from
  `packages/math/src/types.ts` rather than `{ x, y }`.

### Element types and mutation
Elements are `Readonly` intersection types in `packages/element/src/types.ts`. Text is a flat object with no
style sub-structure, and new fields get a JSDoc block (`packages/element/src/types.ts:279`):

```ts
/**
 * Unitless line height (aligned to W3C). To get line height in px, multiply
 *  with font size (using `getLineHeightInPx` helper).
 */
lineHeight: number & { _brand: "unitlessLineHeight" };
```

Three mutation paths exist, and they are not interchangeable:

- `mutateElement(element, elementsMap, updates)` changes in place, bumps `version`/`versionNonce`/`updated`, and
  does not re-render.
- `scene.mutateElement(element, updates)` does the same and triggers a scene update.
- `newElementWith(element, updates)` returns a new object. Actions and the text editor use this.

### Action shape (the "handler" of this repo)
Registered with `register<T>()`, listed in the `ActionName` union in `actions/types.ts`, exported from
`actions/index.ts`. `packages/excalidraw/actions/actionProperties.tsx:1561`:

```ts
export const actionChangeTextAlign = register<TextAlign>({
  name: "changeTextAlign",
  label: "Change text alignment",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(elements, appState, (oldElement) => {
        if (isTextElement(oldElement)) {
          const newElement: ExcalidrawTextElement = newElementWith(
            oldElement, { textAlign: value },
          );
          redrawTextBoundingBox(newElement, app.scene.getContainerElement(oldElement),
            app.scene, app.renderEnvironment);
          return newElement;
        }
        return oldElement;
      }, true),
      appState: { ...appState, currentItemTextAlign: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
```

`PanelComponent` renders `fieldset` > `RadioSelection`, reads state with `getFormValue`, and wraps `updateData` in
`withCaretPositionPreservation` so panel use during editing keeps the caret. Labels go through `t("labels.x")`,
added to `packages/excalidraw/locales/en.json` only; Crowdin owns the other locale files.

### Text rendering
Canvas (`packages/element/src/renderElement.ts:677`) sets one font and one fill for the whole element, then draws
each line of the wrapped `element.text`:

```ts
context.font = getFontString(element);
const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
for (let index = 0; index < lines.length; index++) {
  context.fillText(lines[index], horizontalOffset, index * lineHeightPx + verticalOffset);
}
```

SVG (`packages/excalidraw/renderer/staticSvgScene.ts:815`) mirrors this with one `<text>` per line, setting
`textContent` plus `font-family`, `font-size`, `fill`, `text-anchor` and `style="white-space: pre;"`. Both compute
direction once per element with `isRTL(element.text)`. PNG export uses the canvas path via `renderConfig.isExporting`.

### Text editor
`packages/excalidraw/wysiwyg/textWysiwyg.tsx:533` is a plain `<textarea>`, and its contract is strings only:
`onChange(nextOriginalText)` and `onSubmit({ viaKeyboard, nextOriginalText })`. It already accepts
`initialSelection: { start, end }` as `originalText` offsets. The element being edited is not painted on the local
canvas (`packages/excalidraw/scene/Renderer.ts:259`). `App.text.ts` (`handleTextWysiwyg`) owns the lifecycle and
writes through `newElementWith` plus `refreshTextDimensions`.

### Layout
`getFontString` (`packages/common/src/utils.ts:153`) encodes only size and family, and it is also the key of the
`charWidth` cache. `getWrappedTextLines` (`packages/element/src/textWrapping.ts:448`) returns visual lines with
`{ text, start, end }` code-unit offsets into `originalText`. Its header calls out rich-text mapping as a future
use. Only `textWysiwyg.tsx` calls it today; everything else calls `wrapText`, which drops the offsets.

### Config
Vite env vars through `import.meta.env`, from tracked `.env.development`, `.env.production` and `.env.test`.
Constants live in `packages/common/src/constants.ts`, and app defaults in `packages/excalidraw/appState.ts` with a
per-key `{ browser, export, server }` persistence config.

### Data layer
No ORM. Persistence is versioned JSON (`VERSIONS.excalidraw = 2`) with restore-time normalization instead of
migrations. `packages/excalidraw/data/restore.ts:577` lists each text prop explicitly:

```ts
element = restoreElementWithProperties(element, {
  fontSize, fontFamily, text,
  textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
  originalText: element.originalText || text,
  autoResize: element.autoResize ?? true,
  lineHeight,
  labelPosition: isFiniteNumber(element.labelPosition)
    ? clamp(element.labelPosition, 0, 1)
    : null,
```

`restoreElementWithProperties` spreads `...element` first, so unknown props survive for forward compatibility.
Validate-and-clamp is the local idiom for bad input. `newTextElement` must set the same field, and
`packages/element/src/transform.ts` and the skeleton docs cover programmatic creation.

### Reconciliation, delta and history
- Collab (`packages/excalidraw/data/reconcile.ts:23`) is whole-element last-write-wins on `version`, tie-broken by
  the lowest `versionNonce`. A remote update is discarded while the local user edits that element.
- History and store (`packages/element/src/delta.ts`, `store.ts`) detect change by `versionNonce`, then diff per
  top-level key. `ElementsDelta.applyDelta` replaces each key in the delta via `newElementWith`. Only
  `boundElements` merges as a diff; `stripIrrelevantProps` removes only `id` and `updated`.
- Key comparison uses `!==`, then `isShallowEqual`, which compares array entries by identity.

### Framework-owned wiring
A new action needs: the `register` call, an `ActionName` entry, an `actions/index.ts` export, `PanelComponent`
placement in `components/Actions.tsx`, and `en.json` strings. Persisted app-state keys need `appState.ts` config.
Feature changes get a `packages/excalidraw/CHANGELOG.md` entry, newest first, with a PR link.

### Test shape
Vitest with `globals: true`, jsdom, `vitest-canvas-mock`, and `setupTests.ts`. Editor tests render the real
component and drive it with helpers (`packages/excalidraw/actions/actionProperties.test.tsx`):

```tsx
describe("element locking", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });
  it("should show active background top picks", () => {
    UI.clickTool("rectangle");
    API.setAppState({ currentItemBackgroundColor: color });
```

Helpers: `API.createElement`, `API.setElements`, `API.executeAction`, `UI`, `Keyboard`, `Pointer`, `getTextEditor`
and `updateTextEditor` (both typed around `HTMLTextAreaElement`). Pure logic uses plain `describe/it` with
`API.createElement` and `toEqual`; `reconcile.test.ts` builds elements through local helpers; `restore.test.ts`
uses `toMatchSnapshot`. Coverage thresholds: lines 60, branches 70, functions 63, statements 60.

## Sample files inspected
- `packages/element/src/types.ts` (kind: element types)
- `packages/element/src/mutateElement.ts` (kind: mutation)
- `packages/element/src/newElement.ts` (kind: element construction)
- `packages/element/src/renderElement.ts` (kind: canvas rendering)
- `packages/element/src/textElement.ts` (kind: bound text layout)
- `packages/element/src/textWrapping.ts` (kind: wrapping)
- `packages/element/src/textMeasurements.ts` (kind: measurement)
- `packages/element/src/listMarker.ts` (kind: text mutation outside the editor)
- `packages/element/src/delta.ts` (kind: history delta)
- `packages/element/src/shape.ts` (kind: cache invalidation)
- `packages/excalidraw/renderer/staticSvgScene.ts` (kind: SVG export)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (kind: text editor)
- `packages/excalidraw/components/App.text.ts` (kind: editor lifecycle)
- `packages/excalidraw/scene/Renderer.ts` (kind: render filtering)
- `packages/excalidraw/data/restore.ts` (kind: restore)
- `packages/excalidraw/data/reconcile.ts` (kind: reconciliation)
- `packages/excalidraw/actions/actionProperties.tsx`, `register.ts`, `types.ts` (kind: actions)
- `packages/excalidraw/fonts/` (kind: font faces)
- `packages/excalidraw/actions/actionProperties.test.tsx`, `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx`,
  `packages/excalidraw/tests/data/restore.test.ts`, `packages/excalidraw/tests/data/reconcile.test.ts`,
  `packages/element/tests/textElement.test.ts`, `packages/element/tests/delta.test.tsx` (kind: tests)

## Notes for downstream codegen

These are specific to text range styling. Items marked "by reading" were traced in the code but not exercised.

1. **No style model exists.** The element model has no bold, italic, underline or run concept. A repo-wide search
   found 7 `fontWeight` hits, all UI chrome. This is a new persisted schema, not an extension of one.
2. **Decide paint-only versus metric-changing styles first.** This sets the feature's size. Paint-only styles
   (color, underline, strikethrough, highlight) leave wrapping alone. Anything that changes glyph widths (bold,
   italic, size, family) makes `getFontString`-based layout wrong: 12 non-test `wrapText` call sites in 9 files,
   non-test `measureText` calls in 11 files, and the `charWidth` cache all assume one font per element.
3. **Anchor ranges to `originalText`, not `text`.** The editor edits `originalText`; renderers draw the wrapped
   `text`. `getWrappedTextLines` gives the mapping, but renderers do not call it today.
4. **Those offsets have a trap (by reading).** `parseTokens` runs `line.normalize("NFC")`, while `wrapLine` advances
   `tokenOffset` by normalized token length. `normalizeText` does not apply NFC. For decomposed input on a line
   that actually wraps, offsets can drift despite the code-unit promise, and the rendered string can differ from
   the source. Lines that fit take a fast path and are unaffected. Trailing whitespace trimmed at a soft break is
   also missing from the rendered line. Test with decomposed text and with wrapped lines.
5. **Invalidate the canvas cache.** `elementWithCanvasCache` is a WeakMap keyed by element object. `mutateElement`
   only clears it when `width`, `height`, `fileId` or `points` change, and `generateElementWithCanvas` checks no
   version. A style change through `mutateElement` that keeps dimensions would paint stale text. Use
   `newElementWith`, as actions already do, or extend the invalidation.
6. **Keep offsets valid when text changes without the editor.** `originalText` is also rewritten by
   `packages/element/src/listMarker.ts` (`setText`, reached when duplicating auto-numbers list items, through
   `advanceDuplicatedListMarkers` / `applyListMarkerAdvances`) and `restore.ts:601`. `textWysiwyg` reports only the
   final string, so edits must be diffed to remap ranges.
7. **Expect desync, and clamp (by reading).** Delta applies only the keys it holds. If ranges are a separate prop
   from `originalText`, undoing one after an interleaved remote edit of the other leaves stale offsets. Older
   clients also keep an unknown prop through restore while editing text without remapping it. Validate at
   `restore.ts` and render defensively. Storing ranges and text as one replaced value would reduce this.
8. **Never mutate a range array or its objects in place.** Delta compares entries by identity, so an in-place change
   is invisible to history. Fresh identical objects only add noise.
9. **Renderers need per-run layout.** Canvas needs per-run x offsets, including `textAlign` center/right, because
   `fillText` is anchored per line. SVG needs `<tspan>` children or sequenced `<text>`. Both currently decide RTL
   per element, so mixed-direction runs need explicit design.
10. **The editor cannot show styled ranges today.** A `<textarea>` has no mixed formatting and the canvas skips the
    edited element. Replacing it touches a 1,333-line editor, a 3,597-line test file, and helpers typed to
    `HTMLTextAreaElement`. Applying styles to a selection without live preview is a much smaller change.
11. **Fonts limit bold and italic.** Going by font file names, no element font ships a bold or italic face; only
    the UI font Assistant has multiple weights. Bold or italic on canvas would be browser-synthesized, so verify that SVG export
    with its embedded subset fonts matches.
12. **Other places a new text field must reach:** `newTextElement` opts, `restore.ts`, `transform.ts`, and the paste
    styles path (`actionStyles.ts:141-158`), which copies text props explicitly.
13. **Snapshots will churn if `newTextElement` always sets the field.** Text elements appear in
    `history.test.tsx.snap` (27 `originalText` lines), `transform.test.ts.snap` (25) and `restore.test.ts.snap` (2).
    Leaving the field absent when no ranges exist avoids this and keeps files small.
