# Security Review — pass1

## Summary
Reviewed all 30 files touched by run `20261106-120000-feature-new-drawing-pages` (multi-page drawing support across scene state, history, serialization/restore, UI tabs, collaboration, Firebase E2EE storage, docs, and tests). Page metadata (`pages`) is end-to-end encrypted alongside scene elements in both WebSocket broadcasts and Firebase storage, and no secrets or XSS sinks were introduced. Two medium/low input-validation and prototype-lookup issues were identified in collaboration page-sync handling and viewport map lookups when processing untrusted remote or imported page IDs.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Input Validation / Collaboration DoS | `excalidraw-app/collab/Collab.tsx:833` (`handleRemoteSceneUpdate`), `excalidraw-app/data/firebase.ts:125` (`decryptElements`) | `remotePages` received from WebSocket (`decryptedData.payload.pages`) or Firebase (`parsed.pages`) is written directly into `appState.pages` via `updateScene` without schema/type validation (unlike `elements`, which pass through `restoreElements`), allowing a malformed peer payload (non-array `pages`, null entries, or non-string `id`/`name`) to crash collaborators during render. | Validate and normalize incoming `remotePages` (ensuring an array of `{ id: string, name: string }` with non-empty unique string IDs and string names, or routing through `restoreAppState` page normalization) before calling `this.excalidrawAPI.updateScene`, and guard `Array.isArray(parsed?.elements)` in `decryptElements`. |
| Low | Prototype Property Lookup / State Corruption | `packages/excalidraw/data/restore.ts:1352`, `packages/excalidraw/components/App.tsx:2804`, `excalidraw-app/collab/Collab.tsx:853` | `pageViewports` is a plain object indexed by unvalidated `pageId` (`pageViewports[pageId]`), so an imported or remote page ID such as `"__proto__"`, `"constructor"`, or `"toString"` resolves to `Object.prototype` properties (truthy) and spreads `undefined` `scrollX`/`scrollY`/`zoom` into `AppState` or mutates prototype state during restore. | Reject reserved prototype keys (or check `Object.prototype.hasOwnProperty.call(pageViewports, pageId)` and create `pageViewports` with `Object.create(null)` / filter out `__proto__`, `constructor`, `prototype` in `restoreAppState`) before reading or writing `pageViewports[pageId]`. |

## Passing checks
- PII handling (`government_id`, `bank_account`, `salary_base`, role masking, PII audit log): n/a — not in the touched set (client-side drawing application; collaboration page list is E2EE encrypted in `excalidraw-app/data/firebase.ts` and `excalidraw-app/collab/Portal.tsx`).
- Authn & authz (controller guards, `reports_to`, JWT secret, password hashing): n/a — not in the touched set (`PageTabs.tsx` respects `appState.viewModeEnabled` for UI read-only mode).
- Audit log integrity: n/a — not in the touched set.
- Secrets & config: Pass — no hardcoded secrets or credentials in touched source files, docs (`dev-docs/docs/codebase/json-schema.mdx`, `packages/excalidraw/CHANGELOG.md`), or test fixtures (`packages/excalidraw/tests/pages.test.tsx`, `excalidraw-app/tests/pagesCollabAndStorage.test.tsx`, `packages/excalidraw/tests/test-utils.ts`).
- Surface & headers (Helmet, auth rate limiting, global error filter): n/a — not in the touched set; React JSX auto-escapes page names in `PageTabs.tsx` and `SearchMenu.tsx` with no unsafe DOM sinks.
- Dependency risk: Unchanged — no package manifest or lockfile in the touched set.

## Noted (pre-existing, out of scope)
- None.

## Required fixes before sign-off
- `excalidraw-app/collab/Collab.tsx:833` and `excalidraw-app/data/firebase.ts:125`: Validate and sanitize `remotePages` / `parsed.pages` (and verify `Array.isArray(parsed?.elements)`) before applying remote page state to `AppState`.
- `packages/excalidraw/data/restore.ts:1352`, `packages/excalidraw/components/App.tsx:2804`, and `excalidraw-app/collab/Collab.tsx:853`: Guard `pageViewports` lookups and assignments with `Object.hasOwn` / `hasOwnProperty` and disallow prototype-polluting page IDs (`__proto__`, `constructor`, `prototype`).

Tool calls: 18
