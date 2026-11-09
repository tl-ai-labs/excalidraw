# CLAUDE-SDLC — project fingerprint

Updated: 2026-11-09 (after run 20261109-163500-feature-extend-lasso-wrap-overlap).

- **Stack:** node-typescript — React 19, Vite 5, Vitest 3, TypeScript 5.9 strict, Yarn 1.22 workspaces (10 packages).
- **Baseline:** `baseline/current.json`, built 2026-11-09T11:07:43Z at `cf212b2f3` (branch `EX-FE-04/opus55-plus-flash38-agsdk`, worktree).
- **Test command (confirmed at Gate 0):** `yarn test:typecheck && yarn test:code && yarn test:app --watch=false`.
- **Default policy:** `opus55-plus-flash38-agsdk`.
- **AI configs (off-limits by default):** `.claude/`, `.claude/settings.local.json`, `CLAUDE.md`, `.github/copilot-instructions.md`.
- **Notes:** `.sdlc/` is ignored via the shared `.git/info/exclude`, not `.gitignore`. `yarn test:other` (prettier over `**/*.{json,md,…}` with `.eslintignore`) will list `.sdlc/` files while they exist locally.

Run history: [ledger.md](ledger.md) · [ledger.json](ledger.json).
