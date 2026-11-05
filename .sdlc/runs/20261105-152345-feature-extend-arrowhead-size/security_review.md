# Security Review — pass1

## Summary
The `arrowhead-size` feature-extend change introduces configurable arrowhead size presets (`0.5`, `0.75`, `1`, `1.25`) across element creation, geometry/bounds, canvas padding, UI actions, appState persistence, and scene restoration. Untrusted element and appState inputs entering `restore.ts` and `newElement.ts` are strictly validated against the `ARROWHEAD_SIZES` allowlist via `isValidArrowheadSize`, preventing `NaN`/`Infinity` propagation or unbounded canvas/SVG allocation in `renderElement.ts` and `bounds.ts`. No security issues were introduced by this run.

## Findings
| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| None | — | — | No security findings in the touched set. | — |

## Passing checks
- **PII handling:** n/a — not in the touched set.
- **Authn & authz:** n/a — not in the touched set.
- **Audit log integrity:** n/a — not in the touched set.
- **Secrets & config:** No secrets or credentials in touched source files, locale/changelog docs (`packages/excalidraw/locales/en.json`, `packages/excalidraw/CHANGELOG.md`), or test fixtures/snapshots (`packages/excalidraw/tests/arrowheadSize.test.tsx`, `packages/element/tests/bounds.test.ts`, `packages/excalidraw/tests/data/restore.test.ts`).
- **Surface & input validation (`restore.ts`, `newElement.ts`, `renderElement.ts`, `bounds.ts`, `appState.ts`):** `isValidArrowheadSize` enforces an exact primitive allowlist (`0.5 | 0.75 | 1 | 1.25`); `restoreElementWithProperties` strips `arrowheadSize` on non-linear elements, invalid values, or default `1`; `restoreAppState` sanitizes `currentItemArrowheadSize` from scene/browser storage; canvas padding in `getCanvasPadding` is bounded to at most `50px` (`40 * 1.25`).
- **Dependency risk:** Unchanged — no manifest or lockfile in the touched set.

## Required fixes before sign-off
- None.

Tool calls: 8
