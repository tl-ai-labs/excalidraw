# SDLC project notes

Maintained by the mmo plugin. Human-readable history: [ledger.md](ledger.md) (machine mirror: [ledger.json](ledger.json)).

## Project fingerprint

- Repo: excalidraw monorepo (Yarn 1 workspaces; TypeScript strict, React 19, Vite 5, Vitest 3)
- Baseline: [baseline/current.json](baseline/current.json), taken at HEAD `4872083c0`
- Default policy: `argon4-agsdk-only` (.sdlc/project.json)
- Test command (the person's fixed study command): `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Off-limits beyond project defaults: `.claude/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `yarn.lock`, `packages/excalidraw/types/**`, generated wasm `.ts` files

## Last run

- `20261106-103201-bugfix-dark-eyedropper` — bugfix, accepted 2026-11-06T09:25:30Z. See [runs/20261106-103201-bugfix-dark-eyedropper/SUMMARY.md](runs/20261106-103201-bugfix-dark-eyedropper/SUMMARY.md).

## Lessons for future runs

- `editorJotaiStore` (packages/excalidraw/editor-jotai.ts) is module-level and not reset between tests in a file; tests that open the eyedropper (or other atoms) must reset it in `beforeEach`.
- A red check passing on exit code alone can hide a test that fails for the wrong reason; read the failing assertion.
