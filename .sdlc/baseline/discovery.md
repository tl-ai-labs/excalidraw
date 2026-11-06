# Brownfield discovery: excalidraw-2

- Run: `20261106-103142-feature-extend-lasso-selection-mode` (intent hint: feature-extend)
- Mode: first-time (full Tier 1 scan, plus the Tier 2b stack profile)
- Built: 2026-11-06T10:33:00Z, plugin mmo 0.10.1
- Scan was quick: 1,267 tracked files, no sampling needed.

## 1. Git state
- HEAD `cf212b2f3354c09bd6f960b53a9cfb0a3ecbfa58` on branch `EX-FE-04/argon4-agsdk-only`. The folder is a **git worktree** (common git dir: `../excalidraw/.git`).
- Working tree: **clean**.
- Remotes: `origin` https://github.com/tl-ai-labs/excalidraw.git, `upstream` https://github.com/excalidraw/excalidraw.git
- `gitignore_covers_sdlc: false`. The repo `.gitignore` has no `.sdlc` entry, **but** the shared `.git/info/exclude` (line 7: `.sdlc/`) already makes git ignore `.sdlc/`. In practice, run artifacts stay out of `git add -A` here. Note that this rule lives only on this machine and is not committed.

## 2. Directory topology
Top level: `.claude/`, `.codesandbox/`, `.github/`, `.husky/`, `dev-docs/` (Docusaurus), `examples/` (with-nextjs, with-script-in-browser), `excalidraw-app/` (excalidraw.com app), `firebase-project/`, `packages/` (common, element, excalidraw, fractional-indexing, laser-pointer, math, utils), `public/`, `scripts/`.

## Detected stacks
| Manifest | Stack | Frameworks |
|---|---|---|
| `package.json` (root, private monorepo) | node-typescript | react 19 types, vite 5, vitest 3, yarn 1.22 workspaces |
| `packages/excalidraw/package.json` | node-typescript | react, jotai |
| `excalidraw-app/package.json` | node-typescript | react, vite, jotai, firebase, socket.io-client |
| `examples/with-nextjs/package.json` | node-typescript | next, react |
| `dev-docs/package.json` | node-javascript | docusaurus |

TypeScript 5.9.3 with `strict: true`, ESM, `moduleResolution: bundler`, `@excalidraw/*` path aliases in `tsconfig.json` and `vitest.config.mts`.
**None of the shipped adapters (generic, nest, python) fits a React/TS library monorepo**, so Tier 2b ran. Profile: `.sdlc/baseline/stack-profile.md`.

## 4. Test / build / run scripts
- **Proposed test command: `yarn test`** (from `package.json#scripts.test`, which runs `yarn test:app`, which runs `vitest`; `yarn.lock` present).
- Caveat: `vitest` starts in watch mode by default. For a non-interactive run use `yarn test:app --watch=false` (the same flag `test:all` passes). Gate 0 should confirm.
- Other scripts: `test:typecheck` = `tsc`; `test:code` = `eslint --max-warnings=0 --ext .js,.ts,.tsx .`; `test:other` = prettier check; `test:update` = vitest `--update --watch=false`; `test:all` runs all four.
- Targeted: `yarn test:app --watch=false packages/excalidraw/tests/lasso.test.tsx packages/excalidraw/tests/selection.test.tsx`.
- CLAUDE.md says to run `yarn test:update` before committing. Snapshot file `packages/excalidraw/tests/__snapshots__/selection.test.tsx.snap` exists, so watch for snapshot churn.
- No package-level `scripts.test`. One root vitest config (jsdom, `setupTests.ts`, globals, coverage thresholds of 60/70/63/60) covers everything.

## 5. Docs
`README.md`, `CLAUDE.md` (monorepo layout + yarn commands), `CONTRIBUTING.md` (points to docs.excalidraw.com), `.github/copilot-instructions.md` (coding standards: succinct, performance-first TS, immutable data, functional React components, PascalCase/camelCase/ALL_CAPS). Per-package READMEs in `packages/{excalidraw,common,element,math,utils,laser-pointer}`, plus `dev-docs/README.md` and `examples/with-nextjs/README.md`. No ADR directories, no ARCHITECTURE.md or AGENTS.md.

