# Security Review — pass2

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Collab input validation (first-pass Medium, what remains) | `packages/element/src/pages.ts:470`, `packages/element/src/pages.ts:268`, `excalidraw-app/data/firebase.ts:177-179`, `excalidraw-app/data/firebase.ts:251`, `excalidraw-app/collab/Collab.tsx:334`, `excalidraw-app/collab/Collab.tsx:1053` | `sanitizeRemotePages` only requires `version` to be finite, so a well-formed record with `version: 1e300` (or `-1e300`) passes. It wins merges and is saved by an honest client. `getPagesVersion` is then added to the scene version, and the large number absorbs every later change. `isSavedToFirebase` stays true, so `saveToFirebase` returns early on every client that has merged the record, and later edits never reach Firestore. There is no error indicator, and the unload guard reports the room as saved. Page-only changes also stop broadcasting at `Collab.tsx:1053`, and a page's version bump is lost (`1e300 + 1 === 1e300`). This reaches the first-pass "can block saves for the room" outcome by a quieter route, and the record persists in the document. Confidence: high from code reading plus the arithmetic run in Node; not reproduced in a running room. | In `sanitizeRemotePages`, accept only integers from 1 to a fixed bound, such as `Number.isSafeInteger(version) && version >= 1 && version <= 2 ** 31 - 1`. Add a socket or Firestore test that sends a huge finite version and then asserts that a later edit is saved. |
| Low | Collab input validation (first-pass Medium, what remains) | `packages/element/src/pages.ts:455`, `packages/element/src/pages.ts:290`, `packages/element/src/pages.ts:323`, `excalidraw-app/collab/Collab.tsx:848`, `excalidraw-app/data/firebase.ts:280` | The cap applies per message, not to the list. `reconcilePages` merges without a limit, so a peer can add 1000 new valid pages per message, and the list grows on every client and in Firestore. `PageTabs` renders all of them, and the `unchanged` check is quadratic. Once a stored list passes 1000, `decryptPages` cuts it in stored order, so junk records with low indices push real pages out for joiners, and a joiner's save then writes the shorter list back. `storedPages` is also shorter than the local list, so `isSavedToFirebase` stays false and saves repeat. Confidence: high from code reading, not exercised. | Cap the merged result as well as each input, keeping real records over new remote ones. Limit `id` and `index` length too; a 200,001-character index passes `isValidPageIndex`. |
| Low | Collab input validation (first-pass Medium, what remains) | `excalidraw-app/data/firebase.ts:140-150`, `excalidraw-app/collab/Collab.tsx:783` | `decryptPages` validates only what decrypts to JSON. A `pagesCiphertext` that fails AES-GCM, a value that decrypts to non-JSON, or a `pagesIv` that is not `Bytes` still throws. That fails every save transaction and also stops the intact elements from loading. `firestore.rules` allows `write: if true`, so garbage bytes need only the room id, not the key. Corrupting `ciphertext` has the same effect at baseline, so this adds a second way in rather than a new capability. Confidence: high from code reading, not exercised. | Catch decrypt and parse errors in `decryptPages`, log them, and return `[]`. A later save then heals the field, because `reconcilePages(local, [])` keeps the local list. Add a test with a non-JSON payload. |
| Low | Input validation (first-pass Low, what remains) | `packages/excalidraw/components/App.pages.ts:46-47` | `getLivePageViewports` still uses a bare `viewports[id]`, the pattern the fix removed from `restore.ts`. It runs on every `applyPages` and `deletePage`. A live page with id `constructor` copies the inherited `Object` function into `pageViewports` as an own property, so `getPageViewport` then returns a function. For id `__proto__`, the assignment re-parents the local object and loses that page's viewport. There is no global pollution, and `setActivePage` falls back through `?? 0`, so the impact is a stray value in state and a lost viewport. A peer can trigger this, since `sanitizeRemotePages` accepts these ids. Confirmed in Node for both ids. | Read through `getPageViewport` and write with `Object.defineProperty`, or build `liveViewports` with `Object.create(null)`. Add a test that runs `deletePage` or `applyPages` with a page named `constructor`. |

## Re-check of the first-pass findings

