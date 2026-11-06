# SDLC project notes

Written by the mmo plugin (0.10.1). Not imported into `CLAUDE.md`.

## Fingerprint

- Baseline: `.sdlc/baseline/current.json`, built at HEAD `14bb42ede` (2026-11-06)
- Stack: node-typescript. Yarn 1.22 workspaces, TypeScript 5.9 strict, React 19, Vite 5, Vitest 3 (jsdom)
- Test command: `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`
- Default policy: `argon4-plus-flash38`
- AI configs kept off-limits: `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

## Runs

- Ledger: [ledger.md](ledger.md) (machine mirror: `ledger.json`)
- Last run: `20261106-152440-feature-new-text-range-styling` (feature-new, accepted, 2026-11-06)
