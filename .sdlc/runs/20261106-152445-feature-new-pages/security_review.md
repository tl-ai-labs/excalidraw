# Security Review — pass2

## Summary
Re-audited the touched files in `.sdlc/runs/20261106-152445-feature-new-pages/provenance.json` following the Gate 3 revisions (`packages/excalidraw/data/blob.ts`, `packages/element/src/Scene.ts`, `packages/excalidraw/tests/pages.test.tsx`, and `packages/excalidraw/components/ConvertElementTypePopup.tsx` restored to `HEAD`). No blocking or advisory security issues were found across the full change or the Gate 3 updates. Firebase room page lists are encrypted at rest with AES-GCM using `roomKey` and a fresh random IV (`pagesIv`) separate from the elements IV, tombstone-deleted elements are excluded from share-link/Excalidraw+ exports and initial room creation, single-page visual exports (`embedScene`) strip inactive pages and page metadata, untrusted `pages` and `pageId` inputs in `blob.ts` and `restore.ts` are guarded and normalized, `Scene.setActivePageId` uses a deterministic 32-bit integer increment solely for render-cache invalidation (`sceneNonce`), and page names are rendered safely via React text nodes/attributes.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| None | — | — | No security findings introduced in the touched set or Gate 3 revisions. | — |

## Passing checks
- **Encryption at rest (`excalidraw-app/data/firebase.ts`)**: `encryptPages` encrypts `appState.pages` client-side with AES-GCM using `roomKey` and a dedicated random IV (`pagesIv` / `pagesCiphertext`, distinct from the element ciphertext IV); `decryptPages` catches decryption errors cleanly without leaking sensitive state.
- **Deleted-element & tombstone privacy (`excalidraw-app/App.tsx`, `excalidraw-app/collab/Collab.tsx`, `packages/excalidraw/components/LayerUI.tsx`, `packages/excalidraw/scene/export.ts`, `packages/excalidraw/data/index.ts`)**: Share-link export (`onExportToBackend`), Excalidraw+ export, `JSONExportDialog`, and new collaboration room initialization filter `!el.isDeleted`, preventing tombstone-deleted page elements from leaking; single-page SVG/PNG `embedScene` exports include only the active page's non-deleted elements and strip `pages`, `activePageId`, and `pageId`.
- **Untrusted input normalization & blob import safety (`packages/excalidraw/data/blob.ts`, `packages/excalidraw/data/restore.ts`, `excalidraw-app/collab/Collab.tsx`)**: `loadSceneOrLibraryFromBlob` guards `data.appState?.pages` with `Array.isArray(data.appState?.pages) && data.appState.pages.length > 1` before delegating to `restoreAppState`, which filters malformed entries, trims and deduplicates page IDs, clamps finite `scrollX`/`scrollY`/`zoom` values, and synthesizes a default page when absent or invalid; `restoreElements` remaps orphaned `pageId`s to `defaultPageId` and strips cross-page bindings and frame memberships.
- **Scene cache invalidation (`packages/element/src/Scene.ts`)**: `setActivePageId` increments `this.sceneNonce = ((this.sceneNonce ?? 0) + 1) | 0` deterministically for canvas render-cache invalidation (not a cryptographic nonce).
- **XSS / user-content rendering (`packages/excalidraw/components/PageTabBar.tsx`, `packages/excalidraw/components/SearchMenu.tsx`)**: Page names and IDs are rendered through React JSX text nodes and controlled `<input>` values with automatic escaping; no `dangerouslySetInnerHTML` or unsafe DOM sinks are present.
- **Secrets & config (source, `dev-docs/**/*.mdx`, `packages/excalidraw/tests/pages.test.tsx`, `packages/element/tests/scenePages.test.ts`, `excalidraw-app/tests/pagesCollabAndStorage.test.tsx`)**: No hardcoded secrets, API keys, or credentials in committed source, documentation examples, or the expanded test suite.
- **PII handling (`government_id`, `bank_account`, `salary_base`, role-based masking, PII audit ordering)**: n/a — not in the touched set.
- **Authn & authz (controller route guards, `reports_to`, JWT secret, password hashing)**: n/a — not in the touched set.
- **Audit log integrity (append-only audit table, `auditor` role, audit fields)**: n/a — not in the touched set.
- **Surface & headers (Helmet middleware, auth rate limiting, global error filter)**: n/a — not in the touched set.
- **Dependency risk**: Unchanged — no package manifest or lockfile in the touched set.

## Required fixes before sign-off
- None.

Tool calls: 32
