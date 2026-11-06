# Security Review — pass1

## Summary
Audited the 39 touched files in `.sdlc/runs/20261106-152445-feature-new-pages/provenance.json` for the multi-page scenes feature (`feature-new`). No blocking or advisory security issues were introduced. Room page metadata persisted to Firebase Firestore is encrypted client-side with AES-GCM using `roomKey` and a fresh random IV (`pagesIv`) distinct from the elements IV, deleted elements (including tombstone-deleted pages) are filtered out before share-link/Excalidraw+ export and new collaboration room initialization, visual exports with embedded scenes strip inactive pages and page metadata, untrusted `pages` and `pageId` inputs are normalized and sanitized in `restoreAppState`/`restoreElements`, and page names are rendered exclusively as React text nodes/attributes without unsafe HTML sinks.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| None | — | — | No security findings introduced in the touched set. | — |

## Passing checks
- **Encryption at rest (`excalidraw-app/data/firebase.ts`)**: `encryptPages` encrypts `appState.pages` with AES-GCM using the client-side `roomKey` and a dedicated random `pagesIv`/`pagesCiphertext` pair (no IV reuse with element encryption); `decryptPages` safely catches decryption failures without leaking key material.
- **Deleted-element & tombstone privacy (`excalidraw-app/App.tsx`, `excalidraw-app/collab/Collab.tsx`, `packages/excalidraw/components/LayerUI.tsx`, `packages/excalidraw/scene/export.ts`, `packages/excalidraw/data/index.ts`)**: Share-link export (`onExportToBackend`), Excalidraw+ export, `JSONExportDialog`, and new room initialization explicitly filter `!el.isDeleted`, preventing tombstone elements from deleted pages from leaking; single-page SVG/PNG `embedScene` exports filter to the active page and strip `pages`, `activePageId`, and `pageId`.
- **Untrusted input normalization & cross-page isolation (`packages/excalidraw/data/restore.ts`, `excalidraw-app/collab/Collab.tsx`)**: `restoreAppState` validates types, trims and deduplicates page IDs, normalizes finite scroll/zoom values, and synthesizes a fallback default page; `restoreElements` remaps orphaned `pageId`s to `defaultPageId` and strips cross-page `frameId`, `containerId`, `boundElements`, `startBinding`, and `endBinding` references.
- **XSS / user-content rendering (`packages/excalidraw/components/PageTabBar.tsx`, `packages/excalidraw/components/SearchMenu.tsx`)**: Page names and IDs are rendered as standard JSX text children and controlled `<input>` values with React auto-escaping; no `dangerouslySetInnerHTML` or unsafe DOM sinks are used.
- **Secrets & config (source, `dev-docs/**/*.mdx`, `packages/**/tests/*.test.*`, `excalidraw-app/tests/pagesCollabAndStorage.test.tsx`)**: No hardcoded secrets, API keys, or credentials in committed source, documentation examples, or test fixtures (`generateEncryptionKey()` is used at runtime in tests).
- **PII handling (`government_id`, `bank_account`, `salary_base`, role-based masking, PII audit ordering)**: n/a — not in the touched set.
- **Authn & authz (controller route guards, `reports_to`, JWT secret, password hashing)**: n/a — not in the touched set.
- **Audit log integrity (append-only audit table, `auditor` role, audit fields)**: n/a — not in the touched set.
- **Surface & headers (Helmet middleware, auth rate limiting, global error filter)**: n/a — not in the touched set.
- **Dependency risk**: Unchanged — no package manifest or lockfile in the touched set.

## Required fixes before sign-off
- None.

Tool calls: 25
