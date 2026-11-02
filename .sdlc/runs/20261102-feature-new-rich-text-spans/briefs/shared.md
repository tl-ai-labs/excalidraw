## Conventions

- TypeScript strict, ESM. Formatting is Prettier 2.6 through @excalidraw/prettier-config (double quotes, trailingComma all, 80 columns) enforced by eslint-plugin-prettier; ESLint runs with --max-warnings=0, so an unused variable or a misordered import fails the build.
- Import order (import/order): external, then @excalidraw/* aliases, then parent, then sibling, then every `import type` statement last, with a blank line between groups. Type-only imports are always separate `import type { ... }` statements.
- Cross-package imports use aliases: @excalidraw/common, @excalidraw/math, @excalidraw/element (values) and @excalidraw/element/types (types). Inside packages/element use relative paths (./textStyleRanges). Inside packages/excalidraw never import from the package barrel ("..", "../index").
- Elements are immutable snapshots: change them only with newElementWith / mutateElement / scene.mutateElement. A `styleRanges` array is readonly and is replaced as a whole, never mutated in place.
- A TextStyleRange object never carries a key whose value is undefined: an absent colour is an absent key. Build ranges with conditional spreads.
- Every colour painted on canvas or written to SVG goes through applyDarkModeFilter(color, theme === THEME.DARK), as the element's own strokeColor does.
- Prefer few allocations, readonly data, `?.` and `??`. Use app.ownerDocument / app.ownerWindow, not the document/window globals, in editor code.
- Comments are short and say why, not what. Each new exported function gets a one-paragraph JSDoc.
- Tests run on Vitest 3 with globals (describe/it/expect) and jsdom + vitest-canvas-mock; import vi from "vitest" when mocking. In tests, a canvas measures every character 10px wide (getLineWidth returns text.length * 10). Assert with expect(...).toEqual / toBe / toHaveProperty; UI tests use render(<Excalidraw />), `const { h } = window`, API from tests/helpers/api, Keyboard/Pointer/UI from tests/helpers/ui and getTextEditor/updateTextEditor from tests/queries/dom.
- No new runtime or dev dependency. No new i18n label.

## Decisions

- Default value of styleRanges: Omitted when there are no runs: newTextElement does not set the key, and normalizeStyleRanges, sanitizeStyleRanges, applyStyleToRange and shiftStyleRangesForEdit return undefined (never []) when no valid range remains. Renderers treat undefined and [] alike. (not Default []) — Resolved at Gate 1: existing snapshots stay unchanged (NFR-6).
- Where the editor's textarea selection is exposed (FR-16): A module-level WeakMap registry in packages/excalidraw/actions/colorTargets.ts keyed by the App object: textWysiwyg registers a getter when it opens and unregisters it in cleanup; actions and App.text read it through getTextEditorSelection(app). (not AppState field updated on every selectionchange; not Export the accessor from wysiwyg/textWysiwyg.tsx) — AppState churn would re-render the UI on every caret move. textWysiwyg already imports the actions, so an accessor there would add an import cycle. Keying by app keeps two editors on one page apart.
- Where text edits shift the ranges (FR-20): In AppText.handleTextWysiwyg's updateElement (App.text.ts), inside the same newElementWith call that commits nextOriginalText. The previous text is the scene element's originalText, and the caret hint is getTextEditorSelection(this.app)?.end. (not Shift inside textWysiwyg's oninput) — updateElement is the single commit point for every edit path (typing, paste, indent, normalisation), so ranges and text cannot drift apart.
- Which selections count as a range pick: Only a selection that is non-empty and covers less than the whole originalText. A collapsed selection, or one covering the whole text (start 0, end originalText.length), is treated as no selection, and the pick recolours the whole element as today. (not Every non-empty selection is a range pick) — The editor opens with all of its text selected (autoSelect), so a pick right after a double-click must keep today's whole-element behaviour (FR-19, and the existing sticky-note colour tests).
- Background picker visibility while editing text: Unchanged. shapeActionPredicates.ts is outside the allowlist, so the background picker stays hidden while a plain text or a rectangle-bound text is being edited. The range-highlight path in changeBackgroundColor is reached through the action (executeAction / updateData), and the tests drive it that way. — The write contract is frozen. Showing the picker for text being edited needs a one-line change to canChangeBackgroundColor in a file this run may not touch.
- Range colour picks and the current-item defaults: When a pick is applied to a text range, the action returns appState with only the pass-through appStateUpdates from its value. currentItemStrokeColor, currentItemBackgroundColor and the sticky-note defaults stay unchanged, and syncStickyNoteInk is not applied. (not Also write the picked colour to the current-item defaults) — A range override must not recolour the next element the user draws.
- Overlapping ranges in input: normalizeStyleRanges resolves overlaps per property, with later entries in array order winning: inside an overlap, a later entry's strokeColor replaces an earlier one's, and the same holds for backgroundColor. (not First entry wins; not Drop overlapping entries) — This matches applyStyleToRange, where the latest style wins, and it is deterministic for restore.
- Edit boundaries: Text inserted exactly at a range's start or end is not coloured. Only an insertion strictly inside a range grows it. A replacement is applied as a deletion followed by an insertion at the same offset. (not Text typed at a range's end inherits its colour) — It is predictable and symmetric, and it is the behaviour AC-1 tests.
- Clearing a property: applyStyleToRange clears strokeColor on the range when the picked colour is null or equals the element's strokeColor. It clears backgroundColor when the colour is null or isTransparent(color). (not Store the base colour as an explicit run) — FR-4: picking the base colour removes the override, and runs stay minimal.
- Run geometry shared by canvas and SVG: getTextStyleRunLayout(element, env) in packages/element/src/textElement.ts returns, for each line of element.text, the runs with x (measured from the element's left edge through the textAlign line offset) and width, using prefix widths from getLineWidth. Canvas draws each run with textAlign left at run.x. SVG keeps one <text> per line with its existing x and text-anchor and puts one <tspan> per run inside it; only the highlight <rect>s use run.x and run.width. (not Separate measuring code in each renderer) — Canvas and SVG highlights then line up exactly, and the range module stays pure (NFR-4).
- Right-to-left text: getTextStyleRunLayout returns null when isRTL(element.text), so RTL text renders in the element's single strokeColor on canvas and in SVG. Its ranges are still stored, edited and restored. The CHANGELOG states this limitation. (not Per-run bidi positioning) — Measuring prefix widths left to right is wrong for bidi lines, and correct bidi layout is out of this feature's scope.
- Highlight geometry: A highlight covers the run's full line box: x = run.x, y = lineIndex * lineHeightPx, width = run.width, height = lineHeightPx. On each line, all highlights are painted before any run text. (not Glyph-height boxes) — Line boxes tile without gaps across lines, and painting backgrounds first keeps glyph overhang visible.
- Undo/redo of styleRanges (FR-23): styleRanges travels in the element delta as a whole value through the existing generic path. delta.ts adds two things: postProcess drops styleRanges from both partials when the contents are equal, and checkForVisibleDifference compares styleRanges by content. (not Diff ranges entry by entry like boundElements) — Ranges are re-normalised on every edit, so references change while content may not. A content comparison avoids empty history entries.
- Restore of styleRanges: restoreElement's text case passes styleRanges: sanitizeStyleRanges(element.styleRanges, originalText.length) to restoreElementWithProperties, then deletes the own key when the value is undefined. (not Leave a styleRanges: undefined key) — Legacy elements must come back without the key, so restore snapshots do not change.
- How other packages import the range module: Code in packages/excalidraw imports the textStyleRanges and textElement exports from "@excalidraw/element" (re-exported by packages/element/src/index.ts) and the TextStyleRange type from "@excalidraw/element/types". Code in packages/element imports them relatively. — This follows the repo's alias rule.
- Where the AC-1, AC-2 and AC-7 tests live: All three go in the new packages/element/tests/textStyleRanges.test.ts. The allowlisted packages/element/tests/delta.test.ts does not exist (the real file is delta.test.tsx, which is not allowlisted), and no second delta test file is created. — One new test file holds the whole range model, including its wrapping and history behaviour.

## Files of this change

- `packages/element/src/types.ts` (U01, edit) — import: `import type { TextStyleRange } from "@excalidraw/element/types";`
  - `type TextStyleRange(): Readonly<{ start: number; end: number; strokeColor?: string; backgroundColor?: string }>`
- `packages/element/src/textStyleRanges.ts` (U02, create) — import: `import { applyStyleToRange, areStyleRangesEqual, getStyleRunsForLines, normalizeStyleRanges, sanitizeStyleRanges, shiftStyleRangesForEdit } from "./textStyleRanges";`
  - `type TextStyleRun(): { text: string; strokeColor?: string; backgroundColor?: string }`
  - `function normalizeStyleRanges(ranges: readonly TextStyleRange[] | null | undefined, textLength: number): readonly TextStyleRange[] | undefined`
  - `function sanitizeStyleRanges(value: unknown, textLength: number): readonly TextStyleRange[] | undefined`
  - `function areStyleRangesEqual(a: readonly TextStyleRange[] | null | undefined, b: readonly TextStyleRange[] | null | undefined): boolean`
  - `function applyStyleToRange(ranges: readonly TextStyleRange[] | null | undefined, start: number, end: number, style: { strokeColor?: string | null; backgroundColor?: string | null }, textLength: number, baseStrokeColor: string | undefined): readonly TextStyleRange[] | undefined`
  - `function shiftStyleRangesForEdit(ranges: readonly TextStyleRange[] | null | undefined, prevText: string, nextText: string, caret: number | undefined): readonly TextStyleRange[] | undefined`
  - `function getStyleRunsForLines(originalText: string, wrappedText: string, ranges: readonly TextStyleRange[] | null | undefined): TextStyleRun[][]`
- `packages/element/src/index.ts` (U03, edit)
- `packages/element/src/newElement.ts` (U04, edit)
  - `function newTextElement(opts: { ...existing; styleRanges?: ExcalidrawTextElement["styleRanges"] } & ElementConstructorOpts): NonDeleted<ExcalidrawTextElement>`
- `packages/element/src/textElement.ts` (U05, edit) — import: `import { getTextStyleRunLayout } from "@excalidraw/element";`
  - `type PositionedTextStyleRun(): TextStyleRun & { x: number; width: number }`
  - `function getTextStyleRunLayout(element: ExcalidrawTextElement, env: RenderEnvironment | undefined): PositionedTextStyleRun[][] | null`
- `packages/element/src/renderElement.ts` (U06, edit)
- `packages/element/src/delta.ts` (U07, edit)
- `packages/excalidraw/actions/colorTargets.ts` (U08, edit) — import: `import { applyTextRangeColor, getTextEditorSelection, registerTextEditorSelectionGetter } from "../actions/colorTargets";`
  - `type TextEditorSelection(): { start: number; end: number }`
  - `function registerTextEditorSelectionGetter(app: object, getter: () => TextEditorSelection | null): () => void`
  - `function getTextEditorSelection(app: object | null | undefined): TextEditorSelection | null`
  - `function applyTextRangeColor(elements: readonly T[] (T extends ExcalidrawElement), appState: Pick<AppState, "editingTextElement">, app: object | null | undefined, property: ColorProperty, color: string): readonly T[] | null`
- `packages/excalidraw/actions/actionProperties.tsx` (U09, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (U10, edit)
- `packages/excalidraw/components/App.text.ts` (U11, edit)
- `packages/excalidraw/renderer/staticSvgScene.ts` (U12, edit)
- `packages/excalidraw/data/restore.ts` (U13, edit)
- `packages/excalidraw/CHANGELOG.md` (U14, edit)
- `.gitignore` (U15, edit)
- `packages/element/tests/textStyleRanges.test.ts` (U16, create)
- `packages/element/tests/newElement.test.ts` (U17, edit)
- `packages/excalidraw/wysiwyg/textWysiwyg.test.tsx` (U18, edit)
- `packages/excalidraw/tests/data/restore.test.ts` (U19, edit)
- `packages/excalidraw/tests/data/reconcile.test.ts` (U20, edit)
- `packages/excalidraw/tests/scene/export.test.ts` (U21, edit)
