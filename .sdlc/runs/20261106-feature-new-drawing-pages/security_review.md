# Security Review — pass1

Mode: brownfield · intent: feature-new · run: 20261106-feature-new-drawing-pages · base: 14bb42ed
Scope: the 52 files in `provenance.json` (38 edited source/doc/test files diffed against base, 6 new files read in full, 6 snapshot files skipped because they are generated test output).

## Summary
This run adds multi-page drawings to a client-side canvas library and app. It adds no server routes, auth, PII fields or audit tables, so most of the checklist does not apply. The security-relevant surface is (a) page records arriving from collaborators, files and localStorage, and (b) what leaves the user's machine on export and share. Pages saved to Firebase are encrypted with the room key using a fresh random IV, the same as elements. Page records from files, localStorage and Firebase are cleaned up by `restorePageState`. Page names are rendered only as React text, with no HTML sinks. No secrets are in the change. There are two low findings and no high or critical ones. The run does not need to be blocked on security grounds.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Low | Input validation / availability | `excalidraw-app/collab/Collab.tsx` (`applyRemotePages`, ~L840; called from the WS `INIT`/`UPDATE` handlers ~L619, ~L636) | Page records in the decrypted websocket payload go straight to `reconcilePages` and `updateScene` without cleanup. Only the Firebase path runs `restorePageState` (`firebase.ts` `decryptPages`). A malicious or buggy collaborator who has the room key can send a page whose `name` is an object, a bad `index`, or a very large `version`. An object `name` crashes every peer's tab bar at render (`PagesTabBar.tsx` L234 `{page.name}`), and a very large `version` permanently wins every rename. Confidence: high for the missing cleanup, medium for the crash. | At the top of `applyRemotePages`, clean the payload with `restorePageState({ pages: remotePages }).pages`, as `decryptPages` already does. Optionally cap `version` growth. |
| Low | Data exposure (export) | `packages/excalidraw/scene/export.ts` L1051–1056 and L1331–1333; `packages/excalidraw/components/App.tsx` L2778 (`getSceneElements`) | `getSceneElements()` now returns every page's elements, but the public `exportToSvg`/`exportToBlob` keep only the active page record (`toActivePageExportState`) and do not filter elements by page. A host that does `exportToBlob({ elements: api.getSceneElements(), ... })` will render and embed content from hidden pages. That breaks the documented promise in `json-schema.mdx` L74 ("carry only the active page and its elements"), and the user may share content they did not mean to. The in-app image export is fine because `prepareElementsForExport` filters by `activePageId`. Confidence: medium (this is a host-integration path). | In `exportToSvg`/`exportToBlob`, filter `elements` to `appState.activePageId` when it is set (reuse `getPageElements`), or document that hosts must filter elements themselves. |

## Passing checks
- Encryption at rest (applied to this change's data): Firebase `pagesCiphertext` uses AES with the room key and a fresh `crypto.getRandomValues` IV per save (`firebase.ts` `encryptPages`). Pages sent over the socket ride inside the existing encrypted payload.
- Untrusted page data from files, localStorage and Firebase is cleaned by `restorePageState` (type checks, duplicate-id removal, order-key validation, finite and positive viewport numbers). `restore.ts` removes a `pageId` that is not a string or is empty.
- No XSS sinks: page names go through `t()` plain string replacement and React text nodes. No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in the change.
- In-app image export and clipboard export keep only the active page (`prepareElementsForExport`, `toActivePageExportState`).
- Secrets: the secret-pattern grep across the whole change, including the new test files and the docs, found no matches. Test fixtures (`collab.test.tsx`, `pages.test.ts(x)`) contain no credentials. The docs examples (`json-schema.mdx`, `CHANGELOG.md`) contain no secrets.
- PII fields (`government_id`, `bank_account`, `salary_base`), role masking, audit log: n/a, not in the touched set (client-side canvas code).
- Route guards, `reports_to` authorization, JWT secret, password hashing: n/a, not in the touched set (no server routes or auth code changed).
- Helmet, rate limiting, global error filter: n/a, not in the touched set.
- `.env.example` / `.env` gitignore: n/a, not in the touched set (no config files touched; `.gitignore` already ignores `.env*.local`).
- Dependencies: no manifest or lockfile in the touched set, so unchanged since base. `npm audit` was not run.

## Required fixes before sign-off
- None blocking. Recommended: fix the first finding (clean websocket page records in `applyRemotePages`). It is a one-line change.

## Noted (pre-existing, out of scope)
- None found in the lines reviewed.

Tool calls: 10
