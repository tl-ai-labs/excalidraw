# Security Review — pass1

Run: `20261106-113849-feature-new-pages` (brownfield, feature-new). Scope: the 63 files in `provenance.json` (base `14bb42ed`). 22 of them are regenerated `.snap` files, which hold test output only and were not reviewed as source.

## Summary
This change adds a client-side Pages feature (page model, actions, tab bar, collab sync, Firebase persistence, file import/export). It adds no server routes, auth, PII fields, audit tables or dependencies, so most of the checklist does not apply. The relevant trust boundaries are encrypted collab broadcasts, the Firebase scene document and imported `.excalidraw` files, and they are mostly handled well:
- Page data is encrypted with the room key and a fresh IV, the same way as elements.
- Untrusted page lists go through `restorePages`, and viewports go through `restoreAppState`.
- Share links never carry pages (`server: false`), and the receiver resets them to the default page.
- Page names are rendered as React text, not as HTML.

The one real gap is that `restorePages` does not check the page `index` (order key). Anyone with the room key, or a crafted file, can supply a bad key. Later page operations then throw, and a stored room document can be left so that it never loads again. Posture: acceptable after one medium fix.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Input validation / availability | `packages/element/src/pages.ts:215-219` (`restorePages`), also lines 103, 160 and 243 | Any string is accepted as `index`, then passed to `generateKeyBetween` as `previousIndex` or `lastVisible.index`. That function throws `invalid order key` on bad input. A collaborator with the room key can broadcast `pages: [{id:"x",index:"!"},{id:"y"}]`. Each peer's `restorePages` then throws inside the `client-broadcast` handler (`Collab.tsx` `handleRemotePagesUpdate`), and the element update in the same message is skipped. The bad page also survives `reconcilePages` and is saved to Firestore, after which `loadFromFirebase` → `decryptPages` throws for every joiner (the room is bricked for good) and `saveToFirebase` fails on every attempt. Even a single bad key makes `createPage` and `movePage` throw for all peers. The same input works through an imported `.excalidraw` file (`data/blob.ts:194`). Confidence: high (`generateKeyBetween` calls `validateOrderKey(a)`). | In `restorePages`, check `raw.index` with `validateOrderKey` inside try/catch (exported from `@excalidraw/fractional-indexing`). If it is invalid, generate a new key from the last *valid* key. Then `previousIndex` and every later `generateKeyBetween` input are valid. Add a test with a malformed `index` followed by a page with no `index`. |
| Low | Input validation (hardening) | `packages/element/src/pages.ts:220-229`, `packages/excalidraw/data/restore.ts:687-713` | Remote and imported pages have no limit on `name` length, number of pages or `version` size: `version` accepts any finite number, e.g. `1e308`, which makes `getPagesVersion` return `Infinity` and lets those pages always win reconciliation. A page with id `"__proto__"` plus a matching `pageViewports` entry hits the `__proto__` setter on the `{}` literal at `restore.ts:708`. That changes the prototype of that one object only, not `Object.prototype`. This is the same trust model elements already have, so impact is limited to UI disruption by a room member. | Cap `name` length (e.g. 100 characters) and the page count in `restorePages`. Skip the ids `__proto__`, `constructor` and `prototype`, or build `pageViewports` with `Object.create(null)`. |

## Passing checks
- PII encryption, masking and audit-log ordering: n/a, not in the touched set (no PII fields).
- Route guards, role and `reports_to` checks, JWT secret, password hashing: n/a, not in the touched set (no server or auth code).
- Audit log integrity: n/a, not in the touched set.
- Pages encrypted at rest: `firebase.ts` `encryptPages` uses `encryptData` with the room key and a fresh random IV. No page data is stored in plaintext; `sceneVersion` was already plaintext before this change.
- Collab payloads (`pages`, `pageId`) travel inside the existing encrypted `client-broadcast` envelope (`Portal.tsx`).
- Share links: `pages`, `activePageId` and `pageViewports` are `server: false`, and `excalidraw-app/App.tsx` resets imported share links to the default page, so the receiver's local pages are not mixed in.
- XSS: page names are rendered as React text (`PageTabBar.tsx:135`, `:224`). No `dangerouslySetInnerHTML` or `innerHTML` was added in the touched sources.
- Imported viewports are type-checked and zoom-normalized in `restoreAppState`. Malformed `pageId` values on elements are dropped and repaired.
- Secrets in committed code: the regex grep over the touched sources, tests and docs found nothing. `ROOM_KEY` in `excalidraw-app/tests/pages.collab.test.tsx:134` is the same dummy key already used in `collab.test.tsx`, Firebase is mocked, and it is not a real credential.
- Docs and CHANGELOG examples contain no secrets.
- `.env.example` / `.env`: unchanged, not in the touched set.
- Helmet, rate limiting, error filter: n/a, client-only change.
- Dependencies: no manifest or lockfile in the touched set, so the dependency check was not re-run.

## Required fixes before sign-off
- Check `index` in `restorePages` (`packages/element/src/pages.ts`) before any value reaches `generateKeyBetween`, so a bad key from a collaborator or file cannot break page operations or brick a Firebase room.
- (Not a security item) The TS2322 typecheck failure at `excalidraw-app/collab/Collab.tsx:903`, reported by the orchestrator, is still open.

## Noted (pre-existing, out of scope)
- Element `version` and `versionNonce` from collaborators are also trusted without upper bounds. The page reconciliation copies this model.

Tool calls: 9
