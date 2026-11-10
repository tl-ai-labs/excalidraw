# Security Review — pass1 (brownfield, feature-new: pages)

## Summary
Scope: the 36 paths in `provenance.json` (baseline `14bb42ede`). Two of them, `packages/element/src/delta.ts` and `excalidraw-app/tests/collab.test.tsx`, are listed there but unchanged on disk, so there was nothing to review in them. This is a client-side drawing editor. The change adds no server routes, no auth, no PII and no audit tables. The checks that matter here are the collab and storage confidentiality model, untrusted-input handling on restore and reconcile, and secrets. Page data stays inside the existing end-to-end encryption on both paths. On the socket, `pages` sits in the payload that `Portal._broadcastSocketData` encrypts. In Firestore it is stored as its own AES ciphertext (`pagesCiphertext`/`pagesIv`, room key). Remote and file page input goes through `restorePages` (type checks, de-duplication, index validation, fallback to a default page). Viewports are checked by `isPageViewportLike`, and `pageId` is type-checked in `restoreElementWithProperties`. Page names render as React text, and the diff adds no `innerHTML` or `eval`. No blocking findings. There are two low and one informational hardening items.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Input validation (prototype pollution, local object) | packages/element/src/pages.ts:342 (`restorePages`), packages/excalidraw/data/restore.ts:~1842 (`restoredPageViewports[pageId] = …`) | `restorePages` accepts any non-empty string as a page id, including `"__proto__"`. A crafted file, or a peer sending such an id, gets it into `knownPageIds`. The assignment into the plain object `restoredPageViewports` then sets that object's prototype instead of adding a key. Only that one object is affected, not `Object.prototype`. Confidence: medium. | Reject the ids `__proto__`, `constructor` and `prototype` in `restorePages`, or build `restoredPageViewports` with `Object.create(null)` or a `Map`. |
| Low | Unbounded remote input (DoS) | packages/element/src/pages.ts:328-403 (`restorePages`), excalidraw-app/collab/Collab.tsx:398-406 (`_reconcilePages`) | Page count and `name` length from peers and files are not capped. A peer in the room can push a very large page list or very long names, which then re-render the tab bar on every client. Room peers already hold the key and can flood elements, so the gain to an attacker is small. Confidence: medium. | Cap name length (e.g. 256 characters) and page count in `restorePages`. |
| Info | Data minimisation in image exports | packages/excalidraw/appState.ts:301-302 (`pages`/`activePageId` `export: true`) | `cleanAppStateForExport` now keeps the full page list, including names and tombstones. PNG/SVG exports with an embedded scene therefore carry the names of every page, even when only the active page's elements are exported. This matches the documented file format but may surprise users who share one page as an image. | Consider removing pages other than those exported from the embedded-scene appState in image exports. Not a blocker. |

## Passing checks
- PII encryption, masking, audit log: n/a. Not in the touched set (no PII fields or audit tables in this codebase).
- Route guards, `reports_to` authz, JWT, password hashing: n/a. Not in the touched set (no server routes or auth changed).
- Collab confidentiality: socket `pages` is inside the payload that `Portal._broadcastSocketData` encrypts (Portal.tsx:93). Firestore `pagesCiphertext` is encrypted with `encryptData(roomKey)` (firebase.ts:523-550). `server: false` is set for `pages`, `activePageId` and `pageViewports`, so page data is not sent to the share-link backend in plaintext appState.
- Remote and file input is normalised by `restorePages`, `isPageViewportLike` and the `pageId` type check before use. Legacy Firestore docs without `pagesCiphertext` fall back to default pages.
- No XSS sink added: page names render as React children and as input `value`.
- Secrets grep (`(api[_-]?key|secret|password)\s*=\s*'…'`) over new and changed source: no hits. The test files `packages/element/tests/pages.test.ts` and `packages/excalidraw/tests/pages.test.tsx` contain no credentials or tokens.
- Docs (`initialdata.mdx`, `json-schema.mdx`, `CHANGELOG.md`): no secrets in examples.
- `.env.example` and `.env` gitignore: unchanged by this run.
- Helmet, rate limiting, error filter: n/a. Not in the touched set (no server surface).
- Dependencies: no manifest or lockfile in the touched set, so unchanged and `npm audit` not run. `@excalidraw/fractional-indexing`, imported by `pages.ts`, is an existing workspace dependency.

## Noted (pre-existing, out of scope)
- `firebase-project/firestore.rules` allows `get, write: if true` on every document. This is by design, because confidentiality comes from client-side encryption and room keys. A writer who knows a room id can still overwrite a scene document, including the new `pagesCiphertext` field. This run did not change it.

## Required fixes before sign-off
- None blocking. Recommended: the two Low hardening items above (reserved page ids, size caps in `restorePages`).

Tool calls: 8
