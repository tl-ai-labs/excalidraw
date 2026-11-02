# Open items at acceptance — 20261102-160801-feature-new-pages

Accepted at Gate 4 with these open. The manifest does not list them.

## Security
1. Medium: unbounded page `version` silently stops Firestore saves (`packages/element/src/pages.ts:470`). Marked required by the reviewer; Gate 3 approved with it open. Not reproduced in a running room. Proposed fix: accept only integers 1 to 2^31-1, drop others, test that a later edit still saves.
2. Low: bare page-id lookup at `packages/excalidraw/components/App.pages.ts:46-47`.
3. Low: `decryptPages` can still throw (`excalidraw-app/data/firebase.ts:140`); needs only the room id. Proposed fix: treat a decrypt failure as no page data.
4. Low: the 1000-page cap is per message, not on the merged list.
5. Pre-existing: element versions are also unbounded (`packages/excalidraw/data/restore.ts:490`).

## Testing gaps
- `packages/excalidraw/tests/data/pages.test.ts:337` passes without its fix.
- No real-browser run: tab bar, menu position, long-name ellipsis, Space activation.
- Older-client and mixed-room behaviour untested.
- `yarn test:other` not run; four `.mdx` docs units had no file check.

## Housekeeping
- CHANGELOG entry has no PR link.
- `.sdlc/` is not in `.gitignore` (declined at Gate 0); hidden only by this clone's `.git/info/exclude`.
- `true_total_cost_usd` is provisional; re-run the collector after closing the session.
