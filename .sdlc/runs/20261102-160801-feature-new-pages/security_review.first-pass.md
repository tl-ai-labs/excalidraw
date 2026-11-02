# Security Review — pass1

Mode: brownfield, feature-new. Scope: the 48 files in `provenance.json` (37 edited, 11 new), diffed against `14bb42ed`.

## Summary

The pages feature keeps the end-to-end encryption model intact. Page records are encrypted with the room key in both Firestore and the socket path, using a fresh random IV. Page-scoped exports do not leak other pages, and no secrets were added. There is one blocking finding. Page records from collaborators and Firestore skip the validation that elements get, so anyone holding the room key can crash every participant's editor and can block saves for the room. Two low findings cover deleted-page content left in saved files and page ids used as plain-object keys. All findings come from reading the code; none were reproduced at runtime.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Collab input validation (trust boundary) | `excalidraw-app/collab/Collab.tsx:847`, `excalidraw-app/data/firebase.ts:139`, `excalidraw-app/data/firebase.ts:275-277`, `packages/element/src/pages.ts:290`, `packages/excalidraw/components/App.pages.ts:274`, `packages/excalidraw/components/PageTabs.tsx:284` | Remote elements go through `restoreElements` (`Collab.tsx:823`), but remote pages reach `reconcilePages` and then `updateScene({ pages })` and `setState` with no validation. A peer holding the room key can send `name: {}`, and `{page.name}` then throws during React render, taking down the editor for everyone in the room. The record merges with `reconcilePages` and is written back to Firestore by `saveToFirebase`, so it persists; a high `version` makes it win merges. `pages: [null]` or a non-array throws in `reconcilePages`, which kills socket update handling and fails every Firestore save transaction. A `null` entry also breaks room open at `excalidraw-app/App.tsx:353`, because `reconcilePages` runs before `restoreAppState` repairs anything. Name length (`MAX_PAGE_NAME_LENGTH`), list size and `index` are also unchecked on this path, and a bad `index` makes `generateNKeysBetween` throw in `newPage` and `movePage`. Confidence: high from code reading, not exercised. | Validate at both entry points, `_reconcilePages` and `decryptPages`. Add a per-record check that drops malformed entries: string `id`, string `name` within the limit, valid `index`, finite `version`, `versionNonce` and `updated`, boolean `isDeleted`. Require an array and cap the list. Do not call `restorePages` directly: it turns `[]` into a default page (which breaks the legacy-room contract) and can reassign indices, which would make peers diverge. Add a test that feeds malformed records through the socket path. |
| Low | Data remanence | `packages/excalidraw/actions/actionExport.tsx:278`, `packages/excalidraw/actions/actionExport.tsx:349`, `packages/excalidraw/data/json.ts:72`, `packages/excalidraw/components/App.pages.ts:255` | `deletePage` only marks elements `isDeleted`, and whole-drawing saves pass `getAllElementsIncludingDeleted()` to `serializeAsJSON`, which does not filter them. Text from a deleted page stays readable in the saved `.excalidraw` file even though the page record is stripped and the dialog says "Delete ... and everything on it". Deleted elements in saved files predate this run, but deleted-page content is new and the dialog promises more. `Collab.tsx:596` already treats deleted content as sensitive when creating a room. | Drop elements on tombstoned pages from whole-drawing saves, or save `getNonDeletedElements(...)` if history in files is not needed. |
| Low | Input validation (crafted file or link) | `packages/excalidraw/data/restore.ts:1059`, `packages/excalidraw/data/restore.ts:1506-1507` | `pageViewports` is a plain object keyed by page id. A page id of `constructor` makes `pageViewports[activePageId]` return an inherited function, so `scrollX` and `scrollY` become `undefined` and the viewport breaks after loading a crafted file. A page id of `__proto__` only re-parents the local object, so there is no global pollution. Confidence: medium, impact limited to the viewport. | Build `restored` with `Object.create(null)` or read it through `Object.hasOwn`. |

## Passing checks

- Encryption at rest: `pagesCiphertext` and `pagesIv` use `encryptData` with the room key and a fresh IV from `crypto.getRandomValues`.
- Encryption in transit: scene `pages` and the pointer and bounds `pageId` go through `Portal._broadcastSocketData`, which encrypts.
- Room creation: drops tombstones and deleted elements across all pages before the first save (`Collab.tsx:588-604`).
- Joining a room: `resetScene` clears every page, and page keys never come from `localAppState`, so nothing crosses between rooms.
- Embedded scenes (PNG and SVG): `getActivePageElements` plus `scopeAppStateToActivePage` limit the payload to the active page's elements, record and viewport.
- Share link and Excalidraw+ exports: send non-deleted elements only, and `serializeAsJSON` strips tombstones. Page keys `activePageId` and `pageViewports` are `server: false`.
- File, link, localStorage and tab-sync imports: go through `restorePages` / `restoreAppState`. `updateScene` ignores page keys in `appState` (`omitPageState`).
- Remote page switch: only for a user the local client chose to follow, and `setActivePage` checks the id against live pages.
- XSS: page names render as React text and in `title`; the new and search components add no HTML sinks. `t()` substitutes into text only.
- Regex and search: `getNextPageName` uses a constant pattern, and the search query stays escaped.
- Secrets: checklist grep over the touched source is clean.
- Test fixtures, snapshots and docs: no credential or token-shaped strings found.

Checklist items:

- PII fields (`government_id`, `bank_account`, `salary_base`): n/a — not in the touched set.
- Role masking and `reports_to` guards: n/a — not in the touched set, this is a client-side editor with no controllers.
- Password storage and JWT: n/a — not in the touched set.
- Audit log: n/a — not in the touched set.
- Helmet, rate limiting and global error filter: n/a — not in the touched set.
- `.env.example` and `.gitignore`: n/a — not in the touched set.
- Dependencies: no manifest or lockfile touched, so `npm audit` was not run. `@excalidraw/fractional-indexing`, newly imported in `pages.ts`, is already declared in `packages/element/package.json`.

Context, not a finding: `firebase-project/firestore.rules` (untouched) allows `write: if true`, so anyone who knows a room id can overwrite the document. The new fields add no exposure, since ciphertext stays unreadable without the key.

Suite note: the two failing tests (`export svg-embedded scene`, `with exportEmbedScene`) cover embed paths this run changed. I read that code and found no cross-page leak, but I did not determine why the snapshots differ. Confirm the new payload is intended before re-baselining them.

## Required fixes before sign-off

- `excalidraw-app/collab/Collab.tsx:847` and `excalidraw-app/data/firebase.ts:139`: validate remote page records before they reach `reconcilePages`, and add a malformed-record test (Medium).

Advisory, at the person's choice at Gate 3:

- `packages/excalidraw/actions/actionExport.tsx:278` and `:349`: keep deleted-page content out of saved files (Low).
- `packages/excalidraw/data/restore.ts:1059`: make `pageViewports` lookups own-property only (Low).

## Noted (pre-existing, out of scope)

- `packages/excalidraw/data/json.ts:72`: saved `.excalidraw` files keep deleted elements on any page, not only deleted pages.

Tool calls: 16
