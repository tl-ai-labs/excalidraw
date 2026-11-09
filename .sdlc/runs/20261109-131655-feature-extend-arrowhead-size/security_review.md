# Security Review — pass1 (brownfield, feature-extend: arrowhead size)

## Summary
Scope: the 23 files `provenance.json` lists with a real diff against `14bb42ed` (21 edited, 2 new tests). The other 23 listed files (`packages/element/src/delta.ts` and 22 snapshot files) have no diff. The appState snapshots `git status` shows only add `"currentItemArrowheadSize": "medium"` lines. The change adds a client-side rendering property (`arrowheadSize`: small/medium/large) and an appState default. It adds no network, auth, storage-of-secrets or PII surface. Untrusted input (loaded scenes, collab payloads, localStorage appState) is validated with an own-property allowlist check (`isArrowheadSize` uses `Object.prototype.hasOwnProperty.call`, so `__proto__` and `constructor` are rejected). Values that fail the check fall back to the default at restore time, and the renderer clamps them to scale 1 in `getArrowheadSizeScale`. The scale is capped at 1.5 by a constant table, so a crafted value cannot cause oversized geometry. No blocking findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Input validation | packages/excalidraw/actions/actionProperties.tsx:~2066 (`actionChangeArrowheadSize.perform`) | `appState.currentItemArrowheadSize` is set to the raw action `value` without the `isArrowheadSize` check (only `invariant(value)`). A host app calling `executeAction`/`updateData` with an arbitrary string could put a bad value in appState. Impact is none in practice: `newArrowElement` normalizes it, `getArrowheadSizeScale` falls back to 1, and `restoreAppState` corrects it on reload. Confidence high that it is harmless. | Optional hardening: `currentItemArrowheadSize: isArrowheadSize(value) ? value : DEFAULT_ARROWHEAD_SIZE`. Not required for sign-off. |

## Passing checks
- Untrusted scene data: `restore.ts` `restoreArrowheadSize` drops invalid or default values on lines and arrows. `restoreAppState` validates `currentItemArrowheadSize`. The collab path (`excalidraw-app/collab/Collab.tsx` `_reconcileElements`) goes through `restoreElements`.
- Prototype pollution / lookup safety: `isArrowheadSize` checks own properties only, so `ARROWHEAD_SIZE_SCALES[x]` is reached only with valid keys.
- Rendering/SVG: the size only scales numeric geometry from a fixed constant table. No new DOM, `innerHTML` or attribute sinks.
- Persistence: `currentItemArrowheadSize` is set to `browser: true, export: false, server: false`, so it is not sent to the server or embedded in exports.
- Secrets: no secret, key or password patterns in the edited files. The new test files (`packages/element/tests/arrowheadSize.test.ts`, `packages/excalidraw/tests/arrowheadSize.test.tsx`) contain no credentials, tokens or URLs.
- Docs (`excalidraw-element-skeleton.mdx`, `CHANGELOG.md`): the examples contain no secrets.
- Locales (`en.json`): plain labels only.
- PII encryption, response masking, audit log: n/a, not in the touched set (client-side drawing library, no PII fields or audit tables).
- Authn/authz guards, JWT, password hashing, rate limiting: n/a, not in the touched set (no routes or auth code changed).
- Helmet / global error filter / `.env` handling: n/a, not in the touched set.
- Dependency risk: unchanged. No manifest or lockfile is in the touched set, so `npm audit` was not run.

## Required fixes before sign-off
- None.

Tool calls: 6