## Detected AI/agent setup
| Path | Type |
|---|---|
| `.claude/` | claude-code-project-config (gitignored via `.gitignore: .claude`) |
| `.claude/settings.local.json` | claude-code-local-settings (env block only) |
| `CLAUDE.md` | claude-instructions |
| `.github/copilot-instructions.md` | copilot-instructions (tracked) |

Not present: `.mcp.json`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.roo/`, `CLAUDE.local.md`, `routing-policy.yaml`, `gemini*.{yaml,json}`.

## 7. Env file keys (names only)
- `.env.development` (20 keys), `.env.production` (15 keys), `.env.test` (1 key: `VITE_DEBUG_DOM`). All three are **tracked in git**: these are Vite build-config files, not local secrets. `.env.*.local` variants are gitignored and none exist.
- Keys referenced in code (via `import.meta.env` / `process.env`): VITE_APP_* backend/library/WS/firebase/plus URLs, VITE_APP_ENABLE_TRACKING, VITE_APP_DISABLE_SENTRY, VITE_APP_GIT_SHA, VITE_DEBUG_DOM, VITE_WORKER_ID, MODE, DEV, PROD, PKG_NAME, PKG_VERSION, IS_PREACT, PR_TITLE. The full list is in baseline.json.

## 8. Source topology
- **Monorepo: yarn workspaces** (`excalidraw-app`, `packages/*`, `examples/*`). There are 10 workspace packages; `dev-docs` sits outside the workspaces.
- Entry points: `excalidraw-app/index.tsx`, `excalidraw-app/App.tsx`, `packages/excalidraw/index.tsx`, `packages/*/src/index.ts`.
- Submodules: none. Git-LFS: none (`.gitattributes` is only `* text=auto eol=lf`). No encrypted-secret tooling (git-crypt, sops, .gpg/.age) found.
- Infra: `Dockerfile`, `docker-compose.yml`, `.github/workflows/` (test, lint, size-limit, test-coverage-pr, docker, sentry, autorelease, ...), `vercel.json`, `.codesandbox/`, `firebase-project/`, `.husky/` pre-commit with lint-staged.
- Generated files: `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`.

## Regulated-repo signals
None found. There is no SECURITY/PRIVACY/COMPLIANCE/HIPAA/SOC2/PCI/GDPR file or folder, and no CODEOWNERS file. `regulated_repo_warning_required: false`.

## Coexistence risks
- **Claude Code config**: `.claude/settings.local.json` (env-only) and `CLAUDE.md` exist. The plugin will not touch them.
- **Copilot instructions**: `.github/copilot-instructions.md` exists. It is off-limits by default and is useful style input for the architect.
- **`.sdlc/` not in `.gitignore`**: *"Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` (create if missing, append if present) to this run's allowlist so the plugin can add the entry as part of the run."* Mitigation already in place: `.git/info/exclude` lists `.sdlc/`, so git ignores it today on this machine. Adding it to `.gitignore` is optional.
- **Husky pre-commit + lint-staged**: these run prettier/eslint on commit and may reformat staged files.
- No Cursor, Aider, MCP, or repo-local routing-policy risks.

## Proposed off-limits
`.env`, `.env.*`, `.env.local`, `.claude/**`, `CLAUDE.md`, `CLAUDE.local.md`, `.github/copilot-instructions.md`, `.mcp.json`, `.cursor/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `dev-dist/**`, `coverage/**`, `packages/excalidraw/types/**`, `packages/excalidraw/subset/harfbuzz/harfbuzz-wasm.ts`, `packages/excalidraw/subset/woff2/woff2-wasm.ts`, `.git/**`, `.sdlc/**`.

## Job-context notes (orientation only, not a plan)
- Target files exist: `packages/excalidraw/lasso/index.ts` (218 lines), `packages/excalidraw/lasso/utils.ts` (143 lines). Tests exist: `packages/excalidraw/tests/lasso.test.tsx` (1,804 lines), `packages/excalidraw/tests/selection.test.tsx` (1,461 lines, already has a `box-selection overlap mode` describe block).
- `BoxSelectionMode = "contain" | "overlap"` (`packages/excalidraw/types.ts:280`), default `"contain"` (`packages/excalidraw/appState.ts`). The brief's "Wrap" corresponds to `"contain"`; there is no `"wrap"` value. Box select passes `this.state.boxSelectionMode` into `getElementsWithinSelection` (`packages/excalidraw/components/App.tsx` ~11311). The lasso does not read it today: `getLassoSelectedElementIds` always unions intersected and enclosed elements.
