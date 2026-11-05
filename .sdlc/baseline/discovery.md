# Discovery: 20261105-152345-feature-extend-arrowhead-size

Mode: first-time. Intent hint: feature-extend. Built 2026-11-05T09:55:35Z by plugin 0.10.1. Tier 1 scan only.

## Git state
- HEAD `14bb42edee3d6fee6be264e3ee78670b3b9cee79` on branch `EX-FE-09/argon4-agsdk-only`. The tree is clean.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- This is a git worktree: `.git` is a file that points at the main checkout `/Users/macbook/Documents/GitHub/Google-Projects/excalidraw`.
- `gitignore_covers_sdlc: false`. `.gitignore` has no `.sdlc` entry. `.sdlc/` is ignored today only by the main checkout's `.git/info/exclude`, which is local to this machine and not shared.
- 1327 tracked files, so normal discovery applies (no sampling needed).

## Directory topology
Top level: `.claude`, `.codesandbox`, `.github`, `.husky`, `dev-docs`, `examples`, `excalidraw-app`, `firebase-project`, `packages`, `public`, `scripts`.
- `packages/` holds `common`, `element`, `excalidraw`, `fractional-indexing`, `laser-pointer`, `math` and `utils`.
- `excalidraw-app/` holds `app-language`, `collab`, `components`, `data`, `share` and `tests`.
- `examples/` holds `with-nextjs` and `with-script-in-browser`.

Source mix (tracked): 366 .ts, 323 .tsx, 25 .js, 2 .mjs, 84 .scss.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| package.json (root) | node-typescript, yarn@1.22.22 | Yarn workspaces, Vitest 3, Vite 5, esbuild, TypeScript 5.9, ESLint, Prettier |
| packages/excalidraw/package.json | node-typescript | React, Jotai |
| excalidraw-app/package.json | node-typescript | React, Vite, Jotai, Firebase, socket.io-client |
| examples/with-nextjs/package.json | node-typescript | Next.js, React |
| examples/with-script-in-browser/package.json | node-typescript | React, Vite |
| dev-docs/package.json | node-javascript | Docusaurus (not a workspace member) |

The main stack is **React + TypeScript**. None of the shipped adapters (`generic.md`, `nest.md`, `python.md`) covers it, so **the Tier 2b adaptive-profile condition is met**. No profile was built in this step: the caller passed neither flag and limited writes to the discovery files. The orchestrator decides whether to run Tier 2b.

## Test / build / run scripts
These come from the root `package.json`. No workspace package has its own `test` script. One root Vitest config (`vitest.config.mts`, jsdom, `setupTests.ts`) runs every test and aliases `@excalidraw/*` to `packages/*/src`.

| Script | Runs | Purpose |
|---|---|---|
| `yarn test` | `yarn test:app` | Vitest. Watch mode by default in a TTY. |
| `yarn test:app` | `vitest` | Unit and integration tests |
| `yarn test:update` | `yarn test:app --update --watch=false` | Runs the tests once **and rewrites snapshots** |
| `yarn test:typecheck` | `tsc` | Whole-repo type check |
| `yarn test:code` | `eslint --max-warnings=0 --ext .js,.ts,.tsx .` | Lint only, not tests |
| `yarn test:other` | `prettier --list-different` on css/scss/json/md/html/yml | Format check |
| `yarn test:all` | typecheck, then code, then other, then app `--watch=false` | Full CI-equivalent run |
| `yarn fix` | prettier --write, then eslint --fix | Auto-fix (writes files) |

**Proposed test command:** `yarn test:app --watch=false` (source: `package.json#scripts.test`). Gate 0 must confirm it.
- Per package: `yarn test:app --watch=false <path>`. For this intent the likely ones are `yarn test:app --watch=false packages/excalidraw` and `yarn test:app --watch=false packages/element`.
- Extra checks worth running: `yarn test:typecheck` and `yarn test:code`.
- Caution: CLAUDE.md tells you to run `yarn test:update` before committing. Because it passes `--update`, snapshot mismatches get rewritten and never fail. Use it only to refresh snapshots on purpose, not to verify. There are 23 tracked `__snapshots__` entries.

Test files by area: packages/excalidraw 95, packages/element 31, packages/math 9, packages/common 7, packages/utils 3, excalidraw-app/tests 4.

