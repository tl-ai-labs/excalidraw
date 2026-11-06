# SDLC project state

- **Project fingerprint:** Yarn-workspaces TypeScript/React monorepo (10 packages), Vitest; baseline taken at
  `14bb42ede` on `EX-FE-09/argon4-plus-flash38` (`baseline/current.json`).
- **Default policy:** `argon4-plus-flash38` (`project.json`).
- **Test command (confirmed at Gate 0):** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
- **Off-limits by default:** `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.github/copilot-instructions.md`, generated
  `packages/excalidraw/types/**`, plus the project defaults in `project.json`.
- **Runs:** 1. Latest: `20261106-152507-feature-extend-arrowhead-size` (feature-extend, accepted, uncommitted).
- **Ledger:** [ledger.md](ledger.md) · machine mirror [ledger.json](ledger.json).
