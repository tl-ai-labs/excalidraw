# Security Review — pass1

Mode: brownfield, intent feature-extend, run `20261106-101158-feature-extend-arrowhead-size`, scope is the 30 real touched paths in `provenance.json` (diffed against `git_head_before` 14bb42ed). The provenance path `packages/excalidraw/tests/__snapshots__/.test.tsx.snap` does not exist on disk or in the diff, so there was nothing to review there.

## Summary
The change adds an optional `arrowheadSize` enum (`"small" | "medium" | "large"`) to linear elements and a matching `appState.currentItemArrowheadSize`. It is client-side drawing code only. It does not touch authn/authz, PII, audit logging, secrets, HTTP surface or dependencies. The one place where untrusted input enters is scene data: imported files, collab or firebase payloads, localStorage, and skeleton input from the host API. That input goes through the allow-list guard `isArrowheadSize`, which runs in `restoreElement` (arrow and line), in `restoreAppState`, and in the `newArrowElement`/`newLinearElement` factories (the skeleton `transform.ts` spreads its input into these). Invalid values are dropped. At render time `getArrowheadSizeScale` turns any unknown value into 1. Because the scale tops out at 1.5, a crafted file cannot inflate canvas padding, bounds or the canvas allocation. No blocking findings.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Info | Input validation | packages/excalidraw/actions/actionProperties.tsx:2064 | `actionChangeArrowheadSize.perform` checks only that `value` is truthy (`invariant(value)`), not that it is a valid enum value, before writing it to elements and `currentItemArrowheadSize`. A host calling `executeAction` with a junk value would persist it until the next restore. Impact is nil: `getArrowheadSizeScale` turns it into 1, and `restore` removes it on reload or collab receive. | Optional hardening: `invariant(isArrowheadSize(value), ...)`. Not required for sign-off. |

## Passing checks
- PII encryption / masking / audit-before-access: n/a, not in the touched set (no PII fields or serializers).
- Route guards, role + `reports_to`, JWT secret, password hashing: n/a, not in the touched set (no controllers or auth code).
- Audit log append-only, auditor-only read, entry fields: n/a, not in the touched set.
- Secrets grep (`(api[_-]?key|secret|password)\s*=\s*'...'`) over all touched source, test and doc files: no matches.
- `.env.example` / `.env` gitignore: n/a, no config files touched.
- Helmet, auth rate limiting, global error filter: n/a, no server surface touched.
- Untrusted scene input: `restoreArrowheadSize` (restore.ts:161) and the `restoreAppState` guard (restore.ts:1347) remove anything outside the enum. Collab (`Collab.tsx:782`) and firebase (`firebase.ts:222/244/265`) both go through `restoreElements`.
- Resource bounds: `renderElement.ts` padding is `40 * max(1, scale)`, where scale is at most 1.5. The bounds extension only runs when scale > 1 and uses the same bounded head geometry.
- Test fixtures (`packages/element/tests/arrowheadSize.test.ts`, `packages/excalidraw/tests/arrowheadSize.test.tsx`, `tests/helpers/api.ts`, 3 snapshots): no credentials or real data. The snapshot changes are only `"currentItemArrowheadSize": null` additions.
- Docs (`excalidraw-element-skeleton.mdx`, `CHANGELOG.md`, `en.json`): no secrets in the examples.
- Dependency risk: unchanged. No manifest or lockfile is in the touched set, so `npm audit` was not run.

## Required fixes before sign-off
- None.

## Noted (pre-existing, out of scope)
- None observed in the inspected definitions.

Tool calls: 6
