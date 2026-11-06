## Conventions

- Vitest with globals (describe/it/expect), jsdom, vitest-canvas-mock; integration tests render <Excalidraw handleKeyboardGlobally={true} /> and drive it with API (tests/helpers/api.ts) and Keyboard (tests/helpers/ui.ts), reading state from window.h.
- Formatting is prettier 2.6.2 via @excalidraw/prettier-config (80 columns, double quotes, trailing commas, semicolons), enforced by eslint's prettier/prettier rule; an import or call that exceeds 80 columns is broken one member per line as prettier prints it.
- eslint import/order: external, then @excalidraw/** packages, then parent/sibling, with every `import type` statement last; a type-only name goes in an `import type` statement, never in a value import (consistent-type-imports, separate-type-imports).
- Value names inside one import's braces are sorted alphabetically, as the existing imports in the file are.
- This is a test-only change: only packages/excalidraw/tests/textStyleRanges.test.tsx changes; no source file, no other test file, no changeset, no new test case.

## Decisions

- Scene seed in beforeEach: API.updateScene({ elements: [text], captureUpdate: CaptureUpdateAction.IMMEDIATELY }) is the only seeding call; API.setElements([text]) is removed. (not keep API.setElements and add updateScene after it; not API.setElements then a history checkpoint) — setElements does not commit to the store, and updateScene after it has nothing to commit (history.test.tsx:244), so undo would delete the uncommitted text instead of restoring its ranges.
- Undo depth in the undo/redo test: Press Keyboard.undo() twice before the post-undo assertions, with a two-line comment above saying the first undo reverts the selection-only appState entry Keyboard.exitTextEditor pushes and the second reverts the styleRanges update. (not one undo; not undo until the stack is empty) — The undo stack after the pick is [baseline addition, styleRanges update, selectedElementIds appState]; exactly two undos land on the styleRanges revert and keep the test exact.
- Type fix at the two setSelectedElements call sites: Cast the single array element: API.setSelectedElements([text as NonDeletedExcalidrawElement]) and API.setSelectedElements([styled as NonDeletedExcalidrawElement]); NonDeletedExcalidrawElement is added to the existing `import type { ... } from "@excalidraw/element/types"` statement. (not cast the whole array ([text] as NonDeletedExcalidrawElement[]); not change the helper's parameter type in tests/helpers/api.ts; not a // @ts-expect-error comment) — Matches convertElementType.binding.test.tsx:62, is local to the call, and tests/helpers/api.ts is off-limits.
- Post-undo assertions: First expect(getText(text.id).isDeleted).toBe(false), then the existing range assertion unchanged; the pre-undo and post-redo toEqual assertions stay unchanged. (not replace the range assertion with expect(styleRanges).toBeUndefined(); not drop the range assertion) — The isDeleted guard makes the test unable to pass on a deleted element, and keeping the existing assertions is the smallest change that keeps the test's force.

## Files of this change

- `packages/excalidraw/tests/textStyleRanges.test.tsx` (U01, edit)
