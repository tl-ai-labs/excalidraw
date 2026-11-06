## Conventions

- TypeScript + React test file under packages/excalidraw/tests, run by Vitest with jsdom; describe/it/expect are globals, vi is imported from "vitest".
- Formatting is Prettier through eslint-plugin-prettier (@excalidraw/prettier-config: 80-column lines, double quotes, trailing commas, 2-space indent); an import list longer than 80 columns is broken one name per line.
- Import groups are separated by blank lines in eslint import/order: external libs, then @excalidraw/common, then @excalidraw/element, then relative imports; names inside one import are sorted as the existing line has them.
- Use the repo's helpers only: API (tests/helpers/api.ts) for scene and state, Keyboard/Pointer/UI (tests/helpers/ui.ts) for input, act/fireEvent/waitFor/GlobalTestState from ./test-utils.
- Change only the lines the sites name; every other line of pages.test.tsx stays byte-for-byte as it is.
- No assertion is deleted, loosened to a bound or made tautological, and no it.skip, it.todo or .only is introduced.

## Decisions

- How the undo test records its moves: Seed r1 and r2 with one API.updateScene({ elements: [r1, r2], captureUpdate: CaptureUpdateAction.IMMEDIATELY }) and make each move one API.updateScene whose elements list holds both rectangles in the order [r1, r2], the moved one replaced by newElementWith(API.getElement(el), { x: 1 }), with captureUpdate: CaptureUpdateAction.IMMEDIATELY. (not Keyboard.keyPress(KEYS.ARROW_RIGHT) nudges: App never captures a nudge, so the undo stack stays empty; not Passing only the moved element to updateScene: updateScene replaces all scene elements, so the other rectangle would be dropped from the scene; not A Pointer drag: works, but needs coordinates and selection state the updateScene form does not) — updateScene with IMMEDIATELY is the documented captured path (history.test.tsx uses it) and the brief confirmed it gives one undo step per move on its page.
- When the search test presses Enter: fireEvent.keyDown(searchInput, { key: KEYS.ENTER }) runs after the waitFor that sees searchMatches.matches.length === 1 and before the waitFor on activePageId. (not Pressing Enter right after updateTextEditor: the search is debounced and the Enter handler ignores the key while there are no match items) — The SearchMenu Enter handler only calls goToNextItem when match items exist, and focusing that match is what switches the page.
- Test ids: The tab menu trigger is [data-testid='pages-menu-trigger'] and the delete item is [data-testid='page-menu-delete'], as PagesTabBar.tsx renders them. — These are the ids the component has; the old ids match nothing.

## Files of this change

- `packages/excalidraw/tests/pages.test.tsx` (U01, edit)