## Docs
- `README.md`: product README (open-source hand-drawn whiteboard).
- `CLAUDE.md`: monorepo layout, dev workflow and commands.
- `AGENTS.md`: two coding rules. Use `app.ownerDocument` / `app.ownerWindow` instead of DOM globals. Prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit & Overrides`.
- `CONTRIBUTING.md`: points to the online docs.
- `dev-docs/docs/`: Docusaurus site (`@excalidraw`, `codebase`, `introduction`).
- No ARCHITECTURE.md and no ADR directories.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/settings.local.json` | Claude Code local settings (the `.claude` dir is gitignored) |
| `CLAUDE.md` | Claude instructions |
| `AGENTS.md` | Agent instructions |
| `.github/copilot-instructions.md` | GitHub Copilot instructions |

Not found: `.mcp.json`, `.cursor/`, `.cursorrules`, Aider config, `.continue/`, `.roo/`, `CLAUDE.local.md`, repo-local `routing-policy.yaml`, `gemini*.{yaml,json}`.

## Env keys (names only)
- Env files present and **tracked in git**: `.env.development`, `.env.production`, `.env.test`.
- **Key names were not read from the env files.** The permission classifier denied reading them, even with a names-only extraction. `env_keys_by_file` is empty.
- Env vars referenced in code:
  - Vite (`import.meta.env.*`): `VITE_APP_AI_BACKEND`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`, `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX`, `VITE_APP_DISABLE_PREVENT_UNLOAD`, `VITE_APP_DISABLE_SENTRY`, `VITE_APP_ENABLE_TRACKING`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_GIT_SHA`, `VITE_APP_LIBRARY_BACKEND`, `VITE_APP_LIBRARY_URL`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`, `VITE_APP_PLUS_LP`, `VITE_APP_WS_SERVER_URL`, `VITE_WORKER_ID`, `DEV`, `MODE`, `PROD`, `PKG_NAME`, `PKG_VERSION`
  - `process.env.*`: `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SERVER_URL`, `GITHUB_SHA`, `IS_PREACT`, `OSS_STATS_API_URL`, `OSS_STATS_TOKEN`, `PR_TITLE`, `RUNNER_NAME`, `VITE_DEBUG_DOM`

## Monorepo, submodules, LFS
- Monorepo type: Yarn workspaces (`excalidraw-app`, `packages/*`, `examples/*`). No nx, turbo, lerna, rush or pnpm.
- Packages: `@excalidraw/excalidraw`, `@excalidraw/element`, `@excalidraw/common`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/fractional-indexing`, `@excalidraw/laser-pointer`, `excalidraw-app`, `with-nextjs`, `with-script-in-browser`.
- Submodules: none (no `.gitmodules`).
- LFS: none. `.gitattributes` has only `* text=auto eol=lf`.
- Entry points: `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`, `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `excalidraw-app/index.html`.
- Infra: Dockerfile, docker-compose.yml, `.github/workflows/` (12 workflows including test.yml, lint.yml and test-coverage-pr.yml), vercel.json, firebase-project/, husky (pre-commit has `yarn lint-staged` commented out, so it does nothing). No terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals
None found: no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR docs, no compliance directories, no CODEOWNERS. `regulated_repo_warning_required: false`.

## Coexistence risks
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run. (Today `.sdlc/` is hidden only by the main checkout's `.git/info/exclude`, which is not shared with other clones.)
- **Copilot instructions.** `.github/copilot-instructions.md` is present. The plugin will not touch it.
- **Claude Code local settings.** `.claude/settings.local.json` is present. The plugin will not touch it.
- **AGENTS.md coding rules.** Downstream code generation should follow its two rules (ownerDocument/ownerWindow, `Merge<>`).
- No Cursor, Aider, custom `.mcp.json` or repo-local `routing-policy.yaml`.

## Repo-state risks
- `.env.development`, `.env.production` and `.env.test` are **committed to git**. Keep them off-limits.
- `yarn test:update` rewrites snapshots. Do not use it as a pass/fail gate.
- Whether tests already fail is unknown. Tier 1 does not run tests, so Gate 0 or Phase 7 should take a baseline test run before making changes.
- No encrypted-secret files (sops/age/gpg/git-crypt) were found.
- `.gitignore` ignores `.claude`, `build`, `dist`, `coverage`, `dev-dist`, `packages/excalidraw/types`, `meta*.json`, `html`, `firebase` and `.yarn`. Note the broad patterns: `html` and `meta*.json` match at any depth, so a new file or folder named like that would be silently ignored.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `.mcp.json`, `.cursor/rules/**`, `.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`, `routing-policy.yaml`, `node_modules/**`, `dist/**`, `build/**`, `dev-dist/**`, `.next/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `scripts/wasm/**`, `yarn.lock`, `.sdlc/**`, `.git/**`

The two `*-wasm.ts` files and `scripts/wasm/*.wasm` are generated or binary wasm bundles.