| First-pass finding | Verdict | What I tried against the fix | Does a test exercise it and fail without it? |
|---|---|---|---|
| Medium: remote page records skip validation | **Partly fixed** | The original crash and persistence routes are closed. `_reconcilePages` covers socket INIT, socket UPDATE and the post-save merge. `decryptPages` covers Firestore load and the save transaction. `App.tsx:357` covers room open. I found no other route for remote pages. `validateOrderKey` rejected every crafted index I tried, and valid keys did not throw in `generateNKeysBetween`, so the first-pass index crash is closed. Three gaps remain: huge finite `version`, no cap on the merged list, and decrypt or parse failures (the first three findings above). | **Yes for the original bug.** `excalidraw-app/tests/pagesCollab.test.tsx:363` and `:387` use the real socket handler with real encryption; `:441` and `:485` use real Firestore load and save code. Each would fail without its `sanitizeRemotePages` call. **Gaps:** nothing covers the three remaining issues. The `App.tsx:357` call has no test of its own, and its input is already sanitized upstream, so removing it would fail nothing. `packages/element/tests/pages.test.ts:315` uses only `index: ""`, which returns before `validateOrderKey`, and has no bad `versionNonce` or `updated` case. |
| Low: deleted-page content left in saved files | **Fixed** | `serializeAsJSON` is the single point for `.excalidraw` saves. Save, Save As and the share and Excalidraw+ exports all pass through it. Image-handle saves go through `exportCanvas`, which is limited to the active page. Images on deleted pages are dropped because `files` is built from the filtered list. Real `appState.pages` keeps tombstones, so the filter has what it needs. Two narrow notes, neither counted as a finding: the filter matches tombstoned pages only, so a deleted element that outlives its pruned tombstone would stay in a joiner's save (this needs a concurrent peer edit and a join inside that window, low confidence); and a host's `onExport` callback now sees all pages' elements, including deleted ones, before the save. | **Yes.** `packages/excalidraw/tests/data/pages.test.ts:301` fails without the filter, and `:312` guards against over-filtering. **Gap:** both call `serializeAsJSON` directly; no test runs a real page delete followed by a save action. |
| Low: page ids as plain-object keys | **Partly fixed** | `restorePageViewports` and every `getPageViewport` caller are now safe, including `constructor` and `__proto__` on load. Computed keys in `getPageViewportsForSave`, `scopeAppStateToActivePage` and `setActivePage` create own properties, so they are safe. A search of the touched files found one lookup the fix missed, `App.pages.ts:46-47` (last finding above). | **Yes for the load path.** `packages/excalidraw/tests/data/pages.test.ts:322` fails without `getPageViewport`, `:353` fails without `defineProperty`, and `packages/element/tests/pages.test.ts:401` fails without the own-property check. **Gaps:** `:337` would pass without the fix, because `constructor` is an own key in that fixture. No test reaches `App.pages.ts:46`. |

"Would fail without it" comes from reading the tests against the code. I did not remove any fix and re-run a test.

I found nothing the fixes broke in normal use. Legacy rooms still reconcile from `[]`, and page records written by this code pass the sanitizer.

## Summary

Scope: brownfield, feature-new, 50 files in `provenance.json` (39 edited, 11 new), diffed against `14bb42ed`. This is the Gate 3 re-check after the revise.

The end-to-end encryption model is intact, and the crash the first pass found is gone: malformed page records can no longer take down the editor or poison the room document. One of the three first-pass findings is fixed and two are partly fixed. The blocking issue is a validation gap in the fix. A correctly shaped page record with a very large `version` silently stops every client from saving to Firestore, so the Medium stays open at Medium. It needs a one-line bound and a test. Three Low items remain. Exploiting these needs the room key, with two exceptions: the garbage-bytes case needs only the room id, and the `constructor` page id can also arrive in a crafted file. A key holder can already do similar damage through element versions (see Noted), but the page path is new code from this run, so its copy of the problem counts here.

## Passing checks

- Encryption at rest and in transit: unchanged since pass 1. `pagesCiphertext` and `pagesIv` use the room key with a fresh IV, and scene `pages` plus the pointer and bounds `pageId` go through the encrypted broadcast.
- Crash from malformed records (`name: {}`, `pages: [null]`, non-array): closed on socket, Firestore load, Firestore save and room open.
- Index validation: crafted keys are rejected and cannot make `generateNKeysBetween` throw.
- Prototype pollution: none. `__proto__` only affects a local object.
- Remote `pageId` on pointer and bounds messages: used only in comparisons, and `setActivePage` checks it against live pages.
- XSS: page names render as React text and in `title`; no HTML sinks added.
- Re-baselined snapshots: I decoded both embedded payloads. The element lists are unchanged, and the only additions are `pages`, `activePageId` and `pageViewports` for the default page. This closes the pass-1 suite note: the change is intended and leaks nothing across pages.
- Secrets: the checklist grep over the touched source is clean.
- Test fixtures and snapshots: room keys are generated at runtime, and `SecretTombText` and `SecretDeletedName` are marker strings, not credentials.
- Docs: no secrets or token-shaped strings in the added lines.

Checklist items:

- PII fields (`government_id`, `bank_account`, `salary_base`): n/a — not in the touched set.
- Role masking and `reports_to` guards: n/a — not in the touched set.
- Password storage and JWT: n/a — not in the touched set.
- Audit log: n/a — not in the touched set.
- Helmet, rate limiting and global error filter: n/a — not in the touched set.
- `.env.example` and `.gitignore`: n/a — not in the touched set.
- Dependencies: no manifest or lockfile touched, so unchanged; `npm audit` not run.

## Required fixes before sign-off

- `packages/element/src/pages.ts:470`: bound `version` to an integer range and add a test that a huge finite version cannot stop saves (Medium).

Advisory, at the person's choice at Gate 3:

- `packages/element/src/pages.ts:290` and `:455`: cap the merged page list, and limit `id` and `index` length (Low).
- `excalidraw-app/data/firebase.ts:140`: make `decryptPages` survive decrypt and parse failures (Low).
- `packages/excalidraw/components/App.pages.ts:46`: use own-property reads and writes in `getLivePageViewports` (Low).

## Noted (pre-existing, out of scope)

- `packages/excalidraw/data/restore.ts:490` and `packages/element/src/index.ts:15`: `element.version` is unbounded too, and `getSceneVersion` sums it, so a huge element version can stop saves in the same way at baseline. Bounding page versions closes only the page path. Fix this separately.
- `firebase-project/firestore.rules`: `allow write: if true` lets anyone who knows a room id overwrite the document.
- `packages/excalidraw/data/json.ts`: saved `.excalidraw` files keep deleted elements on live pages. This is the existing behaviour, and `packages/excalidraw/tests/data/pages.test.ts:312` now asserts it.

Tool calls: 12
